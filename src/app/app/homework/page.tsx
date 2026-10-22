import { NotebookPen } from "lucide-react";
import { requireSchoolPage } from "@/server/context";
import { prisma } from "@/lib/db";
import { listHomework } from "@/modules/homework/service";
import { listCurrentSections } from "@/modules/students/service";
import { can, sectionFilter } from "@/lib/permissions/evaluate";
import { formatDate, schoolToday } from "@/lib/dates";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { CancelHomeworkButton, HomeworkForm } from "./homework-form";

export const metadata = { title: "Homework" };

export default async function HomeworkPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { actor, school } = await requireSchoolPage("homework.read", "any");
  const { section } = await searchParams;
  const visible = sectionFilter(actor, "homework.read", school.id);
  const allSections = await listCurrentSections(school.id);
  const sections = allSections.filter((s) => visible === "all" || visible.includes(s.id));
  const selected = sections.find((s) => s.id === section)?.id;
  const [items, subjects] = await Promise.all([
    listHomework(actor, school.id, { sectionId: selected }),
    prisma.subject.findMany({ where: { schoolId: school.id }, orderBy: { name: "asc" } }),
  ]);
  const manageable = sections.filter((s) => can(actor, "homework.manage", { schoolId: school.id, sectionId: s.id }));
  const today = schoolToday();

  return (
    <>
      <PageHeader title="Homework" description={`${school.name} · recent and upcoming`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <div><CardTitle>Assigned work</CardTitle><CardDescription>Due in the last 14 days or later.</CardDescription></div>
            <form method="get" className="flex items-center gap-2">
              <label htmlFor="section" className="sr-only">Filter by class</label>
              <select id="section" name="section" defaultValue={selected ?? ""} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm">
                <option value="">All my classes</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.grade.name} - {s.name}</option>)}
              </select>
              <button className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-surface-muted">Filter</button>
            </form>
          </CardHeader>
          {items.length === 0 ? (
            <EmptyState icon={NotebookPen} title="No homework yet" description={manageable.length ? "Set homework using the form." : "Nothing has been set for these classes."} />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((h) => (
                <li key={h.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-start sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{h.title} {h.subject && <Badge tone="primary" className="ml-1">{h.subject}</Badge>}</p>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">{h.instructions}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{h.className} · set by {h.teacher} on {formatDate(h.assignedOn)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {h.status === "CANCELLED" ? <StatusBadge status="VOID" label="Cancelled" />
                      : <Badge tone={h.dueOn < today ? "neutral" : h.dueOn === today ? "warning" : "success"}>Due {formatDate(h.dueOn)}</Badge>}
                    {h.status === "PUBLISHED" && manageable.some((s) => s.id === h.sectionId) && <CancelHomeworkButton id={h.id} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {manageable.length > 0 && (
          <Card className="h-fit">
            <CardHeader><div><CardTitle>Set homework</CardTitle><CardDescription>Parents with the app see it straight away.</CardDescription></div></CardHeader>
            <CardContent>
              <HomeworkForm today={today} sections={manageable.map((s) => ({ id: s.id, label: `${s.grade.name} - ${s.name}` }))} subjects={subjects.map((s) => ({ id: s.id, label: s.name }))} defaultSection={selected} />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
