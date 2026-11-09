import { requireSchoolPage } from "@/server/context";
import { prisma } from "@/lib/db";
import { canSchoolWide } from "@/lib/permissions/evaluate";
import { listCurrentSections } from "@/modules/students/service";
import { listSlots, sectionTimetable, teacherTimetable, timetableStaff } from "@/modules/timetable/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { TimetableGrid } from "@/components/timetable-grid";
import { EditableTimetable, SlotManager } from "./timetable-forms";

export const metadata = { title: "Timetable" };

export default async function TimetablePage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { actor, school } = await requireSchoolPage("academics.read");
  const sp = await searchParams;
  const sections = await listCurrentSections(school.id);
  const canManage = canSchoolWide(actor, "timetable.manage", school.id);
  const mine = await teacherTimetable(actor, school.id);
  const selectedId = sections.find((s) => s.id === sp.section)?.id ?? (mine.periods === 0 || canManage ? sections[0]?.id : undefined);
  const [section, subjects, staff, slots] = await Promise.all([
    selectedId ? sectionTimetable(actor, selectedId) : null,
    canManage ? prisma.subject.findMany({ where: { schoolId: school.id }, orderBy: { name: "asc" } }) : [],
    canManage ? timetableStaff(school.id) : [],
    listSlots(school.id),
  ]);

  return (
    <>
      <PageHeader title="Timetable" description={school.name} />
      {mine.periods > 0 && (
        <Card className="mb-6">
          <CardHeader><div><CardTitle>My week</CardTitle><CardDescription>{mine.periods} periods</CardDescription></div></CardHeader>
          <TimetableGrid slots={mine.slots} grid={mine.grid} show="class" />
        </Card>
      )}
      <Card className="mb-6">
        <CardHeader>
          <div><CardTitle>Class timetable</CardTitle>{canManage && <CardDescription>Pick a subject and teacher for each period. A teacher cannot be in two classes at once.</CardDescription>}</div>
          <form method="get" className="flex items-center gap-2">
            <label htmlFor="section" className="sr-only">Class</label>
            <select id="section" name="section" defaultValue={selectedId ?? ""} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm">
              {!selectedId && <option value="">Choose a class</option>}
              {sections.map((s) => <option key={s.id} value={s.id}>{s.grade.name} - {s.name}</option>)}
            </select>
            <button className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-surface-muted">Show</button>
          </form>
        </CardHeader>
        {section && (canManage
          ? <EditableTimetable sectionId={section.section.id} slots={section.slots} grid={section.grid}
              subjects={subjects.map((s) => ({ id: s.id, label: s.name }))} staff={staff.map((s) => ({ id: s.id, label: s.name }))} />
          : <TimetableGrid slots={section.slots} grid={section.grid} />)}
      </Card>
      {canManage && (
        <Card>
          <CardHeader><div><CardTitle>Periods</CardTitle><CardDescription>The school day, shared by every class.</CardDescription></div></CardHeader>
          <CardContent><SlotManager schoolId={school.id} slots={slots} /></CardContent>
        </Card>
      )}
    </>
  );
}
