import { notFound } from "next/navigation";
import { requireSchoolPage } from "@/server/context";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { Alert, DevBadge, PageHeader } from "@/components/ui/misc";

export const metadata = { title: "Development outbox" };

export default async function OutboxPage() {
  if (process.env.EDUOS_ENV === "production") notFound();
  await requireSchoolPage("users.manage");
  const messages = await prisma.devOutboxMessage.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <>
      <PageHeader title="Development outbox" description="Emails generated while no email provider is configured. Nothing here was delivered." actions={<DevBadge />} />
      <Alert tone="warning" className="mb-4">Configure EMAIL_PROVIDER to send real email. This page is disabled when EDUOS_ENV=production.</Alert>
      <Card>
        <ul className="divide-y divide-border">
          {messages.length === 0 && <li className="px-5 py-6 text-sm text-muted-foreground">No messages.</li>}
          {messages.map((m) => (
            <li key={m.id} className="px-5 py-3 text-sm">
              <p className="font-medium">{m.subject} <span className="font-normal text-muted-foreground">to {m.to} · {formatDateTime(m.createdAt)}</span></p>
              <pre className="mt-1 whitespace-pre-wrap break-all font-sans text-muted-foreground">{m.body}</pre>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
