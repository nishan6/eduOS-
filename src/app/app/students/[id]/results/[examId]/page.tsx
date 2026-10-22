import { notFound } from "next/navigation";
import { requireActor } from "@/server/actor";
import { orNull } from "@/server/or-null";
import { reportCard } from "@/modules/exams/service";
import { PageHeader } from "@/components/ui/misc";
import { ReportCard } from "@/components/report-card";
import { PrintButton } from "@/components/print-button";

export default async function StaffReportCard({ params }: { params: Promise<{ id: string; examId: string }> }) {
  const { id, examId } = await params;
  const actor = await requireActor();
  const data = await orNull(reportCard(actor, id, examId));
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`${data.examName} report card`} description={data.student.name}
        breadcrumbs={[{ href: "/app/students", label: "Students" }, { href: `/app/students/${id}`, label: data.student.name }]}
        actions={<PrintButton />} />
      <ReportCard data={data} />
    </>
  );
}
