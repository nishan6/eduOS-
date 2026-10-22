"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { formatPaise, rupeesToPaise } from "@/lib/money";
import { createEntryAction, reverseEntryAction } from "./actions";

type Line = { accountId: string; side: "dr" | "cr"; amount: string };

export function ManualEntryForm({ schoolId, today, accounts }: { schoolId: string; today: string; accounts: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [narration, setNarration] = useState("");
  const [date, setDate] = useState(today);
  const [lines, setLines] = useState<Line[]>([{ accountId: "", side: "dr", amount: "" }, { accountId: "", side: "cr", amount: "" }]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const parsed = lines.map((l) => ({ accountId: l.accountId, debitPaise: l.side === "dr" ? rupeesToPaise(l.amount) ?? 0 : 0, creditPaise: l.side === "cr" ? rupeesToPaise(l.amount) ?? 0 : 0 }));
  const dr = parsed.reduce((s, l) => s + l.debitPaise, 0);
  const cr = parsed.reduce((s, l) => s + l.creditPaise, 0);
  const set = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await createEntryAction({ schoolId, date, narration, lines: parsed });
        setMsg({ ok: r.ok, text: r.ok ? `Posted ${r.data}.` : r.message });
        if (r.ok) { setNarration(""); setLines([{ accountId: "", side: "dr", amount: "" }, { accountId: "", side: "cr", amount: "" }]); router.refresh(); }
      });
    }}>
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
      <Field label="Date" name="jdate"><Input id="jdate" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required /></Field>
      <Field label="Narration" name="jnarr"><Input id="jnarr" value={narration} onChange={(e) => setNarration(e.target.value)} required /></Field>
      {lines.map((l, i) => (
        <div key={i} className="flex gap-1.5">
          <Select aria-label="Account" value={l.accountId} onChange={(e) => set(i, { accountId: e.target.value })} className="h-9 min-w-0 flex-1"><option value="">Account…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</Select>
          <Select aria-label="Debit or credit" value={l.side} onChange={(e) => set(i, { side: e.target.value as "dr" })} className="h-9 w-16"><option value="dr">Dr</option><option value="cr">Cr</option></Select>
          <Input aria-label="Amount" inputMode="decimal" placeholder="₹" value={l.amount} onChange={(e) => set(i, { amount: e.target.value })} className="h-9 w-24" />
        </div>
      ))}
      <Button type="button" size="sm" variant="ghost" onClick={() => setLines((ls) => [...ls, { accountId: "", side: "dr", amount: "" }])}>Add line</Button>
      <p className={`text-xs ${dr === cr && dr > 0 ? "text-success" : "text-muted-foreground"}`}>Debits {formatPaise(dr)} · Credits {formatPaise(cr)}</p>
      <Button disabled={pending || dr !== cr || dr === 0}>{pending ? "Posting…" : "Post entry"}</Button>
    </form>
  );
}

export function ReverseEntryButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open) return <Button size="sm" variant="ghost" className="text-danger" onClick={() => setOpen(true)}>Reverse</Button>;
  return (
    <span className="flex items-center gap-1">
      <Input aria-label="Reason" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 w-36" />
      <Button size="sm" variant="danger" disabled={pending} onClick={() => start(async () => { const r = await reverseEntryAction(entryId, reason); if (r.ok) router.refresh(); else setErr(r.message); })}>Confirm</Button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </span>
  );
}
