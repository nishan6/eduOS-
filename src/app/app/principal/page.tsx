import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { requireSchoolPage } from "@/server/context";
import { listPendingCorrections, schoolDailyOverview } from "@/modules/attendance/service";
import { schoolFeeSummary } from "@/modules/fees/service";
import { canSchoolWide } from "@/lib/permissions/evaluate";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { formatRate } from "@/modules/attendance/calc";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { DecisionButtons } from "./decision-buttons";

export const metadata = { title: "School overview" };

export default async function PrincipalHome() {
  const { actor, school } = await requireSchoolPage("attendance.read");
  const [overview, corrections, fees] = await Promise.all([
    schoolDailyOverview(actor, school.id),
    listPendingCorrections(actor, school.id),
    canSchoolWide(actor, "fees.read", school.id) ? schoolFeeSummary(actor, school.id) : null,
  ]);
  const absentees = overview.sections.flatMap((s) => s.absentees.map((a) => ({ ...a, section: s.name })));
  return (
    <>
      <PageHeader title="School overview" description={`${school.name} · ${formatDate(overview.date)}`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Attendance today" value={formatRate(overview.rate)} hint={`${overview.submittedCount} of ${overview.sections.length} sections submitted`} href="/app/attendance" />
        <Stat label="Absent today" value={overview.totals.absent} tone={overview.totals.absent ? "warning" : undefined} hint="In submitted sections" href="/app/attendance" />
        {fees ? (
          <>
            <Stat label="Fees outstanding" value={formatPaise(fees.outstandingPaise)} hint={`${formatPaise(fees.overduePaise)} overdue`} tone={fees.overduePaise ? "danger" : undefined} href="/app/fees" />
            <Stat label="Collected today" value={formatPaise(fees.collectedTodayPaise)} hint={`${fees.collectedTodayCount} receipts`} href="/app/fees" />
          </>
        ) : null}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>Pending approvals</CardTitle><CardDescription>Attendance corrections requested by teachers.</CardDescription></div></CardHeader>
          <CardContent className="px-0 py-0">
            {corrections.length === 0 ? <EmptyState icon={CheckCircle2} title="Nothing to approve" /> : (
              <ul className="divide-y divide-border">
                {corrections.map((c) => (
                  <li key={c.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium">{c.student} <span className="font-normal text-muted-foreground">· {c.section} · {formatDate(c.date)}</span></p>
                      <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground"><StatusBadge status={c.fromStatus} /> to <StatusBadge status={c.toStatus} /> “{c.reason}”</p>
                      <p className="text-xs text-muted-foreground">Requested by {c.requestedBy}, {formatDateTime(c.createdAt)}</p>
                    </div>
                    <DecisionButtons requestId={c.id} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Attendance not yet submitted</CardTitle><CardDescription>Sections without final attendance today.</CardDescription></div></CardHeader>
          <CardContent className="px-0 py-0">
            {overview.pendingSections.length === 0 ? <EmptyState icon={CheckCircle2} title="All sections submitted" /> : (
              <ul className="divide-y divide-border">
                {overview.pendingSections.map((s) => (
                  <li key={s.sectionId} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <Link href={`/app/teacher/attendance/${s.sectionId}`} className="font-medium hover:underline">{s.name}</Link>
                    <StatusBadge status={s.status} label={s.status === "NOT_STARTED" ? "Not marked" : undefined} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle>Absent today</CardTitle><CardDescription>From submitted attendance only.</CardDescription></div></CardHeader>
          <CardContent className="px-0 py-0">
            {absentees.length === 0 ? <p className="px-5 pb-5 text-sm text-muted-foreground">No absences recorded so far today.</p> : (
              <ul className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
                {absentees.map((a) => (
                  <li key={a.id} className="px-5 py-2 text-sm"><Link href={`/app/students/${a.id}`} className="font-medium hover:underline">{a.name}</Link> <span className="text-muted-foreground">· {a.section} · {a.admissionNo}</span></li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
