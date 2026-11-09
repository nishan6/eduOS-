import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/audit";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { blankToUndefined, parseInput } from "@/lib/validation";
import { can, canSchoolWide, sectionFilter, type Actor } from "@/lib/permissions/evaluate";
import { assertCan } from "@/server/guard";
import { fromDbDate, toDbDate } from "@/lib/dates";
import { currentSectionId } from "@/modules/students/service";
import { isLinkedGuardian } from "@/modules/family/access";
import { summarise, validateMark, type SubjectResult } from "./calc";

const toNum = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));

// ---------------------------------------------------------------------------
// Exam setup (principal / academic coordinator)
// ---------------------------------------------------------------------------

export const createExamInput = z.object({
  schoolId: z.string().min(1),
  name: z.string().trim().min(2, "Name the exam").max(80),
  startsOn: blankToUndefined(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")),
  gradeIds: z.array(z.string().min(1)).min(1, "Choose at least one class"),
  subjects: z.array(z.object({ subjectId: z.string().min(1), maxMarks: z.coerce.number().int().min(5).max(200) })).min(1, "Choose at least one subject"),
});

/** Creates an exam with one paper per (section, subject) for every current section of the chosen classes. */
export async function createExam(actor: Actor, raw: z.input<typeof createExamInput>) {
  const input = parseInput(createExamInput, raw);
  assertCan(actor, "exams.manage", { schoolId: input.schoolId });
  const year = await prisma.academicYear.findFirst({ where: { schoolId: input.schoolId, isCurrent: true }, include: { school: true } });
  if (!year) throw invalid("Set a current academic year first.");
  if (await prisma.exam.findUnique({ where: { academicYearId_name: { academicYearId: year.id, name: input.name } } }))
    throw conflict(`An exam called "${input.name}" already exists for ${year.name}.`);

  const subjectIds = [...new Set(input.subjects.map((s) => s.subjectId))];
  if (subjectIds.length !== input.subjects.length) throw invalid("Each subject can appear once.");
  const subjects = await prisma.subject.findMany({ where: { id: { in: subjectIds }, schoolId: input.schoolId } });
  if (subjects.length !== subjectIds.length) throw invalid("One of the subjects belongs to a different school.");
  const sections = await prisma.section.findMany({ where: { schoolId: input.schoolId, academicYearId: year.id, gradeId: { in: input.gradeIds } } });
  if (sections.length === 0) throw invalid("None of the chosen classes have sections this year.");

  return prisma.$transaction(async (tx) => {
    const exam = await tx.exam.create({
      data: {
        schoolId: input.schoolId, academicYearId: year.id, name: input.name, startsOn: input.startsOn ? toDbDate(input.startsOn) : null,
        gradingScale: year.school.gradingScale, passPercent: year.school.passPercent, createdById: actor.userId,
      },
    });
    await tx.examPaper.createMany({
      data: sections.flatMap((sec) => input.subjects.map((s) => ({ examId: exam.id, schoolId: input.schoolId, sectionId: sec.id, subjectId: s.subjectId, maxMarks: s.maxMarks }))),
    });
    await audit({
      actorUserId: actor.userId, organizationId: year.school.organizationId, schoolId: input.schoolId,
      action: "exam.create", entityType: "Exam", entityId: exam.id,
      summary: `Created exam "${exam.name}" with ${sections.length * input.subjects.length} papers`,
    }, tx);
    return exam;
  });
}

/** Exams in the current year visible to the actor, with paper progress for the sections they can see. */
export async function listExams(actor: Actor, schoolId: string) {
  const filter = sectionFilter(actor, "exams.read", schoolId);
  if (filter !== "all" && filter.length === 0) throw forbidden();
  const exams = await prisma.exam.findMany({
    where: { schoolId, academicYear: { isCurrent: true }, ...(filter === "all" ? {} : { papers: { some: { sectionId: { in: filter } } } }) },
    include: { papers: { where: filter === "all" ? {} : { sectionId: { in: filter } }, select: { status: true } } },
    orderBy: { createdAt: "desc" },
  });
  return exams.map((e) => ({
    id: e.id, name: e.name, status: e.status, startsOn: e.startsOn ? fromDbDate(e.startsOn) : null,
    papers: e.papers.length, submitted: e.papers.filter((p) => p.status === "SUBMITTED").length,
  }));
}

/** Exam detail: every visible paper with entry progress, plus class results once marks exist. */
export async function getExam(actor: Actor, examId: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId }, include: { academicYear: true } });
  if (!exam) throw notFound("Exam");
  const filter = sectionFilter(actor, "exams.read", exam.schoolId);
  if (filter !== "all" && filter.length === 0) throw notFound("Exam");
  const papers = await prisma.examPaper.findMany({
    where: { examId, ...(filter === "all" ? {} : { sectionId: { in: filter } }) },
    include: {
      section: { include: { grade: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } },
      subject: true,
      marks: { select: { marks: true, isAbsent: true } },
    },
    orderBy: [{ section: { grade: { order: "asc" } } }, { section: { name: "asc" } }, { subject: { name: "asc" } }],
  });
  if (filter !== "all" && papers.length === 0) throw notFound("Exam");
  return {
    id: exam.id, name: exam.name, status: exam.status, academicYear: exam.academicYear.name, schoolId: exam.schoolId,
    publishedAt: exam.publishedAt,
    canManage: canSchoolWide(actor, "exams.manage", exam.schoolId),
    papers: papers.map((p) => {
      const scored = p.marks.filter((m) => !m.isAbsent && m.marks !== null).map((m) => Number(m.marks));
      return {
        id: p.id, status: p.status, maxMarks: p.maxMarks, subject: p.subject.name,
        sectionId: p.sectionId, className: `${p.section.grade.name} - ${p.section.name}`,
        students: p.section._count.enrollments, entered: p.marks.length,
        average: scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10 : null,
        canEnter: exam.status === "OPEN" && can(actor, "marks.enter", { schoolId: exam.schoolId, sectionId: p.sectionId }),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Marks entry (teachers, for their assigned sections)
// ---------------------------------------------------------------------------

async function loadPaper(paperId: string) {
  const paper = await prisma.examPaper.findUnique({
    where: { id: paperId },
    include: { exam: { include: { school: { select: { organizationId: true } } } }, section: { include: { grade: true } }, subject: true },
  });
  if (!paper) throw notFound("Paper");
  return paper;
}

export async function getPaper(actor: Actor, paperId: string) {
  const paper = await loadPaper(paperId);
  const scope = { schoolId: paper.schoolId, sectionId: paper.sectionId };
  if (!can(actor, "exams.read", scope) && !can(actor, "marks.enter", scope)) throw notFound("Paper");
  const [enrollments, marks] = await Promise.all([
    prisma.studentEnrollment.findMany({
      where: { sectionId: paper.sectionId, status: "ACTIVE", student: { status: "ACTIVE" } },
      include: { student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } } },
      orderBy: [{ rollNo: "asc" }, { student: { firstName: "asc" } }],
    }),
    prisma.examMark.findMany({ where: { paperId } }),
  ]);
  const byStudent = new Map(marks.map((m) => [m.studentId, m]));
  return {
    id: paper.id, examId: paper.examId, examName: paper.exam.name, examStatus: paper.exam.status,
    subject: paper.subject.name, className: `${paper.section.grade.name} - ${paper.section.name}`,
    maxMarks: paper.maxMarks, status: paper.status,
    canEnter: paper.exam.status === "OPEN" && paper.status === "OPEN" && can(actor, "marks.enter", scope),
    canReopen: paper.exam.status === "OPEN" && paper.status === "SUBMITTED" && canSchoolWide(actor, "exams.manage", paper.schoolId),
    students: enrollments.map((e) => {
      const m = byStudent.get(e.studentId);
      return {
        id: e.studentId, rollNo: e.rollNo, admissionNo: e.student.admissionNo,
        name: `${e.student.firstName} ${e.student.lastName}`,
        marks: m ? toNum(m.marks) : null, isAbsent: m?.isAbsent ?? false, entered: !!m,
      };
    }),
  };
}

export const saveMarksInput = z.object({
  paperId: z.string().min(1),
  submit: z.boolean().default(false),
  entries: z.array(z.object({
    studentId: z.string().min(1),
    marks: z.number().nullable(),
    isAbsent: z.boolean().default(false),
  })).max(200),
});

export async function saveMarks(actor: Actor, raw: z.input<typeof saveMarksInput>) {
  const input = parseInput(saveMarksInput, raw);
  const paper = await loadPaper(input.paperId);
  assertCan(actor, "marks.enter", { schoolId: paper.schoolId, sectionId: paper.sectionId }, "You can only enter marks for your own classes.");
  if (paper.exam.status !== "OPEN") throw conflict("Results for this exam are published; marks are locked.");
  if (paper.status !== "OPEN") throw conflict("These marks were submitted. Ask the principal to reopen the paper to change them.");

  const enrolled = new Set((await prisma.studentEnrollment.findMany({
    where: { sectionId: paper.sectionId, status: "ACTIVE", student: { status: "ACTIVE" } }, select: { studentId: true },
  })).map((e) => e.studentId));

  const fieldErrors: Record<string, string[]> = {};
  for (const e of input.entries) {
    if (!enrolled.has(e.studentId)) throw invalid("One of the students is not enrolled in this class.");
    if (e.isAbsent) continue;
    if (e.marks === null) continue;
    const err = validateMark(e.marks, paper.maxMarks);
    if (err) fieldErrors[e.studentId] = [err];
  }
  if (Object.keys(fieldErrors).length) throw invalid("Some marks need correcting.", fieldErrors);

  const toSave = input.entries.filter((e) => e.isAbsent || e.marks !== null);
  if (input.submit) {
    const covered = new Set(toSave.map((e) => e.studentId));
    const existing = await prisma.examMark.findMany({ where: { paperId: paper.id }, select: { studentId: true } });
    for (const m of existing) covered.add(m.studentId);
    const missing = [...enrolled].filter((id) => !covered.has(id)).length;
    if (missing) throw invalid(`Enter marks or mark absent for every student before submitting (${missing} missing).`);
  }

  await prisma.$transaction(async (tx) => {
    // Guard against a concurrent submit or publish between our checks and the write.
    const locked = await tx.$queryRaw<{ status: string; examStatus: string }[]>`
      SELECT p."status"::text AS status, e."status"::text AS "examStatus"
      FROM "ExamPaper" p JOIN "Exam" e ON e.id = p."examId" WHERE p.id = ${paper.id} FOR UPDATE OF p`;
    if (locked[0]?.status !== "OPEN" || locked[0]?.examStatus !== "OPEN") throw conflict("This paper was just submitted or published. Reload to see the latest marks.");
    for (const e of toSave) {
      const marks = e.isAbsent ? null : new Prisma.Decimal(e.marks!);
      await tx.examMark.upsert({
        where: { paperId_studentId: { paperId: paper.id, studentId: e.studentId } },
        create: { paperId: paper.id, studentId: e.studentId, marks, isAbsent: e.isAbsent, enteredById: actor.userId },
        update: { marks, isAbsent: e.isAbsent, enteredById: actor.userId },
      });
    }
    if (input.submit) {
      await tx.examPaper.update({ where: { id: paper.id }, data: { status: "SUBMITTED", submittedAt: new Date(), submittedById: actor.userId } });
    }
    await audit({
      actorUserId: actor.userId, organizationId: paper.exam.school.organizationId, schoolId: paper.schoolId,
      action: input.submit ? "marks.submit" : "marks.save", entityType: "ExamPaper", entityId: paper.id,
      summary: `${input.submit ? "Submitted" : "Saved"} ${paper.subject.name} marks for ${paper.section.grade.name}-${paper.section.name} (${paper.exam.name})`,
      metadata: { count: toSave.length },
    }, tx);
  });
}

export async function reopenPaper(actor: Actor, paperId: string, reason: string) {
  const paper = await loadPaper(paperId);
  assertCan(actor, "exams.manage", { schoolId: paper.schoolId });
  if (reason.trim().length < 3) throw invalid("Give a reason for reopening.");
  if (paper.exam.status !== "OPEN") throw conflict("Results are published; this paper can no longer be reopened.");
  const r = await prisma.examPaper.updateMany({ where: { id: paper.id, status: "SUBMITTED" }, data: { status: "OPEN", submittedAt: null, submittedById: null } });
  if (r.count === 0) throw conflict("This paper is already open.");
  await audit({
    actorUserId: actor.userId, organizationId: paper.exam.school.organizationId, schoolId: paper.schoolId,
    action: "marks.reopen", entityType: "ExamPaper", entityId: paper.id,
    summary: `Reopened ${paper.subject.name} marks for ${paper.section.grade.name}-${paper.section.name} (${paper.exam.name}): ${reason.trim()}`,
  });
}

/** Publishes results to families. Every paper must be submitted. Marks are locked afterwards. */
export async function publishExam(actor: Actor, examId: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId }, include: { school: { select: { organizationId: true } } } });
  if (!exam) throw notFound("Exam");
  assertCan(actor, "exams.manage", { schoolId: exam.schoolId });
  const pending = await prisma.examPaper.count({ where: { examId, status: "OPEN" } });
  if (pending) throw invalid(`${pending} paper${pending === 1 ? " is" : "s are"} still waiting for marks.`);

  return prisma.$transaction(async (tx) => {
    const r = await tx.exam.updateMany({ where: { id: examId, status: "OPEN" }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    if (r.count === 0) throw conflict("This exam is already published.");
    const sectionIds = (await tx.examPaper.findMany({ where: { examId }, select: { sectionId: true }, distinct: ["sectionId"] })).map((p) => p.sectionId);
    const links = await tx.studentGuardianRelationship.findMany({
      where: {
        student: { status: "ACTIVE", enrollments: { some: { sectionId: { in: sectionIds }, status: "ACTIVE" } } },
        guardian: { userId: { not: null } },
      },
      select: { studentId: true, student: { select: { firstName: true } }, guardian: { select: { userId: true } } },
    });
    if (links.length) {
      await tx.notification.createMany({
        data: links.map((l) => ({
          userId: l.guardian.userId!, schoolId: exam.schoolId,
          title: `${exam.name} results for ${l.student.firstName}`,
          body: "The report card is now available.",
          href: `/app/family/children/${l.studentId}/results/${exam.id}`,
        })),
      });
    }
    await audit({
      actorUserId: actor.userId, organizationId: exam.school.organizationId, schoolId: exam.schoolId,
      action: "exam.publish", entityType: "Exam", entityId: exam.id, summary: `Published results for "${exam.name}"`,
    }, tx);
  });
}

// ---------------------------------------------------------------------------
// Results and report cards
// ---------------------------------------------------------------------------

/** Staff with exams.read on the student's section see all exams; linked guardians only published ones. */
async function resultsAccess(actor: Actor, studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, schoolId: true, firstName: true, lastName: true, admissionNo: true, school: { select: { name: true, board: true } } },
  });
  if (!student) throw notFound("Student");
  const sectionId = await currentSectionId(studentId);
  if (can(actor, "exams.read", { schoolId: student.schoolId, sectionId })) return { student, sectionId, publishedOnly: false };
  if (await isLinkedGuardian(actor, studentId, "exams.read")) return { student, sectionId, publishedOnly: true };
  throw notFound("Student");
}

async function resultsFor(studentId: string, sectionId: string, examFilter: Prisma.ExamWhereInput) {
  const papers = await prisma.examPaper.findMany({
    where: { sectionId, exam: examFilter },
    include: { subject: true, exam: true, marks: { where: { studentId } } },
    orderBy: [{ exam: { createdAt: "asc" } }, { subject: { name: "asc" } }],
  });
  const byExam = new Map<string, { exam: (typeof papers)[number]["exam"]; rows: SubjectResult[] }>();
  for (const p of papers) {
    const entry = byExam.get(p.examId) ?? { exam: p.exam, rows: [] };
    const m = p.marks[0];
    entry.rows.push({ subject: p.subject.name, maxMarks: p.maxMarks, marks: m ? toNum(m.marks) : null, isAbsent: m?.isAbsent ?? false });
    byExam.set(p.examId, entry);
  }
  return [...byExam.values()].map(({ exam, rows }) => ({
    examId: exam.id, examName: exam.name, status: exam.status, publishedAt: exam.publishedAt,
    gradingScale: exam.gradingScale, passPercent: exam.passPercent,
    ...summarise(rows, { scale: exam.gradingScale, passPercent: exam.passPercent }),
  }));
}

export async function studentResults(actor: Actor, studentId: string) {
  const { sectionId, publishedOnly } = await resultsAccess(actor, studentId);
  if (!sectionId) return [];
  return resultsFor(studentId, sectionId, { academicYear: { isCurrent: true }, ...(publishedOnly ? { status: "PUBLISHED" } : {}) });
}

export async function reportCard(actor: Actor, studentId: string, examId: string) {
  const { student, sectionId, publishedOnly } = await resultsAccess(actor, studentId);
  if (!sectionId) throw notFound("Report card");
  const [result] = await resultsFor(studentId, sectionId, { id: examId, ...(publishedOnly ? { status: "PUBLISHED" } : {}) });
  if (!result) throw notFound("Report card");
  const section = await prisma.section.findUniqueOrThrow({ where: { id: sectionId }, include: { grade: true, academicYear: true } });
  return {
    student: { id: student.id, name: `${student.firstName} ${student.lastName}`, admissionNo: student.admissionNo },
    school: student.school,
    className: `${section.grade.name} - ${section.name}`,
    academicYear: section.academicYear.name,
    ...result,
  };
}
