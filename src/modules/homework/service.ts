import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/audit";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { blankToUndefined, parseInput } from "@/lib/validation";
import { can, sectionFilter, type Actor } from "@/lib/permissions/evaluate";
import { assertCan } from "@/server/guard";
import { addDays, fromDbDate, schoolToday, toDbDate } from "@/lib/dates";
import { currentSectionId } from "@/modules/students/service";
import { isLinkedGuardian } from "@/modules/family/access";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

export const homeworkInput = z.object({
  sectionId: z.string().min(1, "Choose a class"),
  subjectId: blankToUndefined(z.string()),
  title: z.string().trim().min(3, "Give the homework a short title").max(120),
  instructions: z.string().trim().min(3, "Add instructions for students").max(2000),
  dueOn: isoDate,
});

/** Homework must be due between today and 60 days out. */
const MAX_DAYS_AHEAD = 60;

function view(h: {
  id: string; sectionId: string; title: string; instructions: string; assignedOn: Date; dueOn: Date; status: string;
  subject: { name: string } | null; createdBy: { name: string }; section?: { name: string; grade: { name: string } };
}) {
  return {
    id: h.id,
    sectionId: h.sectionId,
    title: h.title,
    instructions: h.instructions,
    assignedOn: fromDbDate(h.assignedOn),
    dueOn: fromDbDate(h.dueOn),
    status: h.status as "PUBLISHED" | "CANCELLED",
    subject: h.subject?.name ?? null,
    teacher: h.createdBy.name,
    className: h.section ? `${h.section.grade.name} - ${h.section.name}` : null,
  };
}
export type HomeworkView = ReturnType<typeof view>;

export async function createHomework(actor: Actor, raw: z.input<typeof homeworkInput>) {
  const input = parseInput(homeworkInput, raw);
  const section = await prisma.section.findUnique({
    where: { id: input.sectionId },
    include: { grade: true, academicYear: true, school: { select: { organizationId: true } } },
  });
  if (!section) throw notFound("Class");
  assertCan(actor, "homework.manage", { schoolId: section.schoolId, sectionId: section.id }, "You can only set homework for your own classes.");
  if (!section.academicYear.isCurrent) throw invalid("Homework can only be set for the current academic year.");

  const today = schoolToday();
  if (input.dueOn < today) throw invalid("The due date cannot be in the past.", { dueOn: ["Choose today or a later date"] });
  if (input.dueOn > addDays(today, MAX_DAYS_AHEAD)) throw invalid(`The due date must be within ${MAX_DAYS_AHEAD} days.`, { dueOn: ["Too far ahead"] });

  if (input.subjectId) {
    const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
    if (!subject || subject.schoolId !== section.schoolId) throw invalid("Choose a subject from this school.", { subjectId: ["Unknown subject"] });
  }

  return prisma.$transaction(async (tx) => {
    const hw = await tx.homework.create({
      data: {
        schoolId: section.schoolId, sectionId: section.id, subjectId: input.subjectId ?? null,
        title: input.title, instructions: input.instructions,
        assignedOn: toDbDate(today), dueOn: toDbDate(input.dueOn), createdById: actor.userId,
      },
    });
    // In-app notice for guardians who have a login; one per guardian even with two children in the class.
    const links = await tx.studentGuardianRelationship.findMany({
      where: {
        student: { status: "ACTIVE", enrollments: { some: { sectionId: section.id, status: "ACTIVE" } } },
        guardian: { userId: { not: null } },
      },
      select: { studentId: true, student: { select: { firstName: true } }, guardian: { select: { userId: true } } },
    });
    const byUser = new Map<string, (typeof links)[number]>();
    for (const l of links) if (!byUser.has(l.guardian.userId!)) byUser.set(l.guardian.userId!, l);
    if (byUser.size) {
      await tx.notification.createMany({
        data: [...byUser.entries()].map(([userId, l]) => ({
          userId, schoolId: section.schoolId,
          title: `New homework: ${input.title}`,
          body: `${section.grade.name}-${section.name}, due ${input.dueOn}.`,
          href: `/app/family/children/${l.studentId}`,
        })),
      });
    }
    await audit({
      actorUserId: actor.userId, organizationId: section.school.organizationId, schoolId: section.schoolId,
      action: "homework.create", entityType: "Homework", entityId: hw.id,
      summary: `Set homework "${hw.title}" for ${section.grade.name}-${section.name}, due ${input.dueOn}`,
    }, tx);
    return hw;
  });
}

export async function cancelHomework(actor: Actor, homeworkId: string) {
  const hw = await prisma.homework.findUnique({ where: { id: homeworkId }, include: { school: { select: { organizationId: true } } } });
  if (!hw || !can(actor, "homework.read", { schoolId: hw.schoolId, sectionId: hw.sectionId })) throw notFound("Homework");
  assertCan(actor, "homework.manage", { schoolId: hw.schoolId, sectionId: hw.sectionId });
  const r = await prisma.homework.updateMany({ where: { id: hw.id, status: "PUBLISHED" }, data: { status: "CANCELLED" } });
  if (r.count === 0) throw conflict("This homework is already cancelled.");
  await audit({
    actorUserId: actor.userId, organizationId: hw.school.organizationId, schoolId: hw.schoolId,
    action: "homework.cancel", entityType: "Homework", entityId: hw.id, summary: `Cancelled homework "${hw.title}"`,
  });
}

const include = { subject: { select: { name: true } }, createdBy: { select: { name: true } }, section: { select: { name: true, grade: { select: { name: true } } } } } as const;

/** Homework the actor can see in a school: recent and upcoming, newest due date first. */
export async function listHomework(actor: Actor, schoolId: string, opts: { sectionId?: string; days?: number } = {}) {
  const filter = sectionFilter(actor, "homework.read", schoolId);
  if (filter !== "all" && filter.length === 0) throw forbidden();
  if (opts.sectionId && filter !== "all" && !filter.includes(opts.sectionId)) throw notFound("Class");
  const since = addDays(schoolToday(), -(opts.days ?? 14));
  const rows = await prisma.homework.findMany({
    where: {
      schoolId,
      dueOn: { gte: toDbDate(since) },
      ...(opts.sectionId ? { sectionId: opts.sectionId } : filter === "all" ? {} : { sectionId: { in: filter } }),
    },
    include,
    orderBy: [{ dueOn: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  return rows.map(view);
}

/** Homework for one student's current class. Parents see it only for linked children. */
export async function studentHomework(actor: Actor, studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
  if (!student) throw notFound("Student");
  const sectionId = await currentSectionId(studentId);
  const staff = can(actor, "homework.read", { schoolId: student.schoolId, sectionId });
  if (!staff && !(await isLinkedGuardian(actor, studentId, "homework.read"))) throw notFound("Student");
  if (!sectionId) return [];
  const rows = await prisma.homework.findMany({
    where: { sectionId, status: "PUBLISHED", dueOn: { gte: toDbDate(addDays(schoolToday(), -7)) } },
    include,
    orderBy: [{ dueOn: "asc" }, { createdAt: "asc" }],
    take: 50,
  });
  return rows.map(view);
}
