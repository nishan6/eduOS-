import type { reportCard } from "@/modules/exams/service";
import { describeScale } from "@/modules/exams/calc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";

type Data = Awaited<ReturnType<typeof reportCard>>;

/** Printable report card for one exam, graded on the scale fixed when the exam was created. */
export function ReportCard({ data }: { data: Data }) {
  return (
    <Card className="print:border-0 print:shadow-none">
      <CardHeader>
        <div>
          <CardTitle>{data.examName} · {data.academicYear}</CardTitle>
          <CardDescription>{data.student.name} · Adm. {data.student.admissionNo} · {data.className} · {data.school.name}</CardDescription>
        </div>
        {data.incomplete ? <Badge tone="warning">Incomplete</Badge> : data.passed ? <Badge tone="success">Passed</Badge> : <Badge tone="danger">Needs improvement</Badge>}
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <Table>
          <THead><tr><TH>Subject</TH><TH className="text-right">Marks</TH><TH className="text-right">Max</TH><TH className="text-right">%</TH><TH>Grade</TH></tr></THead>
          <tbody>
            {data.rows.map((r) => (
              <TR key={r.subject}>
                <TD className="font-medium">{r.subject}</TD>
                <TD className="text-right tabular-nums">{r.isAbsent ? "AB" : r.marks ?? "—"}</TD>
                <TD className="text-right tabular-nums">{r.maxMarks}</TD>
                <TD className="text-right tabular-nums">{r.marks === null && !r.isAbsent ? "—" : r.percent}</TD>
                <TD><Badge tone={r.passed ? "neutral" : "danger"}>{r.marks === null && !r.isAbsent ? "—" : r.grade}</Badge></TD>
              </TR>
            ))}
            <TR className="font-semibold">
              <TD>Total</TD>
              <TD className="text-right tabular-nums" data-testid="report-total">{data.total}</TD>
              <TD className="text-right tabular-nums">{data.max}</TD>
              <TD className="text-right tabular-nums" data-testid="report-percent">{data.percent}</TD>
              <TD><Badge tone="primary">{data.grade}</Badge></TD>
            </TR>
          </tbody>
        </Table>
        <p className="px-5 pt-3 text-xs text-muted-foreground">Grades: {describeScale(data.gradingScale)}. Pass mark {data.passPercent}% per subject. AB = absent.</p>
      </CardContent>
    </Card>
  );
}
