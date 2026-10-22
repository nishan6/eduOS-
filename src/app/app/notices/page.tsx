import { Megaphone } from "lucide-react";
import { requireSchoolPage } from "@/server/context";
import { prisma } from "@/lib/db";
import { listSchoolAnnouncements } from "@/modules/announcements/service";
import { listCurrentSections } from "@/modules/students/service";
import { can, canSchoolWide } from "@/lib/permissions/evaluate";
import { formatDateTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { AnnouncementForm } from "./announcement-form";

export const metadata = { title: "Notices" };

export default async function NoticesPage() {
  const { actor, school } = await requireSchoolPage("announcements.send", "any");
  const schoolWide = canSchoolWide(actor, "announcements.send", school.id);
  const [items, sections, grades] = await Promise.all([
    listSchoolAnnouncements(actor, school.id),
    listCurrentSections(school.id),
    schoolWide ? prisma.grade.findMany({ where: { schoolId: school.id }, orderBy: { order: "asc" } }) : [],
  ]);
  const sendable = sections.filter((s) => can(actor, "announcements.send", { schoolId: school.id, sectionId: s.id }));

  return (
    <>
      <PageHeader title="Notices" description={`Messages to parents · ${school.name}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Card className="h-fit">
          <CardHeader><div><CardTitle>Sent</CardTitle><CardDescription>Most recent first.</CardDescription></div></CardHeader>
          {items.length === 0 ? <EmptyState icon={Megaphone} title="No notices sent yet" /> : (
            <ul className="divide-y divide-border">
              {items.map((a) => (
                <li key={a.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{a.title}</p>
                    <Badge tone="primary">{a.target}</Badge>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{a.author} · {formatDateTime(a.publishedAt)} · {a.recipientCount} in app, {a.emailCount} email</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="h-fit">
          <CardHeader><div><CardTitle>New notice</CardTitle><CardDescription>Parents with the app are notified; parents with an email address are emailed.</CardDescription></div></CardHeader>
          <CardContent>
            <AnnouncementForm schoolId={school.id} schoolWide={schoolWide}
              grades={grades.map((g) => ({ id: g.id, label: g.name }))}
              sections={sendable.map((s) => ({ id: s.id, label: `${s.grade.name} - ${s.name}` }))} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
