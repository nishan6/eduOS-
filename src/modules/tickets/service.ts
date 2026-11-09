import "server-only";
import { z } from "zod";
import type { Prisma, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/audit";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { blankToUndefined, parseInput } from "@/lib/validation";
import { canSchoolWide, hasFamilyPermission, type Actor } from "@/lib/permissions/evaluate";
import { assertCan } from "@/server/guard";
import { formatDocNumber, nextDocumentNumber } from "@/server/sequence";
import { isLinkedGuardian } from "@/modules/family/access";

export const CATEGORY_LABEL = { FEES: "Fees", ACADEMICS: "Academics", TRANSPORT: "Transport", ADMINISTRATION: "Administration", TECHNICAL: "App or login", OTHER: "Other" } as const;
export const STATUS_LABEL: Record<TicketStatus, string> = { OPEN: "Open", IN_PROGRESS: "In progress", RESOLVED: "Resolved", CLOSED: "Closed" };

export const ticketInput = z.object({
  schoolId: blankToUndefined(z.string()), // staff: their school; parents: derived from the child
  studentId: blankToUndefined(z.string()),
  category: z.enum(["FEES", "ACADEMICS", "TRANSPORT", "ADMINISTRATION", "TECHNICAL", "OTHER"]),
  subject: z.string().trim().min(3, "Add a short subject").max(140),
  body: z.string().trim().min(5, "Describe the issue").max(4000),
});

/**
 * Raises a ticket. Parents raise tickets about one of their own children (the school is the
 * child's school); staff raise tickets in a school where they hold tickets.create.
 */
export async function createTicket(actor: Actor, raw: z.input<typeof ticketInput>) {
  const input = parseInput(ticketInput, raw);
  let schoolId: string;
  if (input.studentId) {
    const student = await prisma.student.findUnique({ where: { id: input.studentId }, select: { schoolId: true } });
    if (!student || !(await isLinkedGuardian(actor, input.studentId, "tickets.create"))) throw notFound("Student");
    schoolId = student.schoolId;
  } else {
    if (!input.schoolId) throw invalid("Choose which child this is about.", { studentId: ["Required"] });
    if (hasFamilyPermission(actor, "tickets.create") && !canSchoolWide(actor, "tickets.create", input.schoolId)) throw invalid("Choose which child this is about.", { studentId: ["Required"] });
    assertCan(actor, "tickets.create", { schoolId: input.schoolId });
    schoolId = input.schoolId;
  }
  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
  return prisma.$transaction(async (tx) => {
    const n = await nextDocumentNumber(tx, schoolId, "ticket");
    const ticket = await tx.ticket.create({
      data: {
        schoolId, number: formatDocNumber("TKT", school.code, n), subject: input.subject, category: input.category,
        studentId: input.studentId ?? null, raisedById: actor.userId,
        messages: { create: { authorId: actor.userId, body: input.body } },
      },
    });
    await audit({
      actorUserId: actor.userId, organizationId: school.organizationId, schoolId,
      action: "ticket.create", entityType: "Ticket", entityId: ticket.id, summary: `Raised ${ticket.number} (${input.category.toLowerCase()})`,
    }, tx);
    return ticket;
  });
}

/** The raiser always sees their ticket (minus internal notes); helpdesk staff see their school's queue. */
async function loadTicket(actor: Actor, ticketId: string) {
  const t = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { school: { select: { organizationId: true, name: true } } } });
  if (!t) throw notFound("Ticket");
  const staff = canSchoolWide(actor, "tickets.manage", t.schoolId);
  if (!staff && t.raisedById !== actor.userId) throw notFound("Ticket");
  return { ticket: t, staff };
}

export async function getTicket(actor: Actor, ticketId: string) {
  const { ticket, staff } = await loadTicket(actor, ticketId);
  const full = await prisma.ticket.findUniqueOrThrow({
    where: { id: ticket.id },
    include: {
      raisedBy: { select: { name: true, email: true } },
      assignee: { select: { id: true, name: true } },
      student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
      messages: { where: staff ? {} : { isInternal: false }, include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  return { ...full, schoolName: ticket.school.name, isStaff: staff };
}

export const replyInput = z.object({
  ticketId: z.string().min(1),
  body: z.string().trim().min(1, "Write a reply").max(4000),
  isInternal: z.boolean().default(false),
});

export async function replyToTicket(actor: Actor, raw: z.input<typeof replyInput>) {
  const input = parseInput(replyInput, raw);
  const { ticket, staff } = await loadTicket(actor, input.ticketId);
  if (input.isInternal && !staff) throw forbidden();
  if (ticket.status === "CLOSED") throw conflict("This ticket is closed. Raise a new one if the issue is back.");
  await prisma.$transaction(async (tx) => {
    await tx.ticketMessage.create({ data: { ticketId: ticket.id, authorId: actor.userId, body: input.body, isInternal: input.isInternal } });
    const fromRaiser = actor.userId === ticket.raisedById;
    // A raiser replying to a resolved ticket reopens it; staff replying to an open one moves it along.
    const status: TicketStatus | undefined = fromRaiser && ticket.status === "RESOLVED" ? "OPEN" : !fromRaiser && !input.isInternal && ticket.status === "OPEN" ? "IN_PROGRESS" : undefined;
    await tx.ticket.update({ where: { id: ticket.id }, data: { ...(status ? { status, resolvedAt: null } : {}), updatedAt: new Date() } });
    if (!input.isInternal) {
      const notify = fromRaiser ? ticket.assigneeId : ticket.raisedById;
      if (notify && notify !== actor.userId) {
        await tx.notification.create({
          data: { userId: notify, schoolId: ticket.schoolId, title: `Reply on ${ticket.number}`, body: input.body.slice(0, 200), href: `/app/${fromRaiser ? "helpdesk" : "support"}/${ticket.id}` },
        });
      }
    }
  });
}

export const updateInput = z.object({
  ticketId: z.string().min(1),
  status: blankToUndefined(z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"])),
  assigneeId: z.string().nullable().optional(),
});

/** Helpdesk staff change status or assignee. Raisers can only close their own ticket. */
export async function updateTicket(actor: Actor, raw: z.input<typeof updateInput>) {
  const input = parseInput(updateInput, raw);
  const { ticket, staff } = await loadTicket(actor, input.ticketId);
  if (!staff) {
    if (input.assigneeId !== undefined || input.status !== "CLOSED") throw forbidden();
  }
  if (input.assigneeId) {
    const ok = await prisma.userSchoolMembership.findFirst({ where: { userId: input.assigneeId, schoolId: ticket.schoolId, status: "ACTIVE" } });
    if (!ok) throw invalid("Assign the ticket to a staff member of this school.");
  }
  const data: Prisma.TicketUpdateInput = {};
  if (input.status) {
    data.status = input.status;
    data.resolvedAt = input.status === "RESOLVED" || input.status === "CLOSED" ? new Date() : null;
  }
  if (input.assigneeId !== undefined) data.assignee = input.assigneeId ? { connect: { id: input.assigneeId } } : { disconnect: true };
  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: ticket.id }, data });
    if (input.status === "RESOLVED" && ticket.raisedById !== actor.userId) {
      await tx.notification.create({ data: { userId: ticket.raisedById, schoolId: ticket.schoolId, title: `${ticket.number} resolved`, body: ticket.subject, href: `/app/support/${ticket.id}` } });
    }
    if (input.assigneeId && input.assigneeId !== actor.userId) {
      await tx.notification.create({ data: { userId: input.assigneeId, schoolId: ticket.schoolId, title: `${ticket.number} assigned to you`, body: ticket.subject, href: `/app/helpdesk/${ticket.id}` } });
    }
    await audit({
      actorUserId: actor.userId, organizationId: ticket.school.organizationId, schoolId: ticket.schoolId,
      action: "ticket.update", entityType: "Ticket", entityId: ticket.id,
      summary: `${ticket.number}: ${[input.status && `status ${input.status}`, input.assigneeId !== undefined && "assignee changed"].filter(Boolean).join(", ")}`,
    }, tx);
  });
}

const listInclude = { student: { select: { firstName: true, lastName: true } }, raisedBy: { select: { name: true } }, assignee: { select: { name: true } } } as const;

/** Helpdesk queue for a school. */
export async function listQueue(actor: Actor, schoolId: string, opts: { status?: TicketStatus | "ACTIVE"; mine?: boolean } = {}) {
  assertCan(actor, "tickets.manage", { schoolId });
  const where: Prisma.TicketWhereInput = {
    schoolId,
    ...(opts.status === "ACTIVE" || !opts.status ? { status: { in: ["OPEN", "IN_PROGRESS"] } } : { status: opts.status }),
    ...(opts.mine ? { assigneeId: actor.userId } : {}),
  };
  const [rows, counts] = await Promise.all([
    prisma.ticket.findMany({ where, include: listInclude, orderBy: [{ createdAt: "asc" }], take: 200 }),
    prisma.ticket.groupBy({ by: ["status"], where: { schoolId }, _count: { _all: true } }),
  ]);
  return { rows, counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<TicketStatus, number>> };
}

/** Tickets the actor raised, newest first. */
export async function myTickets(actor: Actor) {
  return prisma.ticket.findMany({ where: { raisedById: actor.userId }, include: { ...listInclude, school: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
}

export async function assignableStaff(actor: Actor, schoolId: string) {
  assertCan(actor, "tickets.manage", { schoolId });
  const rows = await prisma.userSchoolMembership.findMany({
    where: { schoolId, status: "ACTIVE", user: { roleAssignments: { some: { role: { permissions: { some: { permissionKey: "tickets.manage" } } } } } } },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return rows.map((r) => r.user);
}
