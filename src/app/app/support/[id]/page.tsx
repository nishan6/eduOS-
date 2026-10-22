import { notFound } from "next/navigation";
import { requireActor } from "@/server/actor";
import { orNull } from "@/server/or-null";
import { getTicket, CATEGORY_LABEL, STATUS_LABEL } from "@/modules/tickets/service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { TICKET_TONE, TicketThread } from "@/components/ticket-thread";
import { CloseTicketButton, ReplyForm } from "../ticket-forms";

export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  const t = await orNull(getTicket(actor, id));
  // This view is the raiser's: internal notes are never loaded here, even for staff.
  if (!t || t.raisedById !== actor.userId) notFound();
  const messages = t.messages.filter((m) => !m.isInternal);
  return (
    <>
      <PageHeader title={t.subject} description={`${t.number} · ${CATEGORY_LABEL[t.category]} · ${t.schoolName}${t.student ? ` · ${t.student.firstName} ${t.student.lastName}` : ""}`}
        breadcrumbs={[{ href: "/app/support", label: "Requests" }]}
        actions={<><Badge tone={TICKET_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>{t.status !== "CLOSED" && <CloseTicketButton ticketId={t.id} />}</>} />
      <Card>
        <CardContent className="space-y-4 pt-5">
          <TicketThread messages={messages} raisedById={t.raisedById} />
          {t.status === "CLOSED" ? <Alert tone="info">This request is closed.</Alert> : <ReplyForm ticketId={t.id} allowInternal={false} />}
        </CardContent>
      </Card>
    </>
  );
}
