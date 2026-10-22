import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/audit";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { parseInput } from "@/lib/validation";
import { can, sectionFilter, type Actor } from "@/lib/permissions/evaluate";
import { assertCan } from "@/server/guard";
import { toDbDate } from "@/lib/dates";
import { isLinkedGuardian } from "@/modules/family/access";

export const PAGE_SIZE = 25;

const phone = z.string().trim().regex(/^\+?[0-9]{10,13}$/, "Enter a 10–13 digit phone number");

export const guardianInput = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  phone,
  email: z.email("Enter a valid email").optional().or(z.literal("").transform(() => undefined)),
  relation: z.enum(["FATHER", "MOTHER", "GUARDIAN", "GRANDPARENT", "SIBLING", "OTHER"]),
  isPrimary: z.boolean().default(true),
});

export const createStudentInput = z.object({
  schoolId: z.string().min(1),
  admissionNo: z.string().trim().min(1, "Admission number is required").max(40),
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNDISCLOSED"]),
  sectionId: z.string().min(1, "Choose a class and section"),
  rollNo: z.coerce.number().int().positive().optional(),
  guardian: guardianInput.optional(),
});
export type CreateStudentInput = z.input<typeof createStudentInput>;


async function loadSection(sectionId: string) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { grade: true, academicYear: true },
  });
  if (!section) throw notFound("Section");
  return section;
}

/**
 * Admits a student. `withinTx` runs inside the same transaction after the student exists, so
 * callers such as admissions conversion can link records atomically.
 */
export async function createStudent(
  actor: Actor,
  raw: CreateStudentInput,
  withinTx?: (tx: Prisma.TransactionClient, studentId: string) => Promise<void>,
) {
  const input = parseInput(createStudentInput, raw);
  const scope = { schoolId: input.schoolId };
  assertCan(actor, "students.create", scope);
  assertCan(actor, "enrollment.manage", scope);
  if (input.guardian) assertCan(actor, "guardians.manage", scope);

  const section = await loadSection(input.sectionId);
  if (section.schoolId !== input.schoolId) throw forbidden("That section belongs to a different school.");
  const school = await prisma.school.findUniqueOrThrow({ where: { id: input.schoolId } });

  const dup = await prisma.student.findUnique({
    where: { schoolId_admissionNo: { schoolId: input.schoolId, admissionNo: input.admissionNo } },
  });
  if (dup) throw conflict(`Admission number ${input.admissionNo} is already used by ${dup.firstName} ${dup.lastName}.`);

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.create({
      data: {
        schoolId: input.schoolId,
        admissionNo: input.admissionNo,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: toDbDate(input.dateOfBirth),
        gender: input.gender,
        statusHistory: { create: { toStatus: "ACTIVE", reason: "Admitted", changedById: actor.userId } },
        enrollments: {
          create: { academicYearId: section.academicYearId, sectionId: section.id, rollNo: input.rollNo },
        },
      },
    });

    let guardianId: string | null = null;
    if (input.guardian) {
      // One guardian record per phone number per organization: reuse instead of duplicating.
      const g = await tx.guardian.upsert({
        where: { organizationId_phone: { organizationId: school.organizationId, phone: input.guardian.phone } },
        create: {
          organizationId: school.organizationId,
          name: input.guardian.name,
          phone: input.guardian.phone,
          email: input.guardian.email,
        },
        update: {},
      });
      guardianId = g.id;
      await tx.studentGuardianRelationship.create({
        data: { studentId: student.id, guardianId: g.id, relation: input.guardian.relation, isPrimary: input.guardian.isPrimary },
      });
    }

    await audit(
      {
        actorUserId: actor.userId,
        organizationId: school.organizationId,
        schoolId: school.id,
        action: "student.create",
        entityType: "Student",
        entityId: student.id,
        summary: `Admitted ${student.admissionNo} into ${section.grade.name}-${section.name} (${section.academicYear.name})`,
        metadata: { sectionId: section.id, guardianId },
      },
      tx,
    );
    if (withinTx) await withinTx(tx, student.id);
    return { student, guardianId };
  });
}

export type StudentListFilters = { q?: string; sectionId?: string; page?: number; status?: string };

export async function listStudents(actor: Actor, schoolId: string, filters: StudentListFilters = {}) {
  const sections = sectionFilter(actor, "students.read", schoolId);
  if (sections !== "all" && sections.length === 0) throw forbidden();
  const page = Math.max(1, filters.page ?? 1);
  const q = filters.q?.trim();

  const enrollmentWhere: Prisma.StudentEnrollmentWhereInput = {
    status: "ACTIVE",
    academicYear: { isCurrent: true },
    ...(sections === "all" ? {} : { sectionId: { in: sections } }),
    ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
  };
  if (sections !== "all" && filters.sectionId && !sections.includes(filters.sectionId)) throw forbidden();

  const where: Prisma.StudentWhereInput = {
    schoolId,
    ...(filters.status ? { status: filters.status as Prisma.EnumStudentStatusFilter["equals"] } : {}),
    ...(sections !== "all" || filters.sectionId ? { enrollments: { some: enrollmentWhere } } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { admissionNo: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        enrollments: {
          where: { academicYear: { isCurrent: true } },
          include: { section: { include: { grade: true } } },
          take: 1,
        },
        guardians: { where: { isPrimary: true }, include: { guardian: { select: { name: true } } }, take: 1 },
      },
    }),
  ]);

  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    items: rows.map((s) => {
      const e = s.enrollments[0];
      return {
        id: s.id,
        admissionNo: s.admissionNo,
        name: `${s.firstName} ${s.lastName}`,
        status: s.status,
        className: e ? `${e.section.grade.name} - ${e.section.name}` : "Not enrolled",
        rollNo: e?.rollNo ?? null,
        primaryGuardian: s.guardians[0]?.guardian.name ?? null,
      };
    }),
  };
}

/** Section of the student's current enrollment, used for ASSIGNED-scope checks. */
export async function currentSectionId(studentId: string) {
  const e = await prisma.studentEnrollment.findFirst({
    where: { studentId, academicYear: { isCurrent: true } },
    select: { sectionId: true },
  });
  return e?.sectionId ?? null;
}

/** Staff or linked guardian may read; everyone else gets NOT_FOUND (do not reveal existence). */
export async function assertCanReadStudent(actor: Actor, studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true } });
  if (!student) throw notFound("Student");
  const sectionId = await currentSectionId(studentId);
  if (can(actor, "students.read", { schoolId: student.schoolId, sectionId })) return { ...student, via: "staff" as const };
  if (await isLinkedGuardian(actor, studentId, "students.read")) return { ...student, via: "family" as const };
  throw notFound("Student");
}

export async function getStudentProfile(actor: Actor, studentId: string) {
  const access = await assertCanReadStudent(actor, studentId);
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    include: {
      school: { select: { id: true, name: true, code: true, board: true, organizationId: true } },
      enrollments: {
        include: { section: { include: { grade: true } }, academicYear: true },
        orderBy: { enrolledAt: "desc" },
      },
      guardians: { include: { guardian: { include: { user: { select: { id: true, email: true, status: true } } } } } },
      statusHistory: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  // Families only see guardians on their own account, plus non-contact names.
  return { student, access: access.via };
}

export const linkGuardianInput = z.object({ studentId: z.string().min(1), guardian: guardianInput });

export async function linkGuardian(actor: Actor, raw: z.input<typeof linkGuardianInput>) {
  const input = parseInput(linkGuardianInput, raw);
  const student = await prisma.student.findUnique({ where: { id: input.studentId }, include: { school: true } });
  if (!student) throw notFound("Student");
  assertCan(actor, "guardians.manage", { schoolId: student.schoolId });

  return prisma.$transaction(async (tx) => {
    const g = await tx.guardian.upsert({
      where: { organizationId_phone: { organizationId: student.school.organizationId, phone: input.guardian.phone } },
      create: {
        organizationId: student.school.organizationId,
        name: input.guardian.name,
        phone: input.guardian.phone,
        email: input.guardian.email,
      },
      update: {},
    });
    const existing = await tx.studentGuardianRelationship.findUnique({
      where: { studentId_guardianId: { studentId: student.id, guardianId: g.id } },
    });
    if (existing) throw conflict(`${g.name} is already linked to this student.`);
    if (input.guardian.isPrimary) {
      await tx.studentGuardianRelationship.updateMany({ where: { studentId: student.id }, data: { isPrimary: false } });
    }
    const rel = await tx.studentGuardianRelationship.create({
      data: { studentId: student.id, guardianId: g.id, relation: input.guardian.relation, isPrimary: input.guardian.isPrimary },
    });
    await audit(
      {
        actorUserId: actor.userId,
        organizationId: student.school.organizationId,
        schoolId: student.schoolId,
        action: "guardian.link",
        entityType: "Student",
        entityId: student.id,
        summary: `Linked guardian ${g.name} (${input.guardian.relation.toLowerCase()}) to ${student.admissionNo}`,
        metadata: { guardianId: g.id, relationId: rel.id },
      },
      tx,
    );
    return { guardianId: g.id };
  });
}

export const enrollInput = z.object({
  studentId: z.string().min(1),
  sectionId: z.string().min(1),
  rollNo: z.coerce.number().int().positive().optional(),
});

/** Enroll (or move) a student into a section for that section's academic year. */
export async function enrollStudent(actor: Actor, raw: z.input<typeof enrollInput>) {
  const input = parseInput(enrollInput, raw);
  const student = await prisma.student.findUnique({ where: { id: input.studentId }, include: { school: true } });
  if (!student) throw notFound("Student");
  assertCan(actor, "enrollment.manage", { schoolId: student.schoolId });
  const section = await loadSection(input.sectionId);
  if (section.schoolId !== student.schoolId) throw forbidden("That section belongs to a different school.");

  return prisma.$transaction(async (tx) => {
    const enrollment = await tx.studentEnrollment.upsert({
      where: { studentId_academicYearId: { studentId: student.id, academicYearId: section.academicYearId } },
      create: { studentId: student.id, academicYearId: section.academicYearId, sectionId: section.id, rollNo: input.rollNo },
      update: { sectionId: section.id, rollNo: input.rollNo, status: "ACTIVE" },
    });
    await audit(
      {
        actorUserId: actor.userId,
        organizationId: student.school.organizationId,
        schoolId: student.schoolId,
        action: "student.enroll",
        entityType: "Student",
        entityId: student.id,
        summary: `Enrolled ${student.admissionNo} in ${section.grade.name}-${section.name} (${section.academicYear.name})`,
        metadata: { sectionId: section.id },
      },
      tx,
    );
    return enrollment;
  });
}

/** Sections in the school's current academic year, for pickers. */
export async function listCurrentSections(schoolId: string) {
  return prisma.section.findMany({
    where: { schoolId, academicYear: { isCurrent: true } },
    include: { grade: true, academicYear: true },
    orderBy: [{ grade: { order: "asc" } }, { name: "asc" }],
  });
}
