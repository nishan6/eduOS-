import Link from "next/link";
import { UserPlus } from "lucide-react";
import type { EnquiryStage } from "@prisma/client";
import { requireSchoolPage } from "@/server/context";
import { listEnquiries, STAGES, STAGE_LABEL } from "@/modules/admissions/service";
import { formatDate, schoolToday } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Admissions" };

const STAGE_TONE: Record<EnquiryStage, "neutral" | "primary" | "warning" | "success" | "danger"> = {
  NEW: "primary", CONTACTED: "neutral", VISIT_SCHEDULED: "warning", APPLIED: "warning", OFFERED: "success", ADMITTED: "success", LOST: "danger",
};

export default async function AdmissionsPage({ searchParams }: { searchParams: Promise<{ stage?: string; q?: string }> }) {
  const { actor, school } = await requireSchoolPage("admissions.read");
  const sp = await searchParams;
  const stage = (STAGES as string[]).includes(sp.stage ?? "") ? (sp.stage as EnquiryStage) : "OPEN";
  const data = await listEnquiries(actor, school.id, { stage, q: sp.q });
  const today = schoolToday();
  const open = data.byStage.NEW + data.byStage.CONTACTED + data.byStage.VISIT_SCHEDULED + data.byStage.APPLIED + data.byStage.OFFERED;
  const decided = data.byStage.ADMITTED + data.byStage.LOST;

  const tab = (value: string, label: string, count: number) => (
    <Link key={value} href={`/app/admissions?stage=${value}`} aria-current={stage === value ? "page" : undefined}
      className={cn("rounded-full border border-border px-3 py-1 text-sm", stage === value ? "border-primary bg-primary-soft font-medium text-primary" : "hover:bg-surface-muted")}>
      {label} <span className="tabular-nums text-muted-foreground">{count}</span>
    </Link>
  );

  return (
    <>
      <PageHeader title="Admissions" description={`${school.name} · enquiries this academic year`}
        actions={data.canManage ? <Link href="/app/admissions/new" className={buttonVariants()}><UserPlus /> New enquiry</Link> : null} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Open enquiries" value={open} />
        <Stat label="Follow-ups due" value={data.dueToday} tone={data.dueToday ? "warning" : undefined} hint="Today or overdue" />
        <Stat label="Conversion" value={decided ? `${Math.round((data.byStage.ADMITTED / decided) * 100)}%` : "—"} hint={`${data.byStage.ADMITTED} admitted, ${data.byStage.LOST} lost`} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tab("OPEN", "All open", open)}
        {STAGES.map((s) => tab(s, STAGE_LABEL[s], data.byStage[s]))}
        <form method="get" className="ml-auto">
          <input type="hidden" name="stage" value={stage} />
          <label htmlFor="q" className="sr-only">Search enquiries</label>
          <input id="q" name="q" defaultValue={sp.q} placeholder="Search name, phone, number" className="h-9 w-56 rounded-lg border border-border bg-surface px-3 text-sm" />
        </form>
      </div>
      <Card>
        {data.rows.length === 0 ? <EmptyState icon={UserPlus} title="No enquiries here" description={data.canManage ? "Log walk-ins and phone enquiries with New enquiry." : undefined} /> : (
          <Table>
            <THead><tr><TH>Enquiry</TH><TH>Child</TH><TH>Class</TH><TH>Guardian</TH><TH>Stage</TH><TH>Follow up</TH></tr></THead>
            <tbody>
              {data.rows.map((e) => (
                <TR key={e.id}>
                  <TD className="font-mono text-xs">{e.number}</TD>
                  <TD><Link href={`/app/admissions/${e.id}`} className="font-medium text-primary hover:underline">{e.child}</Link></TD>
                  <TD>{e.grade}</TD>
                  <TD>{e.guardianName}<span className="block text-xs text-muted-foreground">{e.phone}</span></TD>
                  <TD><Badge tone={STAGE_TONE[e.stage]}>{STAGE_LABEL[e.stage]}</Badge></TD>
                  <TD className={cn(e.followUpOn && e.followUpOn <= today && "font-medium text-warning")}>{e.followUpOn ? formatDate(e.followUpOn) : "—"}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
