import { notFound } from "next/navigation";
import { Megaphone } from "lucide-react";
import { requireActor } from "@/server/actor";
import { orNull } from "@/server/or-null";
import { familyAnnouncements } from "@/modules/announcements/service";
import { formatDateTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";

export const metadata = { title: "Notices" };

export default async function FamilyNotices() {
  const actor = await requireActor();
  const items = await orNull(familyAnnouncements(actor));
  if (!items) notFound();
  return (
    <>
      <PageHeader title="Notices" description="Messages from your children's schools in the last 60 days." />
      <Card>
        {items.length === 0 ? <EmptyState icon={Megaphone} title="No notices" description="Messages from school will appear here." /> : (
          <ul className="divide-y divide-border">
            {items.map((a) => (
              <li key={a.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-medium">{a.title}</h2><Badge>{a.target === "All parents" ? a.school : a.target}</Badge></div>
                <p className="mt-1 whitespace-pre-line text-sm">{a.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{a.school} · {formatDateTime(a.publishedAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
