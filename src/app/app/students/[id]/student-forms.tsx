"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { enrollStudentAction, inviteGuardianAction, linkGuardianAction } from "../actions";

export function LinkGuardianForm({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ message: string; fields?: Record<string, string[]> } | null>(null);
  if (!open) return <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Link another guardian</Button>;
  return (
    <form
      className="grid gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const v = (k: string) => String(f.get(k) ?? "").trim();
        start(async () => {
          const r = await linkGuardianAction({ studentId, guardian: { name: v("name"), phone: v("phone"), email: v("email") || undefined, relation: v("relation") as "MOTHER", isPrimary: f.get("primary") === "on" } });
          if (r.ok) { setOpen(false); setError(null); router.refresh(); } else setError({ message: r.message, fields: r.fieldErrors });
        });
      }}
    >
      {error && <Alert tone="danger" className="sm:col-span-2">{error.message}</Alert>}
      <Field label="Name" name="lg-name" error={error?.fields?.["guardian.name"]}><Input id="lg-name" name="name" required /></Field>
      <Field label="Relation" name="lg-relation">
        <Select id="lg-relation" name="relation" defaultValue="MOTHER">
          <option value="MOTHER">Mother</option><option value="FATHER">Father</option><option value="GUARDIAN">Guardian</option><option value="GRANDPARENT">Grandparent</option><option value="OTHER">Other</option>
        </Select>
      </Field>
      <Field label="Mobile" name="lg-phone" error={error?.fields?.["guardian.phone"]}><Input id="lg-phone" name="phone" required inputMode="tel" /></Field>
      <Field label="Email (optional)" name="lg-email" error={error?.fields?.["guardian.email"]}><Input id="lg-email" name="email" type="email" /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="primary" /> Make primary guardian</label>
      <div className="flex gap-2 sm:col-span-2">
        <Button size="sm" disabled={pending}>{pending ? "Linking…" : "Link guardian"}</Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

export function GuardianInvite({ studentId, guardianId, defaultEmail }: { studentId: string; guardianId: string; defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string; url?: string | null } | null>(null);
  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2">
        <Input aria-label="Guardian email for login" placeholder="Email for family app login" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" />
        <Button size="sm" variant="secondary" disabled={pending || !email} onClick={() => start(async () => {
          const r = await inviteGuardianAction(studentId, guardianId, email);
          setResult(r.ok ? { ok: true, text: r.data.delivered ? "Invitation emailed." : "Invitation created. Email delivery is not configured, so share the link below.", url: r.data.activationUrl } : { ok: false, text: r.message });
        })}>Invite to app</Button>
      </div>
      {result && (
        <Alert tone={result.ok ? "success" : "danger"}>
          {result.text}
          {result.url && <span className="mt-1 block break-all font-mono text-xs" data-testid="activation-url">{result.url}</span>}
        </Alert>
      )}
    </div>
  );
}

export function EnrollForm({ studentId, currentSectionId, sections }: { studentId: string; currentSectionId?: string; sections: { id: string; label: string }[] }) {
  const router = useRouter();
  const [sectionId, setSectionId] = useState(currentSectionId ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex gap-2">
        <Select aria-label="Section" value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="h-9">
          <option value="" disabled>Choose section…</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
        <Button size="sm" variant="secondary" disabled={pending || !sectionId || sectionId === currentSectionId} onClick={() => start(async () => {
          const r = await enrollStudentAction({ studentId, sectionId });
          setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Saved." : r.message });
          if (r.ok) router.refresh();
        })}>{currentSectionId ? "Move" : "Enroll"}</Button>
      </div>
      {msg && <p className={`text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
