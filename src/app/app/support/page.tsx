import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircleQuestion } from "lucide-react";
import { requireActor } from "@/server/actor";
import { prisma } from "@/lib/db";
import { canSchoolWide, hasFamilyPermission } from "@/lib/permissions/evaluate";
import { getActiveSchool } from "@/lib/tenant/active-school";
import { myTickets, CATEGORY_LABEL, STATUS_LABEL } from "@/modules/tickets/service";
import { formatDateTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { TICKET_TONE } from "@/components/ticket-thread";
import { NewTicketForm } from "./ticket-forms";

export const metadata = { title: "Help & requests" };

export default async function SupportPage() {
  const actor = await requireActor();
  const isFamily = hasFamilyPermission(actor, "tickets.create") && !!actor.guardianId;
  const school = await getActiveSchool(actor);
  const staffSchool = school && canSchoolWide(actor, "tickets.create", school.id) ? school : null;
  if (!isFamily && !staffSchool) notFound();
  const [tickets, children] = await Promise.all([
    myTickets(actor),
    isFamily
      ? prisma.student.findMany({ where: { status: "ACTIVE", guardians: { some: { guardianId: actor.guardianId! } } }, include: { school: { select: { code: true } } }, orderBy: { firstName: "asc" } })
      : [],
  ]);
  return (
    <>
      <PageHeader title={isFamily ? "Help & requests" : "My requests"} description={isFamily ? "Ask the school office a question or report a problem." : `Requests you raised at ${staffSchool!.name}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="h-fit">
          {tickets.length === 0 ? <EmptyState icon={MessageCircleQuestion} title="No requests yet" /> : (
            <ul className="divide-y divide-border">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/app/support/${t.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-muted/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{t.subject}</p>
                      <p className="text-xs text-muted-foreground">{t.number} · {CATEGORY_LABEL[t.category]}{t.student ? ` · ${t.student.firstName}` : ""} · {formatDateTime(t.createdAt)}</p>
                    </div>
                    <Badge tone={TICKET_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="h-fit">
          <CardHeader><div><CardTitle>New request</CardTitle><CardDescription>You will be notified when the school replies.</CardDescription></div></CardHeader>
          <CardContent>
            <NewTicketForm schoolId={isFamily ? undefined : staffSchool!.id} students={children.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.school.code})` }))} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
