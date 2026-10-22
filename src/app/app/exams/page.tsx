import Link from "next/link";
import { ChevronRight, SquarePen } from "lucide-react";
import { requireSchoolPage } from "@/server/context";
import { prisma } from "@/lib/db";
import { listExams } from "@/modules/exams/service";
import { canSchoolWide } from "@/lib/permissions/evaluate";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { CreateExamForm } from "./exam-forms";

export const metadata = { title: "Exams & marks" };

export default async function ExamsPage() {
  const { actor, school } = await requireSchoolPage("exams.read", "any");
  const exams = await listExams(actor, school.id);
  const canManage = canSchoolWide(actor, "exams.manage", school.id);
  const [grades, subjects] = canManage
    ? await Promise.all([
        prisma.grade.findMany({ where: { schoolId: school.id, sections: { some: { academicYear: { isCurrent: true } } } }, orderBy: { order: "asc" } }),
        prisma.subject.findMany({ where: { schoolId: school.id }, orderBy: { name: "asc" } }),
      ])
    : [[], []];

  return (
    <>
      <PageHeader title="Exams & marks" description={`${school.name} · current academic year`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Card className="h-fit">
          {exams.length === 0 ? (
            <EmptyState icon={SquarePen} title="No exams yet" description={canManage ? "Create an exam to open marks entry for teachers." : "Exams appear here once the principal creates them."} />
          ) : (
            <ul className="divide-y divide-border">
              {exams.map((e) => (
                <li key={e.id}>
                  <Link href={`/app/exams/${e.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/60">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{e.name}</p>
                      <p className="text-sm text-muted-foreground">{e.startsOn ? `Starts ${formatDate(e.startsOn)} · ` : ""}{e.submitted} of {e.papers} papers submitted</p>
                    </div>
                    {e.status === "PUBLISHED" ? <Badge tone="success">Published</Badge>
                      : e.submitted === e.papers ? <Badge tone="primary">Ready to publish</Badge> : <Badge tone="warning">Marks entry</Badge>}
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {canManage && (
          <Card className="h-fit">
            <CardHeader><div><CardTitle>New exam</CardTitle><CardDescription>Creates one paper per section and subject.</CardDescription></div></CardHeader>
            <CardContent>
              <CreateExamForm schoolId={school.id} grades={grades.map((g) => ({ id: g.id, label: g.name }))} subjects={subjects.map((s) => ({ id: s.id, label: s.name }))} />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
