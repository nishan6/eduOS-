import Link from "next/link";
import { Settings2 } from "lucide-react";
import { requireSchoolPage } from "@/server/context";
import { outstandingStudents, schoolFeeSummary } from "@/modules/fees/service";
import { canSchoolWide } from "@/lib/permissions/evaluate";
import { formatPaise } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { PageHeader, Stat } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Fees" };

export default async function FeesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { actor, school } = await requireSchoolPage("fees.read");
  const { q } = await searchParams;
  const [summary, worklist] = await Promise.all([schoolFeeSummary(actor, school.id), outstandingStudents(actor, school.id, q)]);
  return (
    <>
      <PageHeader title="Fees" description={`Collections and dues for ${school.name}. Amounts in INR; outstanding = invoiced − received.`}
        actions={<Link className={buttonVariants({ variant: "secondary" })} href="/app/fees/structures"><Settings2 /> Fee structures</Link>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Outstanding" value={formatPaise(summary.outstandingPaise)} hint={`of ${formatPaise(summary.invoicedPaise)} invoiced`} />
        <Stat label="Overdue" value={formatPaise(summary.overduePaise)} tone={summary.overduePaise ? "danger" : undefined} />
        <Stat label="Collected today" value={formatPaise(summary.collectedTodayPaise)} hint={`${summary.collectedTodayCount} receipts`} />
        <Stat label="Collected this month" value={formatPaise(summary.collectedMonthPaise)} hint={summary.byMode.map((m) => `${m.mode.replace("_", " ").toLowerCase()} ${formatPaise(m.amountPaise)}`).join(" · ") || "No collections yet"} />
      </div>
      {summary.unverifiedNonCash > 0 && canSchoolWide(actor, "finance.reconcile", school.id) && (
        <p className="mb-4 text-sm text-muted-foreground">{summary.unverifiedNonCash} UPI/bank payments are recorded but not yet verified against bank statements.</p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle>Students with dues</CardTitle><CardDescription>Largest balance first. Open a student to record a payment.</CardDescription></div></CardHeader>
          <form className="px-5 pb-3" method="get" role="search"><Input name="q" defaultValue={q} placeholder="Search name or admission no." aria-label="Search students with dues" className="h-9 max-w-xs" /></form>
          <Table>
            <THead><tr><TH>Student</TH><TH>Oldest due</TH><TH className="text-right">Outstanding</TH></tr></THead>
            <tbody>
              {worklist.length === 0 ? <TR><TD colSpan={3} className="py-8 text-center text-muted-foreground">No outstanding dues{q ? " for this search" : ""}.</TD></TR> : worklist.slice(0, 25).map((w) => (
                <TR key={w.student.id}>
                  <TD><Link className="font-medium hover:underline" href={`/app/fees/students/${w.student.id}`}>{w.student.firstName} {w.student.lastName}</Link> <span className="text-xs text-muted-foreground">{w.student.admissionNo}</span></TD>
                  <TD>{w.oldestDue ? formatDate(w.oldestDue) : "—"}</TD>
                  <TD className="text-right tabular-nums">{formatPaise(w.outstandingPaise)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><div><CardTitle>Fee aging</CardTitle><CardDescription>Outstanding by days past due date.</CardDescription></div></CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                {Object.entries(summary.aging).map(([bucket, paise]) => (
                  <div key={bucket} className="flex justify-between"><dt className="text-muted-foreground">{bucket === "current" ? "Not yet due" : `${bucket} days`}</dt><dd className="tabular-nums">{formatPaise(paise)}</dd></div>
                ))}
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Recent payments</CardTitle></CardHeader>
            <CardContent className="px-0 py-1">
              <ul className="divide-y divide-border">
                {summary.recent.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-5 py-2 text-sm">
                    <div className="min-w-0"><p className="truncate font-medium">{p.student.firstName} {p.student.lastName}</p><p className="text-xs text-muted-foreground">{p.receipt?.number} · {p.mode.replace("_", " ").toLowerCase()}</p></div>
                    <div className="text-right"><p className="tabular-nums">{formatPaise(p.amountPaise)}</p>{p.status === "REVERSED" && <StatusBadge status="REVERSED" />}</div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
