import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolPage } from "@/server/context";
import { orNull } from "@/server/or-null";
import { getEnquiry, STAGE_LABEL } from "@/modules/admissions/service";
import { listCurrentSections } from "@/modules/students/service";
import { canSchoolWide } from "@/lib/permissions/evaluate";
import { formatDate, formatDateTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { ConvertForm, NoteForm, StageForm } from "../enquiry-forms";

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, school } = await requireSchoolPage("admissions.read");
  const e = await orNull(getEnquiry(actor, id));
  if (!e || e.schoolId !== school.id) notFound();
  const open = e.stage !== "ADMITTED" && e.stage !== "LOST";
  const canAdmit = open && e.canManage && canSchoolWide(actor, "students.create", school.id) && canSchoolWide(actor, "enrollment.manage", school.id);
  const sections = canAdmit ? (await listCurrentSections(school.id)).sort((a, b) => Number(b.gradeId === e.gradeId) - Number(a.gradeId === e.gradeId)) : [];

  return (
    <>
      <PageHeader title={`${e.childFirstName} ${e.childLastName}`} description={`${e.number} · ${e.grade.name} · ${e.academicYear.name}`}
        breadcrumbs={[{ href: "/app/admissions", label: "Admissions" }]} actions={<Badge tone={open ? "primary" : e.stage === "ADMITTED" ? "success" : "danger"}>{STAGE_LABEL[e.stage]}</Badge>} />
      {e.stage === "ADMITTED" && e.student && (
        <Alert tone="success" className="mb-4" title="Admitted">Student record <Link className="font-medium underline" href={`/app/students/${e.student.id}`}>{e.student.admissionNo}</Link> was created from this enquiry.</Alert>
      )}
      {e.stage === "LOST" && <Alert tone="warning" className="mb-4" title="Lost">{e.lostReason}</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader><div><CardTitle>Details</CardTitle></div></CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Guardian</dt><dd className="font-medium">{e.guardianName}</dd></div>
                <div><dt className="text-muted-foreground">Phone</dt><dd className="font-medium"><a href={`tel:${e.phone}`} className="text-primary hover:underline">{e.phone}</a></dd></div>
                <div><dt className="text-muted-foreground">Email</dt><dd>{e.email ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Source</dt><dd>{e.source ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Date of birth</dt><dd>{e.dateOfBirth ? formatDate(e.dateOfBirth) : "—"}</dd></div>
                <div><dt className="text-muted-foreground">Next follow-up</dt><dd>{e.followUpOn ? formatDate(e.followUpOn) : "—"}</dd></div>
              </dl>
            </CardContent>
          </Card>
          {canAdmit && <ConvertForm enquiryId={e.id} dateOfBirth={e.dateOfBirth} gender={e.gender} sections={sections.map((s) => ({ id: s.id, label: `${s.grade.name} - ${s.name}` }))} />}
          <Card>
            <CardHeader><div><CardTitle>Activity</CardTitle></div></CardHeader>
            <CardContent className="space-y-4">
              {e.canManage && open && <NoteForm enquiryId={e.id} />}
              <ol className="space-y-3 text-sm">
                {e.activities.map((a) => (
                  <li key={a.id} className="border-l-2 border-border pl-3">
                    <p>{a.toStage && a.fromStage ? <Badge className="mr-1">{STAGE_LABEL[a.fromStage]} → {STAGE_LABEL[a.toStage]}</Badge> : null}{a.text}</p>
                    <p className="text-xs text-muted-foreground">{a.by.name} · {formatDateTime(a.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
        {e.canManage && e.stage !== "ADMITTED" && (
          <Card className="h-fit">
            <CardHeader><div><CardTitle>{open ? "Update stage" : "Reopen enquiry"}</CardTitle></div></CardHeader>
            <CardContent><StageForm enquiryId={e.id} current={e.stage} /></CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
