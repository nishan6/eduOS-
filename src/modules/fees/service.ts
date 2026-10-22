import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/audit";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { parseInput } from "@/lib/validation";
import { fromDbDate, schoolToday, toDbDate } from "@/lib/dates";
import { can, canSchoolWide, type Actor } from "@/lib/permissions/evaluate";
import { assertCan } from "@/server/guard";
import { formatDocNumber, nextDocumentNumber } from "@/server/sequence";
import { isLinkedGuardian } from "@/modules/family/access";
import { MODE_ACCOUNT, postSystemEntry } from "@/modules/finance/ledger";
import { agingBucket, allocateOldestFirst, groupComponentsByDueDate, outstanding, statusForPaid, type AgingBucket } from "./calc";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const categoryInput = z.object({
  schoolId: z.string().min(1),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,20}$/, "Use 2–20 letters, digits or underscores"),
  name: z.string().trim().min(2).max(80),
});

export async function createFeeCategory(actor: Actor, raw: z.input<typeof categoryInput>) {
  const input = parseInput(categoryInput, raw);
  assertCan(actor, "fees.configure", { schoolId: input.schoolId });
  try {
    const cat = await prisma.feeCategory.create({ data: input });
    await audit({ actorUserId: actor.userId, schoolId: input.schoolId, action: "fees.category.create", entityType: "FeeCategory", entityId: cat.id, summary: `Created fee category ${cat.code}` });
    return cat;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw conflict(`Category code ${input.code} already exists.`);
    throw e;
  }
}

export const structureInput = z.object({
  schoolId: z.string().min(1),
  academicYearId: z.string().min(1),
  gradeId: z.string().min(1).optional(),
  name: z.string().trim().min(2, "Name is required").max(120),
  components: z
    .array(
      z.object({
        categoryId: z.string().min(1, "Choose a category"),
        label: z.string().trim().min(2, "Label is required").max(120),
        amountPaise: z.number().int().positive("Amount must be greater than zero"),
        dueDate: isoDate,
      }),
    )
    .min(1, "Add at least one fee component"),
});

export async function createFeeStructure(actor: Actor, raw: z.input<typeof structureInput>) {
  const input = parseInput(structureInput, raw);
  assertCan(actor, "fees.configure", { schoolId: input.schoolId });
  const [year, categories, grade] = await Promise.all([
    prisma.academicYear.findUnique({ where: { id: input.academicYearId } }),
    prisma.feeCategory.findMany({ where: { schoolId: input.schoolId, id: { in: input.components.map((c) => c.categoryId) } } }),
    input.gradeId ? prisma.grade.findUnique({ where: { id: input.gradeId } }) : null,
  ]);
  if (!year || year.schoolId !== input.schoolId) throw invalid("Academic year does not belong to this school.");
  if (input.gradeId && (!grade || grade.schoolId !== input.schoolId)) throw invalid("Class does not belong to this school.");
  if (categories.length !== new Set(input.components.map((c) => c.categoryId)).size) throw invalid("Unknown fee category.");
  const ys = fromDbDate(year.startDate);
  const ye = fromDbDate(year.endDate);
  if (input.components.some((c) => c.dueDate < ys || c.dueDate > ye)) throw invalid("Due dates must fall within the academic year.");

  try {
    return await prisma.$transaction(async (tx) => {
      const s = await tx.feeStructure.create({
        data: {
          schoolId: input.schoolId,
          academicYearId: input.academicYearId,
          gradeId: input.gradeId,
          name: input.name,
          components: { create: input.components.map((c) => ({ ...c, dueDate: toDbDate(c.dueDate) })) },
        },
      });
      const total = input.components.reduce((sum, c) => sum + c.amountPaise, 0);
      await audit({ actorUserId: actor.userId, schoolId: input.schoolId, action: "fees.structure.create", entityType: "FeeStructure", entityId: s.id, summary: `Created fee structure "${s.name}" totalling ${total} paise` }, tx);
      return s;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw conflict("A structure with this name already exists for the year.");
    throw e;
  }
}

export async function listFeeConfig(actor: Actor, schoolId: string) {
  assertCan(actor, "fees.read", { schoolId });
  const [categories, structures] = await Promise.all([
    prisma.feeCategory.findMany({ where: { schoolId }, orderBy: { code: "asc" } }),
    prisma.feeStructure.findMany({
      where: { schoolId, academicYear: { isCurrent: true } },
      include: {
        grade: true,
        academicYear: true,
        components: { include: { category: true }, orderBy: [{ dueDate: "asc" }, { label: "asc" }] },
        _count: { select: { assignments: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    categories,
    structures: structures.map((s) => ({ ...s, totalPaise: s.components.reduce((sum, c) => sum + c.amountPaise, 0) })),
  };
}

// ---------------------------------------------------------------------------
// Assignment and invoicing
// ---------------------------------------------------------------------------

export const assignInput = z.object({ studentId: z.string().min(1), structureId: z.string().min(1) });

/**
 * Assigns a fee structure to a student and issues one invoice per installment due date.
 * Each invoice posts Dr Fees Receivable / Cr Fee Income.
 */
export async function assignFeeStructure(actor: Actor, raw: z.input<typeof assignInput>) {
  const input = parseInput(assignInput, raw);
  const [student, structure] = await Promise.all([
    prisma.student.findUnique({ where: { id: input.studentId }, include: { school: true } }),
    prisma.feeStructure.findUnique({ where: { id: input.structureId }, include: { components: true } }),
  ]);
  if (!student) throw notFound("Student");
  if (!structure) throw notFound("Fee structure");
  assertCan(actor, "fees.assign", { schoolId: student.schoolId });
  if (structure.schoolId !== student.schoolId) throw forbidden("That fee structure belongs to a different school.");
  if (student.status !== "ACTIVE") throw invalid("Fees can only be assigned to active students.");
  const enrolled = await prisma.studentEnrollment.findUnique({
    where: { studentId_academicYearId: { studentId: student.id, academicYearId: structure.academicYearId } },
  });
  if (!enrolled) throw invalid("The student is not enrolled in this fee structure's academic year.");

  const groups = groupComponentsByDueDate(structure.components.map((c) => ({ ...c, dueDate: fromDbDate(c.dueDate) })));
  const today = schoolToday();

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.studentFeeAssignment.create({ data: { studentId: student.id, structureId: structure.id, assignedById: actor.userId } });
      const invoices = [];
      for (const g of groups) {
        const n = await nextDocumentNumber(tx, student.schoolId, "invoice");
        const inv = await tx.invoice.create({
          data: {
            schoolId: student.schoolId,
            studentId: student.id,
            number: formatDocNumber("INV", student.school.code, n),
            issueDate: toDbDate(today),
            dueDate: toDbDate(g.dueDate),
            totalPaise: g.totalPaise,
            createdById: actor.userId,
            lines: { create: g.items.map((c) => ({ componentId: c.id, description: c.label, amountPaise: c.amountPaise })) },
          },
        });
        await postSystemEntry(tx, {
          schoolId: student.schoolId, schoolCode: student.school.code, date: toDbDate(today),
          narration: `Invoice ${inv.number} for ${student.admissionNo}`, source: "INVOICE", sourceId: inv.id, createdById: actor.userId,
          lines: [{ accountCode: "1100", debitPaise: g.totalPaise }, { accountCode: "4000", creditPaise: g.totalPaise }],
        });
        invoices.push(inv);
      }
      await audit(
        {
          actorUserId: actor.userId, organizationId: student.school.organizationId, schoolId: student.schoolId,
          action: "fees.assign", entityType: "Student", entityId: student.id,
          summary: `Assigned "${structure.name}" to ${student.admissionNo}; issued ${invoices.map((i) => i.number).join(", ")}`,
          metadata: { structureId: structure.id, invoiceIds: invoices.map((i) => i.id) },
        },
        tx,
      );
      return invoices;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw conflict("This fee structure is already assigned to the student.");
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export const paymentInput = z
  .object({
    studentId: z.string().min(1),
    amountPaise: z.number().int().positive("Amount must be greater than zero"),
    mode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CARD"]),
    reference: z.string().trim().max(80).optional(),
    receivedOn: isoDate,
    note: z.string().trim().max(300).optional(),
    /** Generated by the form once; resubmitting the same form cannot record a second payment. */
    idempotencyKey: z.string().min(8).max(100),
  })
  .refine((p) => p.mode === "CASH" || (p.reference && p.reference.length >= 4), {
    message: "A transaction / cheque reference is required for non-cash payments",
    path: ["reference"],
  });

export async function recordPayment(actor: Actor, raw: z.input<typeof paymentInput>) {
  const input = parseInput(paymentInput, raw);
  const student = await prisma.student.findUnique({ where: { id: input.studentId }, include: { school: true } });
  if (!student) throw notFound("Student");
  assertCan(actor, "fees.collect", { schoolId: student.schoolId }, "You are not authorized to record fee collections.");
  if (input.receivedOn > schoolToday()) throw invalid("Payment date cannot be in the future.");

  const prior = await prisma.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { receipt: true } });
  if (prior) {
    if (prior.studentId !== input.studentId || prior.amountPaise !== input.amountPaise) throw conflict("This form was already used for a different payment.");
    return { payment: prior, receipt: prior.receipt!, duplicate: true };
  }

  return prisma.$transaction(async (tx) => {
    // Lock the student's open invoices so concurrent collections cannot over-allocate.
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE "studentId" = ${student.id} AND status IN ('ISSUED','PARTIALLY_PAID') FOR UPDATE`;
    const open = await tx.invoice.findMany({ where: { studentId: student.id, status: { in: ["ISSUED", "PARTIALLY_PAID"] } } });
    let allocations;
    try {
      allocations = allocateOldestFirst(
        input.amountPaise,
        open.map((i) => ({ id: i.id, totalPaise: i.totalPaise, paidPaise: i.paidPaise, dueDate: fromDbDate(i.dueDate), number: i.number })),
      );
    } catch (e) {
      throw invalid(e instanceof Error && e.message.includes("exceeds") ? "Amount is more than the outstanding balance. Advance payments are not supported yet." : "Invalid amount.");
    }

    const payment = await tx.payment.create({
      data: {
        schoolId: student.schoolId,
        studentId: student.id,
        amountPaise: input.amountPaise,
        mode: input.mode,
        reference: input.reference || null,
        receivedAt: toDbDate(input.receivedOn),
        idempotencyKey: input.idempotencyKey,
        recordedById: actor.userId,
        note: input.note,
        allocations: { create: allocations },
      },
    });
    for (const a of allocations) {
      const inv = open.find((i) => i.id === a.invoiceId)!;
      const paid = inv.paidPaise + a.amountPaise;
      await tx.invoice.update({ where: { id: inv.id }, data: { paidPaise: paid, status: statusForPaid(inv.totalPaise, paid) } });
    }
    const n = await nextDocumentNumber(tx, student.schoolId, "receipt");
    const receipt = await tx.receipt.create({
      data: { schoolId: student.schoolId, paymentId: payment.id, number: formatDocNumber("RCT", student.school.code, n) },
    });
    await postSystemEntry(tx, {
      schoolId: student.schoolId, schoolCode: student.school.code, date: toDbDate(input.receivedOn),
      narration: `Receipt ${receipt.number} (${input.mode}${input.reference ? ` ${input.reference}` : ""}) from ${student.admissionNo}`,
      source: "PAYMENT", sourceId: payment.id, createdById: actor.userId,
      lines: [{ accountCode: MODE_ACCOUNT[input.mode]!, debitPaise: input.amountPaise }, { accountCode: "1100", creditPaise: input.amountPaise }],
    });
    await audit(
      {
        actorUserId: actor.userId, organizationId: student.school.organizationId, schoolId: student.schoolId,
        action: "fees.payment.record", entityType: "Payment", entityId: payment.id,
        summary: `Recorded ${input.mode} payment of ${input.amountPaise} paise from ${student.admissionNo}; receipt ${receipt.number}`,
        metadata: { allocations },
      },
      tx,
    );
    return { payment, receipt, duplicate: false };
  });
}

export const reverseInput = z.object({
  paymentId: z.string().min(1),
  reason: z.string().trim().min(5, "Give a reason of at least 5 characters").max(300),
});

/** Reverses a recorded payment: un-allocates invoices and posts a mirror journal entry. Nothing is deleted. */
export async function reversePayment(actor: Actor, raw: z.input<typeof reverseInput>) {
  const input = parseInput(reverseInput, raw);
  const payment = await prisma.payment.findUnique({ where: { id: input.paymentId }, include: { school: true, receipt: true, student: true } });
  if (!payment) throw notFound("Payment");
  assertCan(actor, "fees.reverse", { schoolId: payment.schoolId }, "You are not authorized to reverse payments.");

  return prisma.$transaction(async (tx) => {
    const flipped = await tx.payment.updateMany({
      where: { id: payment.id, status: "RECORDED" },
      data: { status: "REVERSED", reversedById: actor.userId, reversedAt: new Date(), reversalReason: input.reason },
    });
    if (flipped.count !== 1) throw conflict("This payment has already been reversed.");
    const allocations = await tx.paymentAllocation.findMany({ where: { paymentId: payment.id }, include: { invoice: true } });
    for (const a of allocations) {
      const paid = a.invoice.paidPaise - a.amountPaise;
      await tx.invoice.update({ where: { id: a.invoiceId }, data: { paidPaise: paid, status: statusForPaid(a.invoice.totalPaise, paid) } });
    }
    const original = await tx.journalEntry.findFirst({ where: { source: "PAYMENT", sourceId: payment.id } });
    await postSystemEntry(tx, {
      schoolId: payment.schoolId, schoolCode: payment.school.code, date: toDbDate(schoolToday()),
      narration: `Reversal of receipt ${payment.receipt?.number ?? payment.id}: ${input.reason}`,
      source: "PAYMENT_REVERSAL", sourceId: payment.id, createdById: actor.userId, reversesId: original?.id,
      lines: [{ accountCode: "1100", debitPaise: payment.amountPaise }, { accountCode: MODE_ACCOUNT[payment.mode]!, creditPaise: payment.amountPaise }],
    });
    await audit(
      {
        actorUserId: actor.userId, organizationId: payment.school.organizationId, schoolId: payment.schoolId,
        action: "fees.payment.reverse", entityType: "Payment", entityId: payment.id,
        summary: `Reversed receipt ${payment.receipt?.number} (${payment.amountPaise} paise) for ${payment.student.admissionNo}: ${input.reason}`,
      },
      tx,
    );
  });
}

/** Marks a payment as verified against bank / UPI statements (reconciliation). */
export async function setPaymentVerification(actor: Actor, paymentId: string, verification: "VERIFIED" | "DISCREPANCY") {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw notFound("Payment");
  assertCan(actor, "finance.reconcile", { schoolId: payment.schoolId });
  await prisma.payment.update({ where: { id: paymentId }, data: { verification } });
  await audit({ actorUserId: actor.userId, schoolId: payment.schoolId, action: "fees.payment.verify", entityType: "Payment", entityId: paymentId, summary: `Marked payment ${verification.toLowerCase()}` });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function assertCanReadFees(actor: Actor, studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
  if (!student) throw notFound("Student");
  if (can(actor, "fees.read", { schoolId: student.schoolId })) return "staff" as const;
  if (await isLinkedGuardian(actor, studentId, "fees.read")) return "family" as const;
  throw notFound("Student");
}

export async function studentFeeAccount(actor: Actor, studentId: string) {
  const via = await assertCanReadFees(actor, studentId);
  const [invoices, payments, assignments] = await Promise.all([
    prisma.invoice.findMany({
      where: { studentId, status: { not: "VOID" } },
      include: { lines: true },
      orderBy: [{ dueDate: "asc" }, { number: "asc" }],
    }),
    prisma.payment.findMany({
      where: { studentId },
      include: { receipt: true, allocations: { include: { invoice: { select: { number: true } } } } },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.studentFeeAssignment.findMany({ where: { studentId }, include: { structure: true } }),
  ]);
  const today = schoolToday();
  const totalInvoiced = invoices.reduce((s, i) => s + i.totalPaise, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.paidPaise, 0);
  const overdue = invoices.filter((i) => outstanding(i) > 0 && fromDbDate(i.dueDate) < today).reduce((s, i) => s + outstanding(i), 0);
  const nextDue = invoices.find((i) => outstanding(i) > 0);
  return {
    via,
    invoices: invoices.map((i) => ({ ...i, outstandingPaise: outstanding(i), dueDateIso: fromDbDate(i.dueDate), isOverdue: outstanding(i) > 0 && fromDbDate(i.dueDate) < today })),
    payments,
    assignments,
    totals: { invoicedPaise: totalInvoiced, paidPaise: totalPaid, outstandingPaise: totalInvoiced - totalPaid, overduePaise: overdue },
    nextDue: nextDue ? { number: nextDue.number, dueDate: fromDbDate(nextDue.dueDate), amountPaise: outstanding(nextDue) } : null,
  };
}

export async function getReceipt(actor: Actor, receiptId: string) {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      payment: {
        include: {
          student: { include: { school: true, enrollments: { where: { academicYear: { isCurrent: true } }, include: { section: { include: { grade: true } } } } } },
          allocations: { include: { invoice: { include: { lines: true } } } },
        },
      },
    },
  });
  if (!receipt) throw notFound("Receipt");
  await assertCanReadFees(actor, receipt.payment.studentId);
  const recorder = await prisma.user.findUnique({ where: { id: receipt.payment.recordedById }, select: { name: true } });
  return { receipt, recordedBy: recorder?.name ?? "—" };
}

export async function schoolFeeSummary(actor: Actor, schoolId: string) {
  if (!canSchoolWide(actor, "fees.read", schoolId)) throw forbidden();
  const today = schoolToday();
  const monthStart = `${today.slice(0, 8)}01`;
  const [inv, open, collectedToday, collectedMonth, byMode, recent, unverified] = await Promise.all([
    prisma.invoice.aggregate({ where: { schoolId, status: { not: "VOID" } }, _sum: { totalPaise: true, paidPaise: true }, _count: true }),
    prisma.invoice.findMany({ where: { schoolId, status: { in: ["ISSUED", "PARTIALLY_PAID"] } }, select: { totalPaise: true, paidPaise: true, dueDate: true } }),
    prisma.payment.aggregate({ where: { schoolId, status: "RECORDED", receivedAt: toDbDate(today) }, _sum: { amountPaise: true }, _count: true }),
    prisma.payment.aggregate({ where: { schoolId, status: "RECORDED", receivedAt: { gte: toDbDate(monthStart) } }, _sum: { amountPaise: true }, _count: true }),
    prisma.payment.groupBy({ by: ["mode"], where: { schoolId, status: "RECORDED", receivedAt: { gte: toDbDate(monthStart) } }, _sum: { amountPaise: true } }),
    prisma.payment.findMany({
      where: { schoolId },
      include: { receipt: true, student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.payment.count({ where: { schoolId, status: "RECORDED", verification: "UNVERIFIED", mode: { not: "CASH" } } }),
  ]);
  const aging: Record<AgingBucket, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const i of open) aging[agingBucket(fromDbDate(i.dueDate), today)] += outstanding(i);
  const invoiced = inv._sum.totalPaise ?? 0;
  const allocated = inv._sum.paidPaise ?? 0;
  return {
    invoicedPaise: invoiced,
    allocatedPaise: allocated,
    outstandingPaise: invoiced - allocated,
    overduePaise: aging["1-30"] + aging["31-60"] + aging["61-90"] + aging["90+"],
    aging,
    collectedTodayPaise: collectedToday._sum.amountPaise ?? 0,
    collectedTodayCount: collectedToday._count,
    collectedMonthPaise: collectedMonth._sum.amountPaise ?? 0,
    byMode: byMode.map((m) => ({ mode: m.mode, amountPaise: m._sum.amountPaise ?? 0 })),
    recent,
    unverifiedNonCash: unverified,
  };
}

/** Students with an outstanding balance, largest first (collection worklist). */
export async function outstandingStudents(actor: Actor, schoolId: string, q?: string) {
  if (!canSchoolWide(actor, "fees.read", schoolId)) throw forbidden();
  const rows = await prisma.invoice.groupBy({
    by: ["studentId"],
    where: {
      schoolId, status: { in: ["ISSUED", "PARTIALLY_PAID"] },
      ...(q ? { student: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { admissionNo: { contains: q, mode: "insensitive" } }] } } : {}),
    },
    _sum: { totalPaise: true, paidPaise: true },
    _min: { dueDate: true },
  });
  const students = await prisma.student.findMany({
    where: { id: { in: rows.map((r) => r.studentId) } },
    select: { id: true, firstName: true, lastName: true, admissionNo: true },
  });
  const byId = new Map(students.map((s) => [s.id, s]));
  return rows
    .map((r) => ({
      student: byId.get(r.studentId)!,
      outstandingPaise: (r._sum.totalPaise ?? 0) - (r._sum.paidPaise ?? 0),
      oldestDue: r._min.dueDate ? fromDbDate(r._min.dueDate) : null,
    }))
    .sort((a, b) => b.outstandingPaise - a.outstandingPaise)
    .slice(0, 100);
}
