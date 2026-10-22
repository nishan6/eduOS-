import Link from "next/link";
import { Bell } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { requireActor } from "@/server/actor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { markNotificationsReadAction } from "../actions";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const actor = await requireActor();
  const items = await prisma.notification.findMany({ where: { userId: actor.userId }, orderBy: { createdAt: "desc" }, take: 50 });
  const unread = items.some((n) => !n.readAt);
  return (
    <>
      <PageHeader title="Notifications" description="In-app updates from your schools."
        actions={unread ? <form action={markNotificationsReadAction}><Button variant="secondary" size="sm">Mark all as read</Button></form> : null} />
      <Card>
        {items.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="Attendance alerts and school updates will appear here." />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.id} className="flex gap-3 px-5 py-3.5">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-primary"}`} aria-label={n.readAt ? undefined : "Unread"} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.href ? <Link href={n.href} className="hover:underline">{n.title}</Link> : n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</time>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
