import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireActor } from "@/server/actor";
import { AppError } from "@/lib/errors";
import { can, canSchoolWide } from "@/lib/permissions/evaluate";
import { getStudentProfile, listCurrentSections } from "@/modules/students/service";
import { studentAttendanceHistory } from "@/modules/attendance/service";
import { studentFeeAccount } from "@/modules/fees/service";
import { studentResults } from "@/modules/exams/service";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { formatRate } from "@/modules/attendance/calc";
import { buttonVariants } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Stat } from "@/components/ui/misc";
import { EnrollForm, GuardianInvite, LinkGuardianForm } from "./student-forms";

async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch (e) { if (e instanceof AppError) return null; throw e; }
}

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  const profile = await orNull(getStudentProfile(actor, id));
  if (!profile) notFound();
  if (profile.access === "family") redirect(`/app/family/children/${id}`);
  const s = profile.student;
  const schoolId = s.schoolId;
  const current = s.enrollments.find((e) => e.academicYear.isCurrent);
  const [attendance, fees, sections, results] = await Promise.all([
    orNull(studentAttendanceHistory(actor, id, 30)),
    can(actor, "fees.read", { schoolId }) ? orNull(studentFeeAccount(actor, id)) : null,
    can(actor, "enrollment.manage", { schoolId }) ? listCurrentSections(schoolId) : [],
    orNull(studentResults(actor, id)),
  ]);
  const canManageGuardians = canSchoolWide(actor, "guardians.manage", schoolId);

  return (
    <>
      <PageHeader title={`${s.firstName} ${s.lastName}`} description={`Adm. ${s.admissionNo} · ${current ? `${current.section.grade.name} - ${current.section.name}` : "Not enrolled this year"} · ${s.school.name}`}
        breadcrumbs={[{ href: "/app/students", label: "Students" }]}
        actions={fees && can(actor, "fees.collect", { schoolId }) ? <Link className={buttonVariants()} href={`/app/fees/students/${s.id}`}>Collect fees</Link> : null} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Attendance (30 days)" value={attendance ? formatRate(attendance.rate) : "—"} hint={attendance ? `${attendance.tally.absent} absent, ${attendance.tally.late} late` : "No access"} />
        {fees && <Stat label="Fees outstanding" value={formatPaise(fees.totals.outstandingPaise)} tone={fees.totals.overduePaise ? "danger" : undefined} hint={fees.totals.overduePaise ? `${formatPaise(fees.totals.overduePaise)} overdue` : "Nothing overdue"} href={`/app/fees/students/${s.id}`} />}
        <Stat label="Status" value={<StatusBadge status={s.status} />} hint={`Born ${formatDate(s.dateOfBirth)} · ${s.gender.toLowerCase()}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>Guardians</CardTitle><CardDescription>Only linked guardians can see this student in the family app.</CardDescription></div></CardHeader>
          <CardContent className="space-y-3">
            {s.guardians.length === 0 && <p className="text-sm text-muted-foreground">No guardian linked yet.</p>}
            {s.guardians.map((g) => (
              <div key={g.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{g.guardian.name}</p>
                  <Badge>{g.relation.toLowerCase()}</Badge>
                  {g.isPrimary && <Badge tone="primary">Primary</Badge>}
                  {g.guardian.user ? <Badge tone="success">Has login</Badge> : <Badge>No login</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{g.guardian.phone}{g.guardian.email ? ` · ${g.guardian.email}` : ""}</p>
                {canManageGuardians && !g.guardian.user && <GuardianInvite studentId={s.id} guardianId={g.guardian.id} defaultEmail={g.guardian.email ?? ""} />}
              </div>
            ))}
            {canManageGuardians && <LinkGuardianForm studentId={s.id} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div><CardTitle>Enrollment</CardTitle><CardDescription>One enrollment per academic year.</CardDescription></div></CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2 text-sm">
              {s.enrollments.map((e) => (
                <li key={e.id} className="flex items-center justify-between">
                  <span>{e.academicYear.name}: {e.section.grade.name} - {e.section.name}{e.rollNo ? ` · Roll ${e.rollNo}` : ""}</span>
                  <StatusBadge status={e.status} />
                </li>
              ))}
            </ul>
            {sections.length > 0 && <EnrollForm studentId={s.id} currentSectionId={current?.sectionId} sections={sections.map((x) => ({ id: x.id, label: `${x.grade.name} - ${x.name} (${x.academicYear.name})` }))} />}
          </CardContent>
        </Card>

        {attendance && (
          <Card>
            <CardHeader><div><CardTitle>Recent attendance</CardTitle><CardDescription>Submitted sessions, last 30 days.</CardDescription></div></CardHeader>
            <CardContent>
              {attendance.records.length === 0 ? <p className="text-sm text-muted-foreground">No attendance recorded.</p> : (
                <div className="flex flex-wrap gap-1.5">
                  {attendance.records.map((r) => (
                    <span key={r.date} title={`${formatDate(r.date)}: ${r.status.toLowerCase()}`}><StatusBadge status={r.status} label={r.date.slice(8)} /></span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {results && results.length > 0 && (
          <Card>
            <CardHeader><div><CardTitle>Exam results</CardTitle><CardDescription>Current academic year.</CardDescription></div></CardHeader>
            <CardContent className="px-0 pb-2">
              <ul className="divide-y divide-border">
                {results.map((r) => (
                  <li key={r.examId}>
                    <Link href={`/app/students/${s.id}/results/${r.examId}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-muted/60">
                      <span className="font-medium">{r.examName} {r.status !== "PUBLISHED" && <Badge className="ml-1">Not published</Badge>}</span>
                      <span className="flex items-center gap-2 text-sm tabular-nums">{r.incomplete ? "Incomplete" : `${r.percent}%`} <Badge tone="primary">{r.grade}</Badge></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><div><CardTitle>Record history</CardTitle></div></CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {s.statusHistory.map((h) => (
                <li key={h.id} className="flex justify-between gap-2"><span>{h.fromStatus ? `${h.fromStatus.toLowerCase()} → ` : ""}{h.toStatus.toLowerCase()}{h.reason ? ` · ${h.reason}` : ""}</span><span className="text-muted-foreground">{formatDateTime(h.createdAt)}</span></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
