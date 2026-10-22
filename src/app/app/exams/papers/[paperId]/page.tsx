import { notFound } from "next/navigation";
import { requireSchoolPage } from "@/server/context";
import { orNull } from "@/server/or-null";
import { getPaper } from "@/modules/exams/service";
import { Alert, PageHeader } from "@/components/ui/misc";
import { MarksForm } from "./marks-form";
import { ReopenPaper } from "../../exam-forms";

export default async function PaperPage({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = await params;
  const { actor } = await requireSchoolPage("exams.read", "any");
  const paper = await orNull(getPaper(actor, paperId));
  if (!paper) notFound();
  return (
    <>
      <PageHeader title={`${paper.subject} · ${paper.className}`} description={`${paper.examName} · out of ${paper.maxMarks}`}
        breadcrumbs={[{ href: "/app/exams", label: "Exams & marks" }, { href: `/app/exams/${paper.examId}`, label: paper.examName }]}
        actions={paper.canReopen ? <ReopenPaper paperId={paper.id} /> : null} />
      {paper.examStatus === "PUBLISHED" ? <Alert tone="success" className="mb-4" title="Published">Results are published and marks are locked.</Alert>
        : paper.status === "SUBMITTED" ? <Alert tone="info" className="mb-4" title="Submitted">These marks are submitted. The principal can reopen the paper if something needs fixing.</Alert>
        : !paper.canEnter ? <Alert tone="info" className="mb-4">You can view these marks but not enter them.</Alert> : null}
      <MarksForm paper={paper} />
    </>
  );
}
