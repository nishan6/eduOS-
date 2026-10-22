import "server-only";
import { z } from "zod";
import type { EnquiryStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/audit";
import { conflict, invalid, notFound } from "@/lib/errors";
import { blankToUndefined, parseInput } from "@/lib/validation";
import { canSchoolWide, type Actor } from "@/lib/permissions/evaluate";
import { assertCan } from "@/server/guard";
import { formatDocNumber, nextDocumentNumber } from "@/server/sequence";
import { fromDbDate, schoolToday, toDbDate } from "@/lib/dates";
import { createStudent } from "@/modules/students/service";

export const STAGES: EnquiryStage[] = ["NEW", "CONTACTED", "VISIT_SCHEDULED", "APPLIED", "OFFERED", "ADMITTED", "LOST"];
export const OPEN_STAGES: EnquiryStage[] = ["NEW", "CONTACTED", "VISIT_SCHEDULED", "APPLIED", "OFFERED"];
export const STAGE_LABEL: Record<EnquiryStage, string> = {
  NEW: "New", CONTACTED: "Contacted", VISIT_SCHEDULED: "Visit scheduled", APPLIED: "Applied", OFFERED: "Offered", ADMITTED: "Admitted", LOST: "Lost",
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");
const optionalDate = blankToUndefined(isoDate);
const optionalText = (max: number) => blankToUndefined(z.string().trim().max(max));

export const enquiryInput = z.object({
  schoolId: z.string().min(1),
  gradeId: z.string().min(1, "Choose the class applied for"),
  childFirstName: z.string().trim().min(1, "Child's first name is required").max(80),
  childLastName: z.string().trim().min(1, "Child's last name is required").max(80),
  dateOfBirth: optionalDate,
  gender: blankToUndefined(z.enum(["MALE", "FEMALE", "OTHER", "UNDISCLOSED"])),
  guardianName: z.string().trim().min(2, "Guardian name is required").max(120),
  phone: z.string().trim().regex(/^\+?[0-9]{10,13}$/, "Enter a 10–13 digit phone number"),
  email: blankToUndefined(z.email("Enter a valid email")),
  source: optionalText(60),
  followUpOn: optionalDate,
  note: optionalText(1000),
});

async function loadEnquiry(actor: Actor, enquiryId: string, permission: "admissions.read" | "admissions.manage") {
  const e = await prisma.admissionEnquiry.findUnique({ where: { id: enquiryId }, include: { school: { select: { organizationId: true, code: true } } } });
  if (!e || !canSchoolWide(actor, "admissions.read", e.schoolId)) throw notFound("Enquiry");
  assertCan(actor, permission, { schoolId: e.schoolId });
  return e;
}

export async function createEnquiry(actor: Actor, raw: z.input<typeof enquiryInput>) {
  const input = parseInput(enquiryInput, raw);
  assertCan(actor, "admissions.manage", { schoolId: input.schoolId });
  const [school, grade, year] = await Promise.all([
    prisma.school.findUniqueOrThrow({ where: { id: input.schoolId } }),
    prisma.grade.findUnique({ where: { id: input.gradeId } }),
    prisma.academicYear.findFirst({ where: { schoolId: input.schoolId, isCurrent: true } }),
  ]);
  if (!grade || grade.schoolId !== input.schoolId) throw invalid("Choose a class from this school.", { gradeId: ["Unknown class"] });
  if (!year) throw invalid("Set a current academic year first.");

  // Same phone and child name with an open enquiry is almost always a duplicate walk-in.
  const dup = await prisma.admissionEnquiry.findFirst({
    where: { schoolId: input.schoolId, phone: input.phone, childFirstName: { equals: input.childFirstName, mode: "insensitive" }, stage: { in: OPEN_STAGES } },
  });
  if (dup) throw conflict(`An open enquiry for ${dup.childFirstName} with this phone number already exists (${dup.number}).`);

  return prisma.$transaction(async (tx) => {
    const n = await nextDocumentNumber(tx, school.id, "enquiry");
    const enquiry = await tx.admissionEnquiry.create({
      data: {
        schoolId: school.id, academicYearId: year.id, gradeId: grade.id, number: formatDocNumber("ENQ", school.code, n),
        childFirstName: input.childFirstName, childLastName: input.childLastName,
        dateOfBirth: input.dateOfBirth ? toDbDate(input.dateOfBirth) : null, gender: input.gender ?? null,
        guardianName: input.guardianName, phone: input.phone, email: input.email ?? null, source: input.source ?? null,
        followUpOn: input.followUpOn ? toDbDate(input.followUpOn) : null, createdById: actor.userId,
        activities: { create: { text: input.note ?? "Enquiry received", toStage: "NEW", byId: actor.userId } },
      },
    });
    await audit({
      actorUserId: actor.userId, organizationId: school.organizationId, schoolId: school.id,
      action: "admissions.enquiry.create", entityType: "AdmissionEnquiry", entityId: enquiry.id,
      summary: `Logged enquiry ${enquiry.number} for ${grade.name}`,
    }, tx);
    return enquiry;
  });
}

/** Pipeline view: counts by stage, follow-ups due, and a filtered list. */
export async function listEnquiries(actor: Actor, schoolId: string, opts: { stage?: EnquiryStage | "OPEN"; q?: string } = {}) {
  assertCan(actor, "admissions.read", { schoolId });
  const today = toDbDate(schoolToday());
  const q = opts.q?.trim();
  const where: Prisma.AdmissionEnquiryWhereInput = {
    schoolId,
    academicYear: { isCurrent: true },
    ...(opts.stage === "OPEN" || !opts.stage ? { stage: { in: OPEN_STAGES } } : { stage: opts.stage }),
    ...(q ? { OR: [
      { childFirstName: { contains: q, mode: "insensitive" } }, { childLastName: { contains: q, mode: "insensitive" } },
      { guardianName: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { number: { contains: q, mode: "insensitive" } },
    ] } : {}),
  };
  const [rows, counts, dueToday] = await Promise.all([
    prisma.admissionEnquiry.findMany({ where, include: { grade: true }, orderBy: [{ followUpOn: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 100 }),
    prisma.admissionEnquiry.groupBy({ by: ["stage"], where: { schoolId, academicYear: { isCurrent: true } }, _count: { _all: true } }),
    prisma.admissionEnquiry.count({ where: { schoolId, stage: { in: OPEN_STAGES }, followUpOn: { lte: today } } }),
  ]);
  const byStage = Object.fromEntries(STAGES.map((s) => [s, counts.find((c) => c.stage === s)?._count._all ?? 0])) as Record<EnquiryStage, number>;
  return {
    byStage,
    dueToday,
    canManage: canSchoolWide(actor, "admissions.manage", schoolId),
    rows: rows.map((e) => ({
      id: e.id, number: e.number, child: `${e.childFirstName} ${e.childLastName}`, grade: e.grade.name,
      guardianName: e.guardianName, phone: e.phone, stage: e.stage, source: e.source,
      followUpOn: e.followUpOn ? fromDbDate(e.followUpOn) : null, createdAt: e.createdAt,
    })),
  };
}

export async function getEnquiry(actor: Actor, enquiryId: string) {
  const e = await loadEnquiry(actor, enquiryId, "admissions.read");
  const full = await prisma.admissionEnquiry.findUniqueOrThrow({
    where: { id: e.id },
    include: { grade: true, academicYear: true, student: { select: { id: true, admissionNo: true } }, activities: { include: { by: { select: { name: true } } }, orderBy: { createdAt: "desc" } } },
  });
  return {
    ...full,
    dateOfBirth: full.dateOfBirth ? fromDbDate(full.dateOfBirth) : null,
    followUpOn: full.followUpOn ? fromDbDate(full.followUpOn) : null,
    canManage: canSchoolWide(actor, "admissions.manage", e.schoolId),
  };
}

export const moveStageInput = z.object({
  enquiryId: z.string().min(1),
  toStage: z.enum(["NEW", "CONTACTED", "VISIT_SCHEDULED", "APPLIED", "OFFERED", "LOST"]),
  note: optionalText(1000),
  followUpOn: optionalDate,
  lostReason: optionalText(200),
});

/** Moves an enquiry along the pipeline. Admission happens only through conversion. */
export async function moveStage(actor: Actor, raw: z.input<typeof moveStageInput>) {
  const input = parseInput(moveStageInput, raw);
  const e = await loadEnquiry(actor, input.enquiryId, "admissions.manage");
  if (e.stage === "ADMITTED") throw conflict("This enquiry has already been admitted.");
  if (e.stage === input.toStage) throw invalid("The enquiry is already at that stage.");
  if (input.toStage === "LOST" && !input.lostReason) throw invalid("Say why the enquiry was lost.", { lostReason: ["Required"] });

  await prisma.$transaction(async (tx) => {
    const r = await tx.admissionEnquiry.updateMany({
      where: { id: e.id, stage: e.stage },
      data: {
        stage: input.toStage,
        lostReason: input.toStage === "LOST" ? input.lostReason : null,
        followUpOn: input.toStage === "LOST" ? null : input.followUpOn ? toDbDate(input.followUpOn) : e.followUpOn,
      },
    });
    if (r.count === 0) throw conflict("Someone else just updated this enquiry. Reload and try again.");
    await tx.admissionActivity.create({
      data: { enquiryId: e.id, fromStage: e.stage, toStage: input.toStage, byId: actor.userId, text: input.toStage === "LOST" ? `Lost: ${input.lostReason}` : input.note ?? `Moved to ${STAGE_LABEL[input.toStage]}` },
    });
    await audit({
      actorUserId: actor.userId, organizationId: e.school.organizationId, schoolId: e.schoolId,
      action: "admissions.enquiry.stage", entityType: "AdmissionEnquiry", entityId: e.id,
      summary: `${e.number}: ${STAGE_LABEL[e.stage]} → ${STAGE_LABEL[input.toStage]}`,
    }, tx);
  });
}

export async function addEnquiryNote(actor: Actor, enquiryId: string, text: string, followUpOn?: string) {
  const e = await loadEnquiry(actor, enquiryId, "admissions.manage");
  const note = parseInput(z.string().trim().min(2, "Write a note").max(1000), text);
  const follow = followUpOn ? parseInput(isoDate, followUpOn) : undefined;
  await prisma.$transaction([
    prisma.admissionActivity.create({ data: { enquiryId: e.id, text: note, byId: actor.userId } }),
    ...(follow ? [prisma.admissionEnquiry.update({ where: { id: e.id }, data: { followUpOn: toDbDate(follow) } })] : []),
  ]);
}

export const convertInput = z.object({
  enquiryId: z.string().min(1),
  admissionNo: z.string().trim().min(1, "Admission number is required").max(40),
  sectionId: z.string().min(1, "Choose a section"),
  dateOfBirth: isoDate,
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNDISCLOSED"]),
  relation: z.enum(["FATHER", "MOTHER", "GUARDIAN", "GRANDPARENT", "SIBLING", "OTHER"]),
});

/**
 * Admits the child: creates the student, enrollment and guardian link through the normal
 * student service, and marks the enquiry ADMITTED in the same transaction.
 */
export async function convertEnquiry(actor: Actor, raw: z.input<typeof convertInput>) {
  const input = parseInput(convertInput, raw);
  const e = await loadEnquiry(actor, input.enquiryId, "admissions.manage");
  if (e.stage === "ADMITTED" || e.studentId) throw conflict("This enquiry has already been admitted.");
  if (e.stage === "LOST") throw conflict("Reopen the enquiry before admitting.");

  const { student } = await createStudent(actor, {
    schoolId: e.schoolId, admissionNo: input.admissionNo, firstName: e.childFirstName, lastName: e.childLastName,
    dateOfBirth: input.dateOfBirth, gender: input.gender, sectionId: input.sectionId,
    guardian: { name: e.guardianName, phone: e.phone, email: e.email ?? undefined, relation: input.relation, isPrimary: true },
  }, async (tx, studentId) => {
    const r = await tx.admissionEnquiry.updateMany({
      where: { id: e.id, studentId: null, stage: { in: OPEN_STAGES } },
      data: { stage: "ADMITTED", studentId, followUpOn: null },
    });
    if (r.count === 0) throw conflict("This enquiry was just admitted or closed by someone else.");
    await tx.admissionActivity.create({ data: { enquiryId: e.id, fromStage: e.stage, toStage: "ADMITTED", byId: actor.userId, text: `Admitted as ${input.admissionNo}` } });
  });
  return student;
}
