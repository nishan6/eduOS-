import { requireSchoolPage } from "@/server/context";
import { canInOrganization } from "@/lib/permissions/evaluate";
import { getSchoolSettings } from "@/modules/org/service";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { SCALES, type GradingScaleKey } from "@/modules/exams/calc";
import { AddClassForm, AssignTeacherForm, CreateSchoolForm, GradingForm } from "./school-forms";

export const metadata = { title: "School setup" };
const BOARD: Record<string, string> = { CBSE: "CBSE", AP_STATE: "Andhra Pradesh State Board", ICSE: "ICSE", IB: "IB", OTHER: "Other" };

export default async function SchoolSettingsPage() {
  const { actor, school } = await requireSchoolPage("settings.manage");
  const { school: s, staff } = await getSchoolSettings(actor, school.id);
  const sections = s.grades.flatMap((g) => g.sections.map((x) => ({ id: x.id, label: `${g.name} - ${x.name}` })));
  return (
    <>
      <PageHeader title="School setup" description={`${s.name} · ${BOARD[s.board]} · code ${s.code}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><div><CardTitle>Classes and sections</CardTitle><CardDescription>Current academic year. Teacher assignments drive which classes a teacher can see and mark.</CardDescription></div></CardHeader>
            <CardContent className="px-0">
              <Table>
                <THead><tr><TH>Section</TH><TH className="text-right">Students</TH><TH>Teachers</TH></tr></THead>
                <tbody>
                  {s.grades.flatMap((g) => g.sections.map((x) => (
                    <TR key={x.id}>
                      <TD className="font-medium">{g.name} - {x.name}</TD>
                      <TD className="text-right tabular-nums">{x._count.enrollments}</TD>
                      <TD className="text-sm">{x.teacherAssignments.length ? x.teacherAssignments.map((t) => `${t.user.name}${t.isClassTeacher ? " (class teacher)" : ""}`).join(", ") : <span className="text-muted-foreground">None</span>}</TD>
                    </TR>
                  )))}
                </tbody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Academic years</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">{s.academicYears.map((y) => <li key={y.id} className="flex items-center gap-2">{y.name} <span className="text-muted-foreground">{formatDate(y.startDate)} – {formatDate(y.endDate)}</span>{y.isCurrent && <Badge tone="primary">Current</Badge>}</li>)}</ul>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Add class</CardTitle></CardHeader><CardContent><AddClassForm schoolId={s.id} /></CardContent></Card>
          <Card><CardHeader><CardTitle>Assign teacher</CardTitle></CardHeader><CardContent><AssignTeacherForm schoolId={s.id} staff={staff} sections={sections} /></CardContent></Card>
          <Card>
            <CardHeader><div><CardTitle>Grading</CardTitle><CardDescription>Used on report cards. Each exam keeps the scale it was created with.</CardDescription></div></CardHeader>
            <CardContent>
              <GradingForm schoolId={s.id} scale={s.gradingScale} passPercent={s.passPercent}
                options={(Object.keys(SCALES) as GradingScaleKey[]).map((k) => ({ value: k, label: SCALES[k].label }))} />
            </CardContent>
          </Card>
          {canInOrganization(actor, "schools.manage", s.organizationId) && (
            <Card><CardHeader><div><CardTitle>Add a school</CardTitle><CardDescription>Creates the school with its first academic year and default ledger accounts.</CardDescription></div></CardHeader><CardContent><CreateSchoolForm organizationId={s.organizationId} /></CardContent></Card>
          )}
        </div>
      </div>
    </>
  );
}
