import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolPage } from "@/server/context";
import { orNull } from "@/server/or-null";
import { getExam } from "@/modules/exams/service";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, PageHeader, Stat } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { PublishButton } from "../exam-forms";

export default async function ExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const { actor, school } = await requireSchoolPage("exams.read", "any");
  const exam = await orNull(getExam(actor, examId));
  if (!exam || exam.schoolId !== school.id) notFound();
  const submitted = exam.papers.filter((p) => p.status === "SUBMITTED").length;
  const open = exam.papers.length - submitted;

  return (
    <>
      <PageHeader title={exam.name} description={`${school.name} · ${exam.academicYear}`} breadcrumbs={[{ href: "/app/exams", label: "Exams & marks" }]}
        actions={exam.canManage && exam.status === "OPEN" ? <PublishButton examId={exam.id} disabled={open > 0} /> : null} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Papers" value={exam.papers.length} />
        <Stat label="Submitted" value={submitted} tone={open ? "warning" : "success"} hint={open ? `${open} still open` : "All marks in"} />
        <Stat label="Status" value={<StatusBadge status={exam.status === "PUBLISHED" ? "APPROVED" : "PENDING"} label={exam.status === "PUBLISHED" ? "Published" : "Marks entry"} />} />
      </div>
      {exam.status === "PUBLISHED" && <Alert tone="success" className="mb-4" title="Results published">Parents can see report cards. Marks are locked.</Alert>}
      <Card>
        <Table>
          <THead><tr><TH>Class</TH><TH>Subject</TH><TH className="text-right">Max</TH><TH className="text-right">Entered</TH><TH className="text-right">Average</TH><TH>Status</TH><TH><span className="sr-only">Action</span></TH></tr></THead>
          <tbody>
            {exam.papers.map((p) => (
              <TR key={p.id}>
                <TD className="font-medium">{p.className}</TD>
                <TD>{p.subject}</TD>
                <TD className="text-right tabular-nums">{p.maxMarks}</TD>
                <TD className="text-right tabular-nums">{p.entered}/{p.students}</TD>
                <TD className="text-right tabular-nums">{p.average ?? "—"}</TD>
                <TD><StatusBadge status={p.status === "SUBMITTED" ? "SUBMITTED" : "DRAFT"} label={p.status === "SUBMITTED" ? "Submitted" : "Open"} /></TD>
                <TD className="text-right">
                  <Link className={buttonVariants({ size: "sm", variant: p.canEnter && p.status === "OPEN" ? "primary" : "ghost" })} href={`/app/exams/papers/${p.id}`} aria-label={`${p.canEnter && p.status === "OPEN" ? "Enter marks" : "View marks"} for ${p.className} ${p.subject}`}>
                    {p.canEnter && p.status === "OPEN" ? "Enter marks" : "View"}
                  </Link>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
