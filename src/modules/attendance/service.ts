import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/audit";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { parseInput } from "@/lib/validation";
import { can, canSchoolWide, sectionFilter, type Actor } from "@/lib/permissions/evaluate";
import { assertCan } from "@/server/guard";
import { fromDbDate, schoolToday, toDbDate, addDays } from "@/lib/dates";
import { attendanceRate, tally, type AttendanceStatusValue } from "./calc";
import { assertCanReadStudent, currentSectionId } from "@/modules/students/service";
import { isLinkedGuardian } from "@/modules/family/access";

const STATUS = z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

async function loadSection(sectionId: string) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { grade: true, academicYear: true, school: { select: { organizationId: true } } },
  });
  if (!section) throw notFound("Section");
  return section;
}

/** Sections the actor can mark attendance for today, with today's status. */
export async function listMarkableSections(actor: Actor, schoolId: string, date = schoolToday()) {
  const filter = sectionFilter(actor, "attendance.mark", schoolId);
  if (filter !== "all" && filter.length === 0) return [];
  const sections = await prisma.section.findMany({
    where: {
      schoolId,
      academicYear: { isCurrent: true },
      ...(filter === "all" ? {} : { id: { in: filter } }),
    },
    include: {
      grade: true,
      _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      attendanceSessions: { where: { date: toDbDate(date), period: 0 }, select: { id: true, status: true, submittedAt: true } },
      teacherAssignments: { where: { userId: actor.userId }, select: { isClassTeacher: true, subject: { select: { name: true } } } },
    },
    orderBy: [{ grade: { order: "asc" } }, { name: "asc" }],
  });
  return sections.map((s) => ({
    id: s.id,
    name: `${s.grade.name} - ${s.name}`,
    studentCount: s._count.enrollments,
    status: s.attendanceSessions[0]?.status ?? ("NOT_STARTED" as const),
    isClassTeacher: s.teacherAssignments.some((t) => t.isClassTeacher),
    subjects: s.teacherAssignments.map((t) => t.subject?.name).filter(Boolean) as string[],
  }));
}

/** Roll for a section and date: enrolled students plus any saved marks. */
export async function getRoster(actor: Actor, sectionId: string, date: string) {
  isoDate.parse(date);
  const section = await loadSection(sectionId);
  const scope = { schoolId: section.schoolId, sectionId };
  if (!can(actor, "attendance.mark", scope) && !can(actor, "attendance.read", scope)) throw forbidden();

  const [enrollments, session] = await Promise.all([
    prisma.studentEnrollment.findMany({
      where: { sectionId, status: "ACTIVE", student: { status: "ACTIVE" } },
      include: { student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } } },
      orderBy: [{ rollNo: "asc" }, { student: { firstName: "asc" } }],
    }),
    prisma.attendanceSession.findUnique({
      where: { sectionId_date_period: { sectionId, date: toDbDate(date), period: 0 } },
      include: {
        records: { include: { corrections: { where: { status: "PENDING" }, select: { id: true, toStatus: true } } } },
      },
    }),
  ]);
  const marks = new Map(session?.records.map((r) => [r.studentId, r]) ?? []);
  return {
    section: { id: section.id, name: `${section.grade.name} - ${section.name}`, schoolId: section.schoolId, academicYear: section.academicYear.name },
    date,
    session: session ? { id: session.id, status: session.status, submittedAt: session.submittedAt } : null,
    canMark: can(actor, "attendance.mark", scope),
    students: enrollments.map((e) => {
      const r = marks.get(e.studentId);
      return {
        id: e.student.id,
        name: `${e.student.firstName} ${e.student.lastName}`,
        admissionNo: e.student.admissionNo,
        rollNo: e.rollNo,
        attendanceId: r?.id ?? null,
        status: (r?.status ?? null) as AttendanceStatusValue | null,
        remark: r?.remark ?? null,
        pendingCorrection: r?.corrections[0] ?? null,
      };
    }),
  };
}

export const saveAttendanceInput = z.object({
  sectionId: z.string().min(1),
  date: isoDate,
  submit: z.boolean(),
  entries: z
    .array(z.object({ studentId: z.string().min(1), status: STATUS, remark: z.string().trim().max(200).optional() }))
    .min(1, "Mark at least one student"),
});

export async function saveAttendance(actor: Actor, raw: z.input<typeof saveAttendanceInput>) {
  const input = parseInput(saveAttendanceInput, raw);
  const section = await loadSection(input.sectionId);
  assertCan(actor, "attendance.mark", { schoolId: section.schoolId, sectionId: section.id }, "You are not assigned to this class.");

  const today = schoolToday();
  if (input.date > today) throw invalid("Attendance cannot be marked for a future date.");
  const yearStart = fromDbDate(section.academicYear.startDate);
  const yearEnd = fromDbDate(section.academicYear.endDate);
  if (input.date < yearStart || input.date > yearEnd) throw invalid("That date is outside the academic year.");
  if (input.date < addDays(today, -7) && !canSchoolWide(actor, "attendance.correct", section.schoolId)) {
    throw invalid("Attendance older than 7 days must go through a correction request.");
  }

  const enrolled = await prisma.studentEnrollment.findMany({
    where: { sectionId: section.id, status: "ACTIVE", student: { status: "ACTIVE" } },
    select: { studentId: true },
  });
  const enrolledIds = new Set(enrolled.map((e) => e.studentId));
  const seen = new Set<string>();
  for (const e of input.entries) {
    if (!enrolledIds.has(e.studentId)) throw invalid("One or more students are not enrolled in this section.");
    if (seen.has(e.studentId)) throw invalid("A student appears twice in the submission.");
    seen.add(e.studentId);
  }
  if (input.submit && seen.size !== enrolledIds.size) {
    throw invalid(`Mark all ${enrolledIds.size} students before submitting (${enrolledIds.size - seen.size} unmarked).`);
  }

  return prisma.$transaction(async (tx) => {
    const date = toDbDate(input.date);
    const existing = await tx.attendanceSession.findUnique({
      where: { sectionId_date_period: { sectionId: section.id, date, period: 0 } },
    });
    if (existing?.status === "SUBMITTED") {
      throw conflict("Attendance for this day is already submitted. Use a correction request to change it.");
    }
    const session =
      existing ??
      (await tx.attendanceSession.create({
        data: { schoolId: section.schoolId, sectionId: section.id, date, period: 0, markedById: actor.userId },
      }));
    for (const e of input.entries) {
      await tx.studentAttendance.upsert({
        where: { sessionId_studentId: { sessionId: session.id, studentId: e.studentId } },
        create: { sessionId: session.id, studentId: e.studentId, status: e.status, remark: e.remark },
        update: { status: e.status, remark: e.remark },
      });
    }
    const updated = await tx.attendanceSession.update({
      where: { id: session.id },
      data: {
        markedById: actor.userId,
        ...(input.submit ? { status: "SUBMITTED", submittedAt: new Date() } : {}),
      },
    });
    if (input.submit) {
      const t = tally(input.entries.map((e) => e.status));
      await audit(
        {
          actorUserId: actor.userId,
          organizationId: section.school.organizationId,
          schoolId: section.schoolId,
          action: "attendance.submit",
          entityType: "AttendanceSession",
          entityId: session.id,
          summary: `Submitted attendance for ${section.grade.name}-${section.name} on ${input.date}: ${t.present} present, ${t.absent} absent, ${t.late} late`,
          metadata: { ...t },
        },
        tx,
      );
      // In-app notification to linked guardians who have a login. External SMS/WhatsApp go through adapters later.
      const absent = input.entries.filter((e) => e.status === "ABSENT").map((e) => e.studentId);
      if (absent.length) {
        const links = await tx.studentGuardianRelationship.findMany({
          where: { studentId: { in: absent }, guardian: { userId: { not: null } } },
          include: { guardian: { select: { userId: true } }, student: { select: { firstName: true } } },
        });
        await tx.notification.createMany({
          data: links.map((l) => ({
            userId: l.guardian.userId!,
            schoolId: section.schoolId,
            title: `${l.student.firstName} was marked absent`,
            body: `${section.grade.name}-${section.name} on ${input.date}. Contact the class teacher if this is incorrect.`,
            href: `/app/family/children/${l.studentId}`,
          })),
        });
      }
    }
    return updated;
  });
}

export const correctionInput = z.object({
  attendanceId: z.string().min(1),
  toStatus: STATUS,
  reason: z.string().trim().min(5, "Give a reason of at least 5 characters").max(300),
});

export async function requestCorrection(actor: Actor, raw: z.input<typeof correctionInput>) {
  const input = parseInput(correctionInput, raw);
  const record = await prisma.studentAttendance.findUnique({
    where: { id: input.attendanceId },
    include: { session: { include: { section: { include: { grade: true } } } }, student: true },
  });
  if (!record) throw notFound("Attendance record");
  const { session } = record;
  assertCan(actor, "attendance.mark", { schoolId: session.schoolId, sectionId: session.sectionId });
  if (session.status !== "SUBMITTED") throw invalid("This attendance has not been submitted yet; edit it directly.");
  if (record.status === input.toStatus) throw invalid("The new status is the same as the current one.");
  const pending = await prisma.attendanceCorrectionRequest.findFirst({ where: { attendanceId: record.id, status: "PENDING" } });
  if (pending) throw conflict("A correction for this record is already awaiting approval.");

  const req = await prisma.attendanceCorrectionRequest.create({
    data: {
      schoolId: session.schoolId,
      attendanceId: record.id,
      requestedById: actor.userId,
      fromStatus: record.status,
      toStatus: input.toStatus,
      reason: input.reason,
    },
  });
  await audit({
    actorUserId: actor.userId,
    schoolId: session.schoolId,
    action: "attendance.correction.request",
    entityType: "AttendanceCorrectionRequest",
    entityId: req.id,
    summary: `Requested ${record.status} → ${input.toStatus} for ${record.student.admissionNo} on ${fromDbDate(session.date)}`,
  });
  return req;
}

export async function listPendingCorrections(actor: Actor, schoolId: string) {
  if (!canSchoolWide(actor, "attendance.correct", schoolId)) return [];
  const rows = await prisma.attendanceCorrectionRequest.findMany({
    where: { schoolId, status: "PENDING" },
    include: {
      attendance: {
        include: { student: true, session: { include: { section: { include: { grade: true } } } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  const requesterIds = [...new Set(rows.map((r) => r.requestedById))];
  const users = await prisma.user.findMany({ where: { id: { in: requesterIds } }, select: { id: true, name: true } });
  const names = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    id: r.id,
    student: `${r.attendance.student.firstName} ${r.attendance.student.lastName}`,
    admissionNo: r.attendance.student.admissionNo,
    section: `${r.attendance.session.section.grade.name} - ${r.attendance.session.section.name}`,
    date: fromDbDate(r.attendance.session.date),
    fromStatus: r.fromStatus,
    toStatus: r.toStatus,
    reason: r.reason,
    requestedBy: names.get(r.requestedById) ?? "Unknown",
    createdAt: r.createdAt,
  }));
}

export const decideCorrectionInput = z.object({
  requestId: z.string().min(1),
  approve: z.boolean(),
  note: z.string().trim().max(300).optional(),
});

export async function decideCorrection(actor: Actor, raw: z.input<typeof decideCorrectionInput>) {
  const input = parseInput(decideCorrectionInput, raw);
  const req = await prisma.attendanceCorrectionRequest.findUnique({
    where: { id: input.requestId },
    include: { attendance: { include: { student: true, session: true } } },
  });
  if (!req) throw notFound("Correction request");
  if (!canSchoolWide(actor, "attendance.correct", req.schoolId)) throw forbidden();
  if (req.requestedById === actor.userId) throw forbidden("You cannot approve your own correction request.");
  if (req.status !== "PENDING") throw conflict("This request has already been decided.");

  return prisma.$transaction(async (tx) => {
    // Guard against a concurrent decision.
    const updated = await tx.attendanceCorrectionRequest.updateMany({
      where: { id: req.id, status: "PENDING" },
      data: {
        status: input.approve ? "APPROVED" : "REJECTED",
        decidedById: actor.userId,
        decidedAt: new Date(),
        decisionNote: input.note,
      },
    });
    if (updated.count !== 1) throw conflict("This request has already been decided.");
    if (input.approve) {
      await tx.studentAttendance.update({
        where: { id: req.attendanceId },
        data: { status: req.toStatus, remark: `Corrected: ${req.reason}` },
      });
    }
    await audit(
      {
        actorUserId: actor.userId,
        schoolId: req.schoolId,
        action: input.approve ? "attendance.correction.approve" : "attendance.correction.reject",
        entityType: "AttendanceCorrectionRequest",
        entityId: req.id,
        summary: `${input.approve ? "Approved" : "Rejected"} ${req.fromStatus} → ${req.toStatus} for ${req.attendance.student.admissionNo} on ${fromDbDate(req.attendance.session.date)}`,
      },
      tx,
    );
  });
}

/** School-wide daily overview for principals/management. */
export async function schoolDailyOverview(actor: Actor, schoolId: string, date = schoolToday()) {
  if (!canSchoolWide(actor, "attendance.read", schoolId)) throw forbidden();
  const sections = await prisma.section.findMany({
    where: { schoolId, academicYear: { isCurrent: true } },
    include: {
      grade: true,
      _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      attendanceSessions: {
        where: { date: toDbDate(date), period: 0 },
        include: { records: { include: { student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } } } } },
      },
    },
    orderBy: [{ grade: { order: "asc" } }, { name: "asc" }],
  });

  const rows = sections.map((s) => {
    const session = s.attendanceSessions[0];
    const submitted = session?.status === "SUBMITTED";
    const t = tally(submitted ? session.records.map((r) => r.status) : []);
    return {
      sectionId: s.id,
      name: `${s.grade.name} - ${s.name}`,
      enrolled: s._count.enrollments,
      status: session?.status ?? ("NOT_STARTED" as const),
      tally: t,
      rate: attendanceRate(t),
      absentees: submitted
        ? session.records.filter((r) => r.status === "ABSENT").map((r) => ({
            id: r.student.id, name: `${r.student.firstName} ${r.student.lastName}`, admissionNo: r.student.admissionNo,
          }))
        : [],
    };
  });
  const submittedRows = rows.filter((r) => r.status === "SUBMITTED");
  const total = submittedRows.reduce(
    (acc, r) => ({
      present: acc.present + r.tally.present, absent: acc.absent + r.tally.absent, late: acc.late + r.tally.late,
      excused: acc.excused + r.tally.excused, total: acc.total + r.tally.total,
    }),
    { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
  );
  return {
    date,
    sections: rows,
    totals: total,
    rate: attendanceRate(total),
    submittedCount: submittedRows.length,
    pendingSections: rows.filter((r) => r.status !== "SUBMITTED"),
  };
}

/** A student's attendance history (staff with access or linked guardian). Only submitted sessions count. */
export async function studentAttendanceHistory(actor: Actor, studentId: string, days = 30) {
  const student = await assertCanReadStudent(actor, studentId);
  if (student.via === "staff") {
    const sectionId = await currentSectionId(studentId);
    if (!can(actor, "attendance.read", { schoolId: student.schoolId, sectionId })) throw forbidden();
  } else {
    // family access to attendance is checked separately from student profile access
    if (!(await isLinkedGuardian(actor, studentId, "attendance.read"))) throw forbidden();
  }
  const from = toDbDate(addDays(schoolToday(), -days));
  const records = await prisma.studentAttendance.findMany({
    where: { studentId, session: { status: "SUBMITTED", date: { gte: from } } },
    include: { session: { select: { date: true } } },
    orderBy: { session: { date: "desc" } },
  });
  const t = tally(records.map((r) => r.status));
  return {
    records: records.map((r) => ({ date: fromDbDate(r.session.date), status: r.status, remark: r.remark })),
    tally: t,
    rate: attendanceRate(t),
    days,
  };
}
