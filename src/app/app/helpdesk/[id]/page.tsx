import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolPage } from "@/server/context";
import { orNull } from "@/server/or-null";
import { assignableStaff, getTicket, CATEGORY_LABEL, STATUS_LABEL } from "@/modules/tickets/service";
import { formatDateTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { TICKET_TONE, TicketThread } from "@/components/ticket-thread";
import { ReplyForm, TicketControls } from "../../support/ticket-forms";

export default async function HelpdeskTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, school } = await requireSchoolPage("tickets.manage");
  const t = await orNull(getTicket(actor, id));
  if (!t || !t.isStaff || t.schoolId !== school.id) notFound();
  const staff = await assignableStaff(actor, school.id);
  return (
    <>
      <PageHeader title={t.subject} description={`${t.number} · ${CATEGORY_LABEL[t.category]} · raised ${formatDateTime(t.createdAt)}`}
        breadcrumbs={[{ href: "/app/helpdesk", label: "Helpdesk" }]} actions={<Badge tone={TICKET_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardContent className="space-y-4 pt-5">
            <TicketThread messages={t.messages} raisedById={t.raisedById} />
            {t.status !== "CLOSED" && <ReplyForm ticketId={t.id} allowInternal />}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Ticket</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div><p className="text-muted-foreground">From</p><p className="font-medium">{t.raisedBy.name}</p><p className="text-xs text-muted-foreground">{t.raisedBy.email}</p></div>
              {t.student && <div><p className="text-muted-foreground">About</p><Link href={`/app/students/${t.student.id}`} className="font-medium text-primary hover:underline">{t.student.firstName} {t.student.lastName}</Link><p className="text-xs text-muted-foreground">Adm. {t.student.admissionNo}</p></div>}
              <TicketControls ticketId={t.id} status={t.status} assigneeId={t.assignee?.id ?? null} staff={staff.map((s) => ({ id: s.id, label: s.name }))} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
