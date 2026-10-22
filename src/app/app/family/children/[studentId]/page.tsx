import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/server/actor";
import { AppError } from "@/lib/errors";
import { getStudentProfile } from "@/modules/students/service";
import { studentAttendanceHistory } from "@/modules/attendance/service";
import { studentFeeAccount } from "@/modules/fees/service";
import { formatPaise } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { formatRate } from "@/modules/attendance/calc";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader, Stat } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";

async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch (e) { if (e instanceof AppError) return null; throw e; }
}

export default async function ChildPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const actor = await requireActor();
  const profile = await orNull(getStudentProfile(actor, studentId));
  if (!profile || profile.access !== "family") notFound();
  const [attendance, fees] = await Promise.all([orNull(studentAttendanceHistory(actor, studentId, 60)), orNull(studentFeeAccount(actor, studentId))]);
  const s = profile.student;
  const current = s.enrollments.find((e) => e.academicYear.isCurrent);

  return (
    <>
      <PageHeader title={`${s.firstName} ${s.lastName}`} description={`${current ? `${current.section.grade.name} - ${current.section.name}` : "Not enrolled"} · ${s.school.name}`}
        breadcrumbs={[{ href: "/app/family", label: "My children" }]} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Attendance (60 days)" value={attendance ? formatRate(attendance.rate) : "—"} hint={attendance ? `${attendance.tally.absent} absences` : undefined} />
        <Stat label="Outstanding fees" value={fees ? formatPaise(fees.totals.outstandingPaise) : "—"} tone={fees && fees.totals.overduePaise > 0 ? "danger" : undefined}
          hint={fees ? (fees.totals.overduePaise > 0 ? `${formatPaise(fees.totals.overduePaise)} overdue` : "Nothing overdue") : "Not shared with you"} />
        <Stat label="Next due" value={fees?.nextDue ? formatPaise(fees.nextDue.amountPaise) : "—"} hint={fees?.nextDue ? formatDate(fees.nextDue.dueDate) : "No upcoming dues"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>Attendance history</CardTitle><CardDescription>Submitted daily attendance, most recent first.</CardDescription></div></CardHeader>
          <CardContent className="px-0 pb-2">
            {!attendance || attendance.records.length === 0 ? <p className="px-5 text-sm text-muted-foreground">No attendance recorded yet.</p> : (
              <Table>
                <THead><tr><TH>Date</TH><TH>Status</TH><TH>Note</TH></tr></THead>
                <tbody>{attendance.records.slice(0, 30).map((r) => (
                  <TR key={r.date}><TD>{formatDate(r.date)}</TD><TD><StatusBadge status={r.status} /></TD><TD className="text-muted-foreground">{r.remark ?? ""}</TD></TR>
                ))}</tbody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Fees and payments</CardTitle><CardDescription>Invoices issued by the school and payments recorded against them.</CardDescription></div></CardHeader>
          <CardContent className="px-0 pb-2">
            {!fees ? <p className="px-5 text-sm text-muted-foreground">Fee details are not shared with your account.</p> : (
              <>
                <Table>
                  <THead><tr><TH>Invoice</TH><TH>Due</TH><TH className="text-right">Amount</TH><TH className="text-right">Balance</TH><TH>Status</TH></tr></THead>
                  <tbody>{fees.invoices.map((i) => (
                    <TR key={i.id}>
                      <TD className="font-mono text-xs">{i.number}</TD><TD>{formatDate(i.dueDateIso)}</TD>
                      <TD className="text-right tabular-nums">{formatPaise(i.totalPaise)}</TD>
                      <TD className="text-right tabular-nums">{formatPaise(i.outstandingPaise)}</TD>
                      <TD>{i.isOverdue ? <Badge tone="danger">Overdue</Badge> : <StatusBadge status={i.status} />}</TD>
                    </TR>
                  ))}</tbody>
                </Table>
                <h3 className="mt-4 px-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payments</h3>
                {fees.payments.length === 0 ? <p className="px-5 py-2 text-sm text-muted-foreground">No payments recorded.</p> : (
                  <ul className="divide-y divide-border">
                    {fees.payments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                        <div>
                          <p className="font-medium tabular-nums">{formatPaise(p.amountPaise)} <span className="font-normal text-muted-foreground">· {p.mode.replace("_", " ")}</span></p>
                          <p className="text-xs text-muted-foreground">{formatDate(p.receivedAt)}{p.status === "REVERSED" ? " · reversed" : ""}</p>
                        </div>
                        {p.receipt && p.status === "RECORDED" ? <Link className="text-xs font-medium text-primary hover:underline" href={`/app/fees/receipts/${p.receipt.id}`}>Receipt {p.receipt.number}</Link> : <StatusBadge status={p.status} />}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
