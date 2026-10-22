import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/audit";
import { forbidden, invalid, notFound } from "@/lib/errors";
import { blankToUndefined, parseInput } from "@/lib/validation";
import { can, canSchoolWide, hasAnywhere, hasFamilyPermission, sectionFilter, type Actor } from "@/lib/permissions/evaluate";
import { addDays, schoolToday } from "@/lib/dates";
import { getEmailProvider } from "@/lib/integrations/email";

export const announcementInput = z.object({
  schoolId: z.string().min(1),
  title: z.string().trim().min(3, "Add a title").max(120),
  body: z.string().trim().min(3, "Write the message").max(4000),
  audience: z.enum(["SCHOOL_PARENTS", "GRADE_PARENTS", "SECTION_PARENTS"]),
  gradeId: blankToUndefined(z.string()),
  sectionId: blankToUndefined(z.string()),
});

export const AUDIENCE_LABEL = { SCHOOL_PARENTS: "All parents", GRADE_PARENTS: "Parents of a class", SECTION_PARENTS: "Parents of a section" } as const;

/**
 * Sends an announcement to guardians of actively enrolled students. Guardians with a login get an
 * in-app notification; guardians with an email address also get an email through the email adapter
 * (the development outbox unless a provider is configured).
 */
export async function sendAnnouncement(actor: Actor, raw: z.input<typeof announcementInput>) {
  const input = parseInput(announcementInput, raw);
  const school = await prisma.school.findUnique({ where: { id: input.schoolId } });
  if (!school) throw notFound("School");

  let label = school.name;
  let enrollmentFilter: Prisma.StudentEnrollmentWhereInput = { section: { schoolId: school.id }, academicYear: { isCurrent: true }, status: "ACTIVE" };
  if (input.audience === "SECTION_PARENTS") {
    if (!input.sectionId) throw invalid("Choose a section.", { sectionId: ["Required"] });
    const section = await prisma.section.findUnique({ where: { id: input.sectionId }, include: { grade: true } });
    if (!section || section.schoolId !== school.id) throw invalid("Choose a section from this school.");
    if (!can(actor, "announcements.send", { schoolId: school.id, sectionId: section.id })) throw forbidden("You can only message parents of your own classes.");
    enrollmentFilter = { ...enrollmentFilter, sectionId: section.id };
    label = `${section.grade.name}-${section.name}`;
  } else {
    if (!canSchoolWide(actor, "announcements.send", school.id)) throw forbidden("Only school leadership can message all parents or a whole class.");
    if (input.audience === "GRADE_PARENTS") {
      if (!input.gradeId) throw invalid("Choose a class.", { gradeId: ["Required"] });
      const grade = await prisma.grade.findUnique({ where: { id: input.gradeId } });
      if (!grade || grade.schoolId !== school.id) throw invalid("Choose a class from this school.");
      enrollmentFilter = { ...enrollmentFilter, section: { schoolId: school.id, gradeId: grade.id } };
      label = grade.name;
    }
  }

  const guardians = await prisma.guardian.findMany({
    where: { students: { some: { student: { status: "ACTIVE", schoolId: school.id, enrollments: { some: enrollmentFilter } } } } },
    select: { id: true, userId: true, email: true },
  });
  if (guardians.length === 0) throw invalid("No parents match that audience.");
  const inApp = guardians.filter((g) => g.userId);
  const emails = [...new Set(guardians.map((g) => g.email?.toLowerCase()).filter((e): e is string => !!e))];

  const announcement = await prisma.$transaction(async (tx) => {
    const a = await tx.announcement.create({
      data: {
        schoolId: school.id, title: input.title, body: input.body, audience: input.audience,
        gradeId: input.audience === "GRADE_PARENTS" ? input.gradeId : null,
        sectionId: input.audience === "SECTION_PARENTS" ? input.sectionId : null,
        recipientCount: inApp.length, emailCount: emails.length, createdById: actor.userId,
      },
    });
    if (inApp.length) {
      await tx.notification.createMany({
        data: inApp.map((g) => ({ userId: g.userId!, schoolId: school.id, title: input.title, body: input.body.slice(0, 280), href: "/app/family/notices" })),
      });
    }
    await audit({
      actorUserId: actor.userId, organizationId: school.organizationId, schoolId: school.id,
      action: "announcement.send", entityType: "Announcement", entityId: a.id,
      summary: `Sent "${a.title}" to ${label} (${inApp.length} in app, ${emails.length} email)`,
    }, tx);
    return a;
  });

  // Email after commit so a slow provider never holds the transaction open.
  // TODO(queue): move to a background job before sending to whole schools in production.
  const provider = getEmailProvider();
  let delivered = 0;
  for (const to of emails) {
    try {
      const r = await provider.send({ to, subject: `${school.name}: ${input.title}`, body: input.body });
      if (r.delivered) delivered++;
    } catch (err) {
      console.error("[eduos] announcement email failed", err instanceof Error ? err.message : err);
    }
  }
  return { id: announcement.id, inApp: inApp.length, emails: emails.length, delivered, provider: provider.name };
}

/** Recent announcements for staff who can send them. Section-scoped senders see school-wide notices and their own sections'. */
export async function listSchoolAnnouncements(actor: Actor, schoolId: string) {
  if (!hasAnywhere(actor, "announcements.send", schoolId)) throw forbidden();
  const filter = sectionFilter(actor, "announcements.send", schoolId);
  const rows = await prisma.announcement.findMany({
    where: {
      schoolId,
      ...(filter === "all" ? {} : { OR: [{ audience: { not: "SECTION_PARENTS" } }, { sectionId: { in: filter } }] }),
    },
    include: { createdBy: { select: { name: true } }, grade: true, section: { include: { grade: true } } },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });
  return rows.map(toView);
}

function toView(a: Prisma.AnnouncementGetPayload<{ include: { createdBy: { select: { name: true } }; grade: true; section: { include: { grade: true } } } }>) {
  return {
    id: a.id, title: a.title, body: a.body, audience: a.audience, publishedAt: a.publishedAt, author: a.createdBy.name,
    recipientCount: a.recipientCount, emailCount: a.emailCount,
    target: a.audience === "SECTION_PARENTS" && a.section ? `${a.section.grade.name}-${a.section.name}` : a.audience === "GRADE_PARENTS" && a.grade ? a.grade.name : "All parents",
  };
}

/** Announcements addressed to the parent's children over the last 60 days. */
export async function familyAnnouncements(actor: Actor) {
  if (!hasFamilyPermission(actor, "family.read") || !actor.guardianId) throw forbidden();
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { status: "ACTIVE", academicYear: { isCurrent: true }, student: { status: "ACTIVE", guardians: { some: { guardianId: actor.guardianId } } } },
    select: { sectionId: true, section: { select: { schoolId: true, gradeId: true } } },
  });
  if (enrollments.length === 0) return [];
  const since = new Date(`${addDays(schoolToday(), -60)}T00:00:00Z`);
  const rows = await prisma.announcement.findMany({
    where: {
      publishedAt: { gte: since },
      OR: enrollments.flatMap((e) => [
        { schoolId: e.section.schoolId, audience: "SCHOOL_PARENTS" as const },
        { schoolId: e.section.schoolId, audience: "GRADE_PARENTS" as const, gradeId: e.section.gradeId },
        { schoolId: e.section.schoolId, audience: "SECTION_PARENTS" as const, sectionId: e.sectionId },
      ]),
    },
    include: { createdBy: { select: { name: true } }, grade: true, section: { include: { grade: true } }, school: { select: { name: true } } },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });
  return rows.map((a) => ({ ...toView(a), school: a.school.name }));
}
