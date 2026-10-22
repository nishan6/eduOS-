import Link from "next/link";
import { requireSchoolPage } from "@/server/context";
import { schoolDailyOverview } from "@/modules/attendance/service";
import { formatDate, schoolToday } from "@/lib/dates";
import { formatRate } from "@/modules/attendance/calc";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { PageHeader, Stat } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Attendance report" };

export default async function AttendanceReport({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { actor, school } = await requireSchoolPage("attendance.read");
  const today = schoolToday();
  const q = (await searchParams).date;
  const date = q && /^\d{4}-\d{2}-\d{2}$/.test(q) && q <= today ? q : today;
  const o = await schoolDailyOverview(actor, school.id, date);
  return (
    <>
      <PageHeader title="Daily attendance" description="Rate = (present + late) ÷ (marked − excused), submitted sections only. Times in IST."
        actions={<form method="get"><Input aria-label="Date" type="date" name="date" max={today} defaultValue={date} className="h-9 w-44" /><button className="sr-only">Go</button></form>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label={`Rate · ${formatDate(date)}`} value={formatRate(o.rate)} />
        <Stat label="Sections submitted" value={`${o.submittedCount} / ${o.sections.length}`} />
        <Stat label="Absent" value={o.totals.absent} />
        <Stat label="Late" value={o.totals.late} />
      </div>
      <Card>
        <Table>
          <THead><tr><TH>Section</TH><TH>Status</TH><TH className="text-right">Enrolled</TH><TH className="text-right">Present</TH><TH className="text-right">Absent</TH><TH className="text-right">Late</TH><TH className="text-right">Rate</TH></tr></THead>
          <tbody>
            {o.sections.map((s) => (
              <TR key={s.sectionId}>
                <TD><Link className="font-medium hover:underline" href={`/app/teacher/attendance/${s.sectionId}?date=${date}`}>{s.name}</Link></TD>
                <TD><StatusBadge status={s.status} label={s.status === "NOT_STARTED" ? "Not marked" : undefined} /></TD>
                <TD className="text-right tabular-nums">{s.enrolled}</TD>
                <TD className="text-right tabular-nums">{s.status === "SUBMITTED" ? s.tally.present : "—"}</TD>
                <TD className="text-right tabular-nums">{s.status === "SUBMITTED" ? s.tally.absent : "—"}</TD>
                <TD className="text-right tabular-nums">{s.status === "SUBMITTED" ? s.tally.late : "—"}</TD>
                <TD className="text-right tabular-nums">{formatRate(s.rate)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
