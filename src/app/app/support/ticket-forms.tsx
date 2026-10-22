"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { createTicketAction, replyAction, updateTicketAction } from "./actions";

type Opt = { id: string; label: string };
const CATEGORIES = [["FEES", "Fees"], ["ACADEMICS", "Academics"], ["TRANSPORT", "Transport"], ["ADMINISTRATION", "Administration"], ["TECHNICAL", "App or login"], ["OTHER", "Other"]] as const;

export function NewTicketForm({ students, schoolId }: { students: Opt[]; schoolId?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="space-y-4" noValidate onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const v = (k: string) => String(f.get(k) ?? "");
      start(async () => {
        const r = await createTicketAction({ schoolId, studentId: v("studentId"), category: v("category") as "OTHER", subject: v("subject"), body: v("body") });
        if (r.ok) router.push(`/app/support/${r.data}`);
        else { setError(r.message); setErrors(r.fieldErrors ?? {}); }
      });
    }}>
      {error && <Alert tone="danger">{error}</Alert>}
      {students.length > 0 && (
        <Field label="About" name="studentId" error={errors.studentId}>
          <Select id="studentId" name="studentId" defaultValue={students[0]!.id}>{students.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
        </Field>
      )}
      <Field label="Topic" name="category">
        <Select id="category" name="category" defaultValue="OTHER">{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
      </Field>
      <Field label="Subject" name="subject" error={errors.subject}><Input id="subject" name="subject" placeholder="In a few words" /></Field>
      <Field label="Details" name="body" error={errors.body}><Textarea id="body" name="body" rows={5} /></Field>
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending…" : "Send request"}</Button>
    </form>
  );
}

export function ReplyForm({ ticketId, allowInternal }: { ticketId: string; allowInternal: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form ref={formRef} className="space-y-2" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      start(async () => {
        const r = await replyAction({ ticketId, body: String(f.get("reply") ?? ""), isInternal: f.get("internal") === "on" });
        if (r.ok) { setError(null); formRef.current?.reset(); } else setError(r.message);
      });
    }}>
      <Textarea name="reply" aria-label="Reply" rows={3} placeholder="Write a reply…" />
      <div className="flex items-center gap-3">
        {allowInternal && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="internal" /> Internal note (staff only)</label>}
        <Button size="sm" type="submit" disabled={pending} className="ml-auto">Send</Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

export function TicketControls({ ticketId, status, assigneeId, staff }: { ticketId: string; status: string; assigneeId: string | null; staff: Opt[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (input: Parameters<typeof updateTicketAction>[0]) => start(async () => {
    const r = await updateTicketAction(input);
    setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Updated." : r.message });
  });
  return (
    <div className="space-y-3">
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
      <Field label="Status" name="status">
        <Select id="status" defaultValue={status} disabled={pending} onChange={(e) => run({ ticketId, status: e.target.value as "OPEN" })}>
          <option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option>
        </Select>
      </Field>
      <Field label="Assigned to" name="assigneeId">
        <Select id="assigneeId" defaultValue={assigneeId ?? ""} disabled={pending} onChange={(e) => run({ ticketId, assigneeId: e.target.value || null })}>
          <option value="">Unassigned</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
      </Field>
    </div>
  );
}

export function CloseTicketButton({ ticketId }: { ticketId: string }) {
  const [pending, start] = useTransition();
  return <Button variant="secondary" size="sm" disabled={pending} onClick={() => start(async () => { await updateTicketAction({ ticketId, status: "CLOSED" }); })}>Close request</Button>;
}
