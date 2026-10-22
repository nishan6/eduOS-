import "server-only";
import { prisma } from "@/lib/db";
import { forbidden } from "@/lib/errors";
import { addDays, fromDbDate, schoolToday, toDbDate } from "@/lib/dates";
import { hasFamilyPermission, type Actor } from "@/lib/permissions/evaluate";
import { attendanceRate, tally } from "@/modules/attendance/calc";
import { outstanding } from "@/modules/fees/calc";

/**
 * Everything a parent's home screen needs, built only from records linked to the
 * actor's guardian record. Missing data is reported as missing, never filled in.
 */
export async function getFamilyHome(actor: Actor) {
  if (!hasFamilyPermission(actor, "family.read") || !actor.guardianId) throw forbidden();
  const today = schoolToday();
  const since = toDbDate(addDays(today, -30));

  const links = await prisma.studentGuardianRelationship.findMany({
    where: { guardianId: actor.guardianId, student: { status: "ACTIVE" } },
    include: {
      student: {
        include: {
          school: { select: { id: true, name: true, code: true, board: true } },
          enrollments: {
            where: { academicYear: { isCurrent: true } },
            include: { section: { include: { grade: true } }, academicYear: true },
          },
          attendance: {
            where: { session: { status: "SUBMITTED", date: { gte: since } } },
            include: { session: { select: { date: true } } },
            orderBy: { session: { date: "desc" } },
          },
          invoices: { where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] } }, orderBy: { dueDate: "asc" } },
        },
      },
    },
    orderBy: { student: { firstName: "asc" } },
  });

  return links.map(({ student: s, relation, canViewFees }) => {
    const enrollment = s.enrollments[0];
    const todayRecord = s.attendance.find((a) => fromDbDate(a.session.date) === today);
    const t = tally(s.attendance.map((a) => a.status));
    const outstandingPaise = s.invoices.reduce((sum, i) => sum + outstanding(i), 0);
    const next = s.invoices.find((i) => outstanding(i) > 0);
    return {
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      firstName: s.firstName,
      admissionNo: s.admissionNo,
      relation,
      school: s.school,
      className: enrollment ? `${enrollment.section.grade.name} - ${enrollment.section.name}` : null,
      academicYear: enrollment?.academicYear.name ?? null,
      today: todayRecord ? { status: todayRecord.status, remark: todayRecord.remark } : null,
      attendance30: { tally: t, rate: attendanceRate(t) },
      recentAbsences: s.attendance.filter((a) => a.status === "ABSENT").slice(0, 3).map((a) => fromDbDate(a.session.date)),
      fees: canViewFees
        ? {
            outstandingPaise,
            overduePaise: s.invoices.filter((i) => fromDbDate(i.dueDate) < today).reduce((sum, i) => sum + outstanding(i), 0),
            nextDue: next ? { dueDate: fromDbDate(next.dueDate), amountPaise: outstanding(next), number: next.number } : null,
          }
        : null,
    };
  });
}

export type FamilyChild = Awaited<ReturnType<typeof getFamilyHome>>[number];
