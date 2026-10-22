import Link from "next/link";
import { BookOpenCheck, ChevronRight } from "lucide-react";
import { requireSchoolPage } from "@/server/context";
import { listMarkableSections } from "@/modules/attendance/service";
import { formatDate, schoolToday } from "@/lib/dates";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader, Stat } from "@/components/ui/misc";

export const metadata = { title: "My classes" };

export default async function TeacherHome() {
  const { actor, school } = await requireSchoolPage("attendance.mark", "any");
  const today = schoolToday();
  const sections = await listMarkableSections(actor, school.id, today);
  const pending = sections.filter((s) => s.status !== "SUBMITTED");
  return (
    <>
      <PageHeader title="My classes" description={`${school.name} · ${formatDate(today)}`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Classes" value={sections.length} />
        <Stat label="Attendance pending today" value={pending.length} tone={pending.length ? "warning" : "success"} />
        <Stat label="Students" value={sections.reduce((s, x) => s + x.studentCount, 0)} />
      </div>
      {pending.length > 0 && <Alert tone="warning" className="mb-4" title="Attendance to take">{pending.map((p) => p.name).join(", ")} still need today&apos;s attendance.</Alert>}
      <Card>
        {sections.length === 0 ? (
          <EmptyState icon={BookOpenCheck} title="No classes assigned" description="Ask your principal to assign you to a section." />
        ) : (
          <ul className="divide-y divide-border">
            {sections.map((s) => (
              <li key={s.id}>
                <Link href={`/app/teacher/attendance/${s.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/60">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{s.name} {s.isClassTeacher && <Badge tone="primary" className="ml-1">Class teacher</Badge>}</p>
                    <p className="text-sm text-muted-foreground">{s.studentCount} students</p>
                  </div>
                  <StatusBadge status={s.status} label={s.status === "NOT_STARTED" ? "Not marked" : undefined} />
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
