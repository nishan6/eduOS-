"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { formatPaise, rupeesToPaise } from "@/lib/money";
import { assignStructureAction, recordPaymentAction, reversePaymentAction, verifyPaymentAction } from "../../actions";

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export function RecordPaymentForm({ studentId, outstandingPaise, today }: { studentId: string; outstandingPaise: number; today: string }) {
  const router = useRouter();
  const [key, setKey] = useState(newKey);
  const [mode, setMode] = useState("CASH");
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string; receipt?: { id: string; number: string } } | null>(null);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const amount = rupeesToPaise(String(f.get("amount") ?? ""));
        if (amount === null || amount <= 0) { setErrors({ amountPaise: ["Enter an amount in rupees, e.g. 5000 or 5000.50"] }); return; }
        setErrors({});
        start(async () => {
          const r = await recordPaymentAction({
            studentId, amountPaise: amount, mode: mode as "CASH", reference: String(f.get("reference") ?? "").trim() || undefined,
            receivedOn: String(f.get("receivedOn")), note: String(f.get("note") ?? "").trim() || undefined, idempotencyKey: key,
          });
          if (r.ok) {
            setMsg({ ok: true, text: r.data.duplicate ? "This payment was already recorded." : `Payment recorded.`, receipt: { id: r.data.receiptId, number: r.data.receiptNumber } });
            setKey(newKey());
            form.reset();
            setMode("CASH");
            router.refresh();
          } else {
            setErrors(r.fieldErrors ?? {});
            setMsg({ ok: false, text: r.message });
          }
        });
      }}
    >
      {msg && (
        <Alert tone={msg.ok ? "success" : "danger"}>
          {msg.text} {msg.receipt && <Link className="font-medium text-primary underline" href={`/app/fees/receipts/${msg.receipt.id}`}>View receipt {msg.receipt.number}</Link>}
        </Alert>
      )}
      <Field label="Amount (₹)" name="amount" hint={`Outstanding ${formatPaise(outstandingPaise)}`} error={errors.amountPaise}>
        <Input id="amount" name="amount" inputMode="decimal" required placeholder="0.00" />
      </Field>
      <Field label="Mode" name="mode">
        <Select id="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CHEQUE">Cheque</option><option value="CARD">Card</option>
        </Select>
      </Field>
      {mode !== "CASH" && (
        <Field label={mode === "CHEQUE" ? "Cheque number" : "Transaction reference (UTR)"} name="reference" error={errors.reference}>
          <Input id="reference" name="reference" required />
        </Field>
      )}
      <Field label="Received on" name="receivedOn" error={errors.receivedOn}><Input id="receivedOn" name="receivedOn" type="date" max={today} defaultValue={today} required /></Field>
      <Field label="Note (optional)" name="note"><Input id="note" name="note" /></Field>
      <Button type="submit" disabled={pending}>{pending ? "Recording…" : "Record payment & issue receipt"}</Button>
    </form>
  );
}

export function AssignStructureForm({ studentId, structures }: { studentId: string; structures: { id: string; label: string; matchesGrade: boolean }[] }) {
  const router = useRouter();
  const [structureId, setStructureId] = useState(structures.find((s) => s.matchesGrade)?.id ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Select aria-label="Fee structure" value={structureId} onChange={(e) => setStructureId(e.target.value)}>
        <option value="" disabled>Choose a structure…</option>
        {structures.map((s) => <option key={s.id} value={s.id}>{s.label}{s.matchesGrade ? " (this class)" : ""}</option>)}
      </Select>
      <Button variant="secondary" disabled={!structureId || pending} onClick={() => start(async () => {
        const r = await assignStructureAction({ studentId, structureId });
        setMsg({ ok: r.ok, text: r.ok ? `${r.data} invoice(s) issued.` : r.message });
        if (r.ok) router.refresh();
      })}>Assign and invoice</Button>
      {msg && <p className={`text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}

export function PaymentRowActions({ paymentId, canReverse, canVerify }: { paymentId: string; canReverse: boolean; canVerify: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (open) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-1">
          <Input aria-label="Reason for reversal" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 w-40" />
          <Button size="sm" variant="danger" disabled={pending} onClick={() => start(async () => {
            const r = await reversePaymentAction({ paymentId, reason });
            if (r.ok) { setOpen(false); router.refresh(); } else setError(r.message);
          })}>Reverse</Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
  return (
    <div className="flex justify-end gap-1">
      {canVerify && <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await verifyPaymentAction(paymentId, "VERIFIED"); router.refresh(); })}>Mark verified</Button>}
      {canReverse && <Button size="sm" variant="ghost" className="text-danger" onClick={() => setOpen(true)}>Reverse</Button>}
    </div>
  );
}
