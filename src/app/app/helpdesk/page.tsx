import Link from "next/link";
import type { TicketStatus } from "@prisma/client";
import { LifeBuoy } from "lucide-react";
import { requireSchoolPage } from "@/server/context";
import { listQueue, CATEGORY_LABEL, STATUS_LABEL } from "@/modules/tickets/service";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { TICKET_TONE } from "@/components/ticket-thread";

export const metadata = { title: "Helpdesk" };
const FILTERS = [["ACTIVE", "Open & in progress"], ["RESOLVED", "Resolved"], ["CLOSED", "Closed"]] as const;

export default async function HelpdeskPage({ searchParams }: { searchParams: Promise<{ status?: string; mine?: string }> }) {
  const { actor, school } = await requireSchoolPage("tickets.manage");
  const sp = await searchParams;
  const status = (["RESOLVED", "CLOSED"].includes(sp.status ?? "") ? sp.status : "ACTIVE") as TicketStatus | "ACTIVE";
  const mine = sp.mine === "1";
  const { rows, counts } = await listQueue(actor, school.id, { status, mine });
  const href = (s: string, m: boolean) => `/app/helpdesk?status=${s}${m ? "&mine=1" : ""}`;
  return (
    <>
      <PageHeader title="Helpdesk" description={`${school.name} · requests from parents and staff`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Open" value={counts.OPEN ?? 0} tone={counts.OPEN ? "warning" : undefined} />
        <Stat label="In progress" value={counts.IN_PROGRESS ?? 0} />
        <Stat label="Resolved" value={counts.RESOLVED ?? 0} tone="success" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(([v, l]) => (
          <Link key={v} href={href(v, mine)} aria-current={status === v ? "page" : undefined}
            className={cn("rounded-full border border-border px-3 py-1 text-sm", status === v ? "border-primary bg-primary-soft font-medium text-primary" : "hover:bg-surface-muted")}>{l}</Link>
        ))}
        <Link href={href(status, !mine)} className={cn("ml-auto rounded-full border border-border px-3 py-1 text-sm", mine ? "border-primary bg-primary-soft font-medium text-primary" : "hover:bg-surface-muted")}>Assigned to me</Link>
      </div>
      <Card>
        {rows.length === 0 ? <EmptyState icon={LifeBuoy} title="Nothing here" description="New requests from parents and staff appear in this queue." /> : (
          <Table>
            <THead><tr><TH>Ticket</TH><TH>Subject</TH><TH>From</TH><TH>Topic</TH><TH>Assigned</TH><TH>Status</TH></tr></THead>
            <tbody>
              {rows.map((t) => (
                <TR key={t.id}>
                  <TD className="font-mono text-xs">{t.number}</TD>
                  <TD><Link href={`/app/helpdesk/${t.id}`} className="font-medium text-primary hover:underline">{t.subject}</Link><span className="block text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</span></TD>
                  <TD>{t.raisedBy.name}{t.student && <span className="block text-xs text-muted-foreground">re {t.student.firstName} {t.student.lastName}</span>}</TD>
                  <TD>{CATEGORY_LABEL[t.category]}</TD>
                  <TD>{t.assignee?.name ?? <span className="text-muted-foreground">—</span>}</TD>
                  <TD><Badge tone={TICKET_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
