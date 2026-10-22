import { notFound } from "next/navigation";
import { requireActor } from "@/server/actor";
import { AppError } from "@/lib/errors";
import { getReceipt } from "@/modules/fees/service";
import { formatPaise } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { PrintButton } from "./print-button";

export const metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  let data;
  try { data = await getReceipt(actor, id); } catch (e) { if (e instanceof AppError) notFound(); throw e; }
  const { receipt, recordedBy } = data;
  const p = receipt.payment;
  const s = p.student;
  const enrollment = s.enrollments[0];
  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <Card className="p-8">
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <p className="text-lg font-semibold">{s.school.name}</p>
            <p className="text-sm text-muted-foreground">{[s.school.city, s.school.state].filter(Boolean).join(", ")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Fee receipt</p>
            <p className="font-mono text-sm font-semibold" data-testid="receipt-number">{receipt.number}</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(receipt.issuedAt)}</p>
          </div>
        </div>
        {p.status === "REVERSED" && <p className="mt-4 rounded bg-danger-soft px-3 py-2 text-sm font-medium text-danger">This payment was reversed on {p.reversedAt ? formatDate(p.reversedAt) : ""}: {p.reversalReason}. The receipt is void.</p>}
        <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Student</dt><dd>{s.firstName} {s.lastName}</dd>
          <dt className="text-muted-foreground">Admission no.</dt><dd>{s.admissionNo}</dd>
          <dt className="text-muted-foreground">Class</dt><dd>{enrollment ? `${enrollment.section.grade.name} - ${enrollment.section.name}` : "—"}</dd>
          <dt className="text-muted-foreground">Payment date</dt><dd>{formatDate(p.receivedAt)}</dd>
          <dt className="text-muted-foreground">Mode</dt><dd>{p.mode.replace("_", " ").toLowerCase()}{p.reference ? ` · ${p.reference}` : ""}</dd>
        </dl>
        <table className="mt-6 w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground"><th className="py-2">Applied to</th><th className="py-2 text-right">Amount</th></tr></thead>
          <tbody>
            {p.allocations.map((a) => (
              <tr key={a.id} className="border-b border-border">
                <td className="py-2">{a.invoice.number}<span className="block text-xs text-muted-foreground">{a.invoice.lines.map((l) => l.description).join(", ")}</span></td>
                <td className="py-2 text-right tabular-nums">{formatPaise(a.amountPaise)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td className="pt-3 font-semibold">Total received</td><td className="pt-3 text-right text-lg font-semibold tabular-nums" data-testid="receipt-total">{formatPaise(p.amountPaise)}</td></tr></tfoot>
        </table>
        <p className="mt-8 text-xs text-muted-foreground">Recorded by {recordedBy}. {p.mode !== "CASH" ? `Bank verification: ${p.verification.toLowerCase()}.` : ""} Computer-generated receipt.</p>
      </Card>
    </div>
  );
}
