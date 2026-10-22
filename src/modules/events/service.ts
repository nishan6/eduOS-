import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/audit";
import { forbidden, invalid, notFound } from "@/lib/errors";
import { blankToUndefined, parseInput } from "@/lib/validation";
import { canSchoolWide, hasFamilyPermission, type Actor } from "@/lib/permissions/evaluate";
import { assertCan } from "@/server/guard";
import { addDays, fromDbDate, schoolToday, toDbDate } from "@/lib/dates";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

export const eventInput = z.object({
  schoolId: z.string().min(1),
  title: z.string().trim().min(2, "Add a title").max(120),
  description: blankToUndefined(z.string().trim().max(1000)),
  kind: z.enum(["HOLIDAY", "EXAM", "EVENT", "MEETING"]),
  audience: z.enum(["EVERYONE", "STAFF"]).default("EVERYONE"),
  startsOn: isoDate,
  endsOn: blankToUndefined(isoDate),
});

export const KIND_LABEL = { HOLIDAY: "Holiday", EXAM: "Exam", EVENT: "Event", MEETING: "Meeting" } as const;

export async function createEvent(actor: Actor, raw: z.input<typeof eventInput>) {
  const input = parseInput(eventInput, raw);
  assertCan(actor, "events.manage", { schoolId: input.schoolId });
  const endsOn = input.endsOn ?? input.startsOn;
  if (endsOn < input.startsOn) throw invalid("The event must end on or after its start date.", { endsOn: ["Before the start"] });
  if (input.startsOn < addDays(schoolToday(), -30)) throw invalid("Events more than 30 days in the past cannot be added.", { startsOn: ["Too far back"] });
  const school = await prisma.school.findUniqueOrThrow({ where: { id: input.schoolId } });
  const event = await prisma.schoolEvent.create({
    data: {
      schoolId: school.id, title: input.title, description: input.description ?? null, kind: input.kind, audience: input.audience,
      startsOn: toDbDate(input.startsOn), endsOn: toDbDate(endsOn), createdById: actor.userId,
    },
  });
  await audit({
    actorUserId: actor.userId, organizationId: school.organizationId, schoolId: school.id,
    action: "event.create", entityType: "SchoolEvent", entityId: event.id, summary: `Added ${input.kind.toLowerCase()} "${event.title}" on ${input.startsOn}`,
  });
  return event;
}

export async function deleteEvent(actor: Actor, eventId: string) {
  const e = await prisma.schoolEvent.findUnique({ where: { id: eventId }, include: { school: { select: { organizationId: true } } } });
  if (!e || !canSchoolWide(actor, "academics.read", e.schoolId)) throw notFound("Event");
  assertCan(actor, "events.manage", { schoolId: e.schoolId });
  await prisma.schoolEvent.delete({ where: { id: e.id } });
  await audit({
    actorUserId: actor.userId, organizationId: e.school.organizationId, schoolId: e.schoolId,
    action: "event.delete", entityType: "SchoolEvent", entityId: e.id, summary: `Removed "${e.title}" (${fromDbDate(e.startsOn)})`,
  });
}

function view(e: { id: string; title: string; description: string | null; kind: keyof typeof KIND_LABEL; audience: string; startsOn: Date; endsOn: Date }) {
  return { id: e.id, title: e.title, description: e.description, kind: e.kind, audience: e.audience as "EVERYONE" | "STAFF", startsOn: fromDbDate(e.startsOn), endsOn: fromDbDate(e.endsOn) };
}
export type EventView = ReturnType<typeof view>;

/** Staff calendar: everything from a week ago to 120 days ahead. */
export async function schoolCalendar(actor: Actor, schoolId: string) {
  if (!canSchoolWide(actor, "academics.read", schoolId)) throw forbidden();
  const today = schoolToday();
  const rows = await prisma.schoolEvent.findMany({
    where: { schoolId, endsOn: { gte: toDbDate(addDays(today, -7)) }, startsOn: { lte: toDbDate(addDays(today, 120)) } },
    orderBy: [{ startsOn: "asc" }, { title: "asc" }],
  });
  return rows.map(view);
}

/** Parent calendar: events for everyone at their children's schools. */
export async function familyCalendar(actor: Actor) {
  if (!hasFamilyPermission(actor, "family.read") || !actor.guardianId) throw forbidden();
  const schools = await prisma.school.findMany({
    where: { students: { some: { status: "ACTIVE", guardians: { some: { guardianId: actor.guardianId } } } } },
    select: { id: true, name: true },
  });
  if (schools.length === 0) return [];
  const today = schoolToday();
  const rows = await prisma.schoolEvent.findMany({
    where: { schoolId: { in: schools.map((s) => s.id) }, audience: "EVERYONE", endsOn: { gte: toDbDate(today) }, startsOn: { lte: toDbDate(addDays(today, 120)) } },
    orderBy: [{ startsOn: "asc" }, { title: "asc" }],
  });
  const name = new Map(schools.map((s) => [s.id, s.name]));
  return rows.map((e) => ({ ...view(e), school: name.get(e.schoolId)! }));
}
