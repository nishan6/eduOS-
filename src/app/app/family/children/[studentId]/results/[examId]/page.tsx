import { notFound } from "next/navigation";
import { requireActor } from "@/server/actor";
import { orNull } from "@/server/or-null";
import { reportCard } from "@/modules/exams/service";
import { isLinkedGuardian } from "@/modules/family/access";
import { PageHeader } from "@/components/ui/misc";
import { ReportCard } from "@/components/report-card";
import { PrintButton } from "@/components/print-button";

export default async function FamilyReportCard({ params }: { params: Promise<{ studentId: string; examId: string }> }) {
  const { studentId, examId } = await params;
  const actor = await requireActor();
  // Parents only: staff use the student record route.
  if (!(await isLinkedGuardian(actor, studentId, "exams.read"))) notFound();
  const data = await orNull(reportCard(actor, studentId, examId));
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`${data.examName} report card`} description={data.student.name}
        breadcrumbs={[{ href: "/app/family", label: "My children" }, { href: `/app/family/children/${studentId}`, label: data.student.name }]}
        actions={<PrintButton />} />
      <ReportCard data={data} />
    </>
  );
}
