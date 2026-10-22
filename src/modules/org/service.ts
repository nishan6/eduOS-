import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/audit";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { parseInput } from "@/lib/validation";
import { schoolToday, toDbDate } from "@/lib/dates";
import { canInOrganization, canSchoolWide, type Actor } from "@/lib/permissions/evaluate";
import { assertCan } from "@/server/guard";
import { ensureDefaultAccounts } from "@/modules/finance/ledger";
import { attendanceRate, tally } from "@/modules/attendance/calc";

export const schoolInput = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(3, "School name is required").max(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,8}$/, "Use 2–8 letters or digits"),
  board: z.enum(["CBSE", "AP_STATE", "ICSE", "IB", "OTHER"]),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  academicYear: z.object({
    name: z.string().trim().regex(/^\d{4}-\d{2}$/, "Use the format 2026-27"),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});

/** Creates a school with its first academic year and default chart of accounts. */
export async function createSchool(actor: Actor, raw: z.input<typeof schoolInput>) {
  const input = parseInput(schoolInput, raw);
  if (!canInOrganization(actor, "schools.manage", input.organizationId)) throw forbidden();
  if (input.academicYear.endDate <= input.academicYear.startDate) throw invalid("Academic year must end after it starts.");
  try {
    return await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          organizationId: input.organizationId, name: input.name, code: input.code, board: input.board, city: input.city, state: input.state,
          // State-board schools start on the state scale; either can be changed in School setup.
          ...(input.board === "AP_STATE" ? { gradingScale: "AP_SSC_9_POINT" as const, passPercent: 35 } : {}),
          academicYears: {
            create: {
              name: input.academicYear.name, startDate: toDbDate(input.academicYear.startDate),
              endDate: toDbDate(input.academicYear.endDate), isCurrent: true,
            },
          },
        },
      });
      await ensureDefaultAccounts(tx, school.id);
      await audit({ actorUserId: actor.userId, organizationId: input.organizationId, schoolId: school.id, action: "school.create", entityType: "School", entityId: school.id, summary: `Created school ${school.name} (${school.code}, ${school.board})` }, tx);
      return school;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw conflict(`School code ${input.code} is already in use.`);
    throw e;
  }
}

export const classInput = z.object({
  schoolId: z.string().min(1),
  gradeName: z.string().trim().min(1).max(40),
  order: z.coerce.number().int().min(0).max(20),
  sections: z.string().trim().min(1, "Enter at least one section, e.g. A,B"),
});

/** Adds a class (grade) and its sections for the current academic year. */
export async function addClassWithSections(actor: Actor, raw: z.input<typeof classInput>) {
  const input = parseInput(classInput, raw);
  assertCan(actor, "settings.manage", { schoolId: input.schoolId });
  const year = await prisma.academicYear.findFirst({ where: { schoolId: input.schoolId, isCurrent: true } });
  if (!year) throw invalid("Set a current academic year first.");
  const names = [...new Set(input.sections.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (names.some((n) => !/^[A-Z0-9]{1,4}$/.test(n))) throw invalid("Section names must be 1–4 letters or digits.");
  return prisma.$transaction(async (tx) => {
    const grade = await tx.grade.upsert({
      where: { schoolId_name: { schoolId: input.schoolId, name: input.gradeName } },
      create: { schoolId: input.schoolId, name: input.gradeName, order: input.order },
      update: {},
    });
    for (const name of names) {
      await tx.section.upsert({
        where: { gradeId_academicYearId_name: { gradeId: grade.id, academicYearId: year.id, name } },
        create: { schoolId: input.schoolId, gradeId: grade.id, academicYearId: year.id, name },
        update: {},
      });
    }
    await audit({ actorUserId: actor.userId, schoolId: input.schoolId, action: "academics.class.create", entityType: "Grade", entityId: grade.id, summary: `Configured ${grade.name} sections ${names.join(", ")} for ${year.name}` }, tx);
    return grade;
  });
}

export const teacherAssignmentInput = z.object({
  schoolId: z.string().min(1),
  userId: z.string().min(1),
  sectionId: z.string().min(1),
  isClassTeacher: z.boolean().default(false),
});

export async function assignTeacher(actor: Actor, raw: z.input<typeof teacherAssignmentInput>) {
  const input = parseInput(teacherAssignmentInput, raw);
  assertCan(actor, "settings.manage", { schoolId: input.schoolId });
  const [section, membership] = await Promise.all([
    prisma.section.findUnique({ where: { id: input.sectionId }, include: { grade: true } }),
    prisma.userSchoolMembership.findUnique({ where: { userId_schoolId: { userId: input.userId, schoolId: input.schoolId } }, include: { user: true } }),
  ]);
  if (!section || section.schoolId !== input.schoolId) throw notFound("Section");
  if (!membership || membership.status !== "ACTIVE") throw invalid("That staff member is not an active member of this school.");
  const existing = await prisma.teacherAssignment.findFirst({ where: { userId: input.userId, sectionId: input.sectionId, subjectId: null } });
  if (existing) throw conflict("Already assigned to this section.");
  const a = await prisma.teacherAssignment.create({ data: { userId: input.userId, schoolId: input.schoolId, sectionId: input.sectionId, isClassTeacher: input.isClassTeacher } });
  await audit({ actorUserId: actor.userId, schoolId: input.schoolId, action: "academics.teacher.assign", entityType: "TeacherAssignment", entityId: a.id, summary: `Assigned ${membership.user.name} to ${section.grade.name}-${section.name}${input.isClassTeacher ? " as class teacher" : ""}` });
  return a;
}

export async function getSchoolSettings(actor: Actor, schoolId: string) {
  if (!canSchoolWide(actor, "academics.read", schoolId)) throw forbidden();
  const school = await prisma.school.findUniqueOrThrow({
    where: { id: schoolId },
    include: {
      academicYears: { orderBy: { startDate: "desc" } },
      grades: {
        orderBy: { order: "asc" },
        include: {
          sections: {
            where: { academicYear: { isCurrent: true } },
            orderBy: { name: "asc" },
            include: {
              _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
              teacherAssignments: { include: { user: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  const staff = await prisma.userSchoolMembership.findMany({
    where: { schoolId, status: "ACTIVE", user: { roleAssignments: { some: { schoolId, role: { key: { in: ["teacher", "principal", "vice_principal"] } } } } } },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return { school, staff: staff.map((s) => s.user) };
}

/**
 * Owner / group view: one row per school. Only metrics that are defined identically
 * across schools are compared (see docs/METRICS.md).
 */
export async function organizationOverview(actor: Actor, organizationId: string) {
  if (!canInOrganization(actor, "reports.read", organizationId)) throw forbidden();
  const today = toDbDate(schoolToday());
  const schools = await prisma.school.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
  const rows = await Promise.all(
    schools.map(async (s) => {
      const [students, sectionCount, submitted, records, invoices, collectedToday] = await Promise.all([
        prisma.studentEnrollment.count({ where: { status: "ACTIVE", academicYear: { schoolId: s.id, isCurrent: true }, student: { status: "ACTIVE" } } }),
        prisma.section.count({ where: { schoolId: s.id, academicYear: { isCurrent: true } } }),
        prisma.attendanceSession.count({ where: { schoolId: s.id, date: today, status: "SUBMITTED" } }),
        prisma.studentAttendance.groupBy({ by: ["status"], where: { session: { schoolId: s.id, date: today, status: "SUBMITTED" } }, _count: true }),
        prisma.invoice.aggregate({ where: { schoolId: s.id, status: { not: "VOID" } }, _sum: { totalPaise: true, paidPaise: true } }),
        prisma.payment.aggregate({ where: { schoolId: s.id, status: "RECORDED", receivedAt: today }, _sum: { amountPaise: true } }),
      ]);
      const statuses = records.flatMap((r) => Array<typeof r.status>(r._count).fill(r.status));
      const t = tally(statuses);
      const invoiced = invoices._sum.totalPaise ?? 0;
      const paid = invoices._sum.paidPaise ?? 0;
      return {
        school: { id: s.id, name: s.name, code: s.code, board: s.board, hasHostel: s.hasHostel },
        students,
        attendance: { submittedSections: submitted, totalSections: sectionCount, rate: attendanceRate(t), tally: t },
        fees: { invoicedPaise: invoiced, collectedPaise: paid, outstandingPaise: invoiced - paid, collectedTodayPaise: collectedToday._sum.amountPaise ?? 0 },
      };
    }),
  );
  return rows;
}

export async function listAudit(actor: Actor, schoolId: string, take = 100) {
  if (!canSchoolWide(actor, "audit.read", schoolId)) throw forbidden();
  return prisma.auditLog.findMany({
    where: { schoolId },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export const gradingInput = z.object({
  schoolId: z.string().min(1),
  scale: z.enum(["CBSE_9_POINT", "AP_SSC_9_POINT"]),
  passPercent: z.coerce.number().int().min(20, "Pass mark must be at least 20%").max(60, "Pass mark must be at most 60%"),
});

/** Sets the grading scale used by exams created from now on. Existing exams keep theirs. */
export async function setGradingRules(actor: Actor, raw: z.input<typeof gradingInput>) {
  const input = parseInput(gradingInput, raw);
  assertCan(actor, "settings.manage", { schoolId: input.schoolId });
  const school = await prisma.school.update({ where: { id: input.schoolId }, data: { gradingScale: input.scale, passPercent: input.passPercent } });
  await audit({
    actorUserId: actor.userId, organizationId: school.organizationId, schoolId: school.id,
    action: "school.grading.update", entityType: "School", entityId: school.id,
    summary: `Grading scale set to ${input.scale}, pass mark ${input.passPercent}%`,
  });
}
