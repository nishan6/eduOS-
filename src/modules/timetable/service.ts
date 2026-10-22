import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/audit";
import { conflict, invalid, notFound } from "@/lib/errors";
import { blankToUndefined, parseInput } from "@/lib/validation";
import { canSchoolWide, type Actor } from "@/lib/permissions/evaluate";
import { assertCan } from "@/server/guard";
import { currentSectionId } from "@/modules/students/service";
import { isLinkedGuardian } from "@/modules/family/access";

export const DAYS = [
  { value: 1, label: "Monday", short: "Mon" }, { value: 2, label: "Tuesday", short: "Tue" }, { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" }, { value: 5, label: "Friday", short: "Fri" }, { value: 6, label: "Saturday", short: "Sat" },
] as const;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM");

export const slotInput = z.object({
  schoolId: z.string().min(1),
  label: z.string().trim().min(1, "Name the period").max(40),
  startTime: time,
  endTime: time,
  isBreak: z.boolean().default(false),
});

export async function listSlots(schoolId: string) {
  return prisma.periodSlot.findMany({ where: { schoolId }, orderBy: { order: "asc" } });
}

/** Adds a period at the end of the day. Periods may not overlap. */
export async function addSlot(actor: Actor, raw: z.input<typeof slotInput>) {
  const input = parseInput(slotInput, raw);
  assertCan(actor, "timetable.manage", { schoolId: input.schoolId });
  if (input.endTime <= input.startTime) throw invalid("The period must end after it starts.", { endTime: ["Must be after the start"] });
  const slots = await listSlots(input.schoolId);
  const clash = slots.find((s) => input.startTime < s.endTime && s.startTime < input.endTime);
  if (clash) throw conflict(`That overlaps ${clash.label} (${clash.startTime}–${clash.endTime}).`);
  const order = Math.max(0, ...slots.map((s) => s.order)) + 1;
  // Keep `order` equal to the time order so the grid always reads top to bottom.
  const sorted = [...slots, { ...input, order, id: "new" }].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return prisma.$transaction(async (tx) => {
    // Shift existing orders out of the way first (unique on schoolId+order), then renumber.
    for (const s of slots) await tx.periodSlot.update({ where: { id: s.id }, data: { order: s.order + 1000 } });
    let created: Awaited<ReturnType<typeof tx.periodSlot.create>> | null = null;
    for (const [i, s] of sorted.entries()) {
      if (s.id === "new") created = await tx.periodSlot.create({ data: { schoolId: input.schoolId, label: input.label, startTime: input.startTime, endTime: input.endTime, isBreak: input.isBreak, order: i + 1 } });
      else await tx.periodSlot.update({ where: { id: s.id }, data: { order: i + 1 } });
    }
    return created!;
  });
}

export async function removeSlot(actor: Actor, slotId: string) {
  const slot = await prisma.periodSlot.findUnique({ where: { id: slotId }, include: { _count: { select: { entries: true } } } });
  if (!slot) throw notFound("Period");
  assertCan(actor, "timetable.manage", { schoolId: slot.schoolId });
  if (slot._count.entries) throw conflict(`Clear the ${slot._count.entries} timetable entries in ${slot.label} first.`);
  await prisma.periodSlot.delete({ where: { id: slotId } });
}

type Grid = Record<number, Record<string, { subject: string; subjectId: string; teacher: string | null; teacherId: string | null; className?: string }>>;

function toGrid(entries: Prisma.TimetableEntryGetPayload<{ include: { subject: true; teacher: { select: { id: true; name: true } }; section: { include: { grade: true } } } }>[]): Grid {
  const grid: Grid = {};
  for (const e of entries) {
    (grid[e.dayOfWeek] ??= {})[e.slotId] = {
      subject: e.subject.name, subjectId: e.subjectId, teacher: e.teacher?.name ?? null, teacherId: e.teacherId,
      className: `${e.section.grade.name} - ${e.section.name}`,
    };
  }
  return grid;
}
const entryInclude = { subject: true, teacher: { select: { id: true, name: true } }, section: { include: { grade: true } } } as const;

/** One section's week. Any staff member who can read the school's academics may view it. */
export async function sectionTimetable(actor: Actor, sectionId: string) {
  const section = await prisma.section.findUnique({ where: { id: sectionId }, include: { grade: true } });
  if (!section || !canSchoolWide(actor, "academics.read", section.schoolId)) throw notFound("Class");
  const [slots, entries] = await Promise.all([
    listSlots(section.schoolId),
    prisma.timetableEntry.findMany({ where: { sectionId }, include: entryInclude }),
  ]);
  return { section: { id: section.id, schoolId: section.schoolId, name: `${section.grade.name} - ${section.name}` }, slots, grid: toGrid(entries) };
}

/** The child's class timetable, for a linked parent. */
export async function studentTimetable(actor: Actor, studentId: string) {
  if (!(await isLinkedGuardian(actor, studentId, "family.read"))) throw notFound("Student");
  const sectionId = await currentSectionId(studentId);
  if (!sectionId) return null;
  const section = await prisma.section.findUniqueOrThrow({ where: { id: sectionId }, include: { grade: true } });
  const [slots, entries] = await Promise.all([listSlots(section.schoolId), prisma.timetableEntry.findMany({ where: { sectionId }, include: entryInclude })]);
  return { section: { id: section.id, schoolId: section.schoolId, name: `${section.grade.name} - ${section.name}` }, slots, grid: toGrid(entries) };
}

/** A teacher's own week across all classes. */
export async function teacherTimetable(actor: Actor, schoolId: string) {
  const [slots, entries] = await Promise.all([
    listSlots(schoolId),
    prisma.timetableEntry.findMany({ where: { schoolId, teacherId: actor.userId }, include: entryInclude }),
  ]);
  return { slots, grid: toGrid(entries), periods: entries.length };
}

export const entryInput = z.object({
  sectionId: z.string().min(1),
  dayOfWeek: z.coerce.number().int().min(1).max(6),
  slotId: z.string().min(1),
  subjectId: blankToUndefined(z.string()), // empty clears the cell
  teacherId: blankToUndefined(z.string()),
});

/** Sets or clears one cell. A teacher can only be in one class per period (enforced by a unique index too). */
export async function setEntry(actor: Actor, raw: z.input<typeof entryInput>) {
  const input = parseInput(entryInput, raw);
  const section = await prisma.section.findUnique({ where: { id: input.sectionId }, include: { grade: true, school: { select: { organizationId: true } } } });
  if (!section) throw notFound("Class");
  assertCan(actor, "timetable.manage", { schoolId: section.schoolId });
  const slot = await prisma.periodSlot.findUnique({ where: { id: input.slotId } });
  if (!slot || slot.schoolId !== section.schoolId) throw invalid("Unknown period.");
  if (slot.isBreak) throw invalid(`${slot.label} is a break.`);
  const key = { sectionId_dayOfWeek_slotId: { sectionId: section.id, dayOfWeek: input.dayOfWeek, slotId: slot.id } };
  const day = DAYS.find((d) => d.value === input.dayOfWeek)!.label;

  if (!input.subjectId) {
    await prisma.timetableEntry.deleteMany({ where: { sectionId: section.id, dayOfWeek: input.dayOfWeek, slotId: slot.id } });
    return;
  }
  const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
  if (!subject || subject.schoolId !== section.schoolId) throw invalid("Choose a subject from this school.");
  if (input.teacherId) {
    const member = await prisma.userSchoolMembership.findFirst({ where: { userId: input.teacherId, schoolId: section.schoolId, status: "ACTIVE" } });
    if (!member) throw invalid("That teacher is not on this school's staff.");
    const busy = await prisma.timetableEntry.findFirst({
      where: { teacherId: input.teacherId, dayOfWeek: input.dayOfWeek, slotId: slot.id, NOT: { sectionId: section.id } },
      include: { section: { include: { grade: true } } },
    });
    if (busy) throw conflict(`That teacher already has ${busy.section.grade.name} - ${busy.section.name} on ${day}, ${slot.label}.`);
  }
  try {
    await prisma.timetableEntry.upsert({
      where: key,
      create: { schoolId: section.schoolId, sectionId: section.id, dayOfWeek: input.dayOfWeek, slotId: slot.id, subjectId: subject.id, teacherId: input.teacherId ?? null },
      update: { subjectId: subject.id, teacherId: input.teacherId ?? null },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw conflict("That teacher was just booked in another class for this period.");
    throw e;
  }
  await audit({
    actorUserId: actor.userId, organizationId: section.school.organizationId, schoolId: section.schoolId,
    action: "timetable.set", entityType: "Section", entityId: section.id,
    summary: `${section.grade.name}-${section.name} ${day} ${slot.label}: ${subject.name}`,
  });
}

/** Staff who can be put on the timetable: active members holding a teaching role. */
export async function timetableStaff(schoolId: string) {
  const rows = await prisma.userSchoolMembership.findMany({
    where: { schoolId, status: "ACTIVE", user: { roleAssignments: { some: { schoolId, role: { key: { in: ["teacher", "vice_principal", "principal"] } } } } } },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return rows.map((r) => r.user);
}
