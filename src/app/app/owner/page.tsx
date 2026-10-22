import { notFound } from "next/navigation";
import { requireActor } from "@/server/actor";
import { getActiveSchool } from "@/lib/tenant/active-school";
import { canInOrganization } from "@/lib/permissions/evaluate";
import { organizationOverview } from "@/modules/org/service";
import { formatPaise } from "@/lib/money";
import { formatDate, schoolToday } from "@/lib/dates";
import { formatRate } from "@/modules/attendance/calc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Stat } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { SwitchSchoolLink } from "./switch-school-link";

export const metadata = { title: "Group overview" };
const BOARD: Record<string, string> = { CBSE: "CBSE", AP_STATE: "AP State", ICSE: "ICSE", IB: "IB", OTHER: "Other" };

export default async function OwnerHome() {
  const actor = await requireActor();
  const school = await getActiveSchool(actor);
  if (!school || !canInOrganization(actor, "reports.read", school.organizationId)) notFound();
  const rows = await organizationOverview(actor, school.organizationId);
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  return (
    <>
      <PageHeader title="Group overview" description={`${rows.length} schools · ${formatDate(schoolToday())}. Outstanding fees are amounts invoiced but not yet received; they are not revenue or cash.`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Students enrolled" value={sum((r) => r.students).toLocaleString("en-IN")} hint="Active enrollments, current year" />
        <Stat label="Fees invoiced (year)" value={formatPaise(sum((r) => r.fees.invoicedPaise))} />
        <Stat label="Fees received" value={formatPaise(sum((r) => r.fees.collectedPaise))} hint="Allocated to invoices; excludes reversed" tone="success" />
        <Stat label="Outstanding" value={formatPaise(sum((r) => r.fees.outstandingPaise))} tone="warning" />
      </div>
      <Card>
        <CardHeader><div><CardTitle>School comparison</CardTitle><CardDescription>Metrics use the same definitions in every school. Open a school to drill down.</CardDescription></div></CardHeader>
        <CardContent className="px-0">
          <Table>
            <THead><tr><TH>School</TH><TH className="text-right">Students</TH><TH className="text-right">Attendance today</TH><TH className="text-right">Collected today</TH><TH className="text-right">Received (year)</TH><TH className="text-right">Outstanding</TH><TH className="text-right">Collection rate</TH><TH /></tr></THead>
            <tbody>
              {rows.map((r) => (
                <TR key={r.school.id}>
                  <TD><p className="font-medium">{r.school.name}</p><div className="mt-0.5 flex gap-1"><Badge>{BOARD[r.school.board]}</Badge>{r.school.hasHostel && <Badge>Hostel</Badge>}</div></TD>
                  <TD className="text-right tabular-nums">{r.students}</TD>
                  <TD className="text-right tabular-nums">{formatRate(r.attendance.rate)}<p className="text-xs text-muted-foreground">{r.attendance.submittedSections}/{r.attendance.totalSections} sections</p></TD>
                  <TD className="text-right tabular-nums">{formatPaise(r.fees.collectedTodayPaise)}</TD>
                  <TD className="text-right tabular-nums">{formatPaise(r.fees.collectedPaise)}</TD>
                  <TD className="text-right tabular-nums">{formatPaise(r.fees.outstandingPaise)}</TD>
                  <TD className="text-right tabular-nums">{r.fees.invoicedPaise ? `${((r.fees.collectedPaise / r.fees.invoicedPaise) * 100).toFixed(1)}%` : "—"}</TD>
                  <TD className="text-right"><SwitchSchoolLink schoolId={r.school.id} /></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
