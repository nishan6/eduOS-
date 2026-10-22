"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { sendAnnouncementAction } from "./actions";

type Opt = { id: string; label: string };
type Audience = "SCHOOL_PARENTS" | "GRADE_PARENTS" | "SECTION_PARENTS";

export function AnnouncementForm({ schoolId, schoolWide, grades, sections }: { schoolId: string; schoolWide: boolean; grades: Opt[]; sections: Opt[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [audience, setAudience] = useState<Audience>(schoolWide ? "SCHOOL_PARENTS" : "SECTION_PARENTS");
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<{ tone: "success" | "danger" | "warning"; text: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "");
    if (!confirm("Send this notice to parents now? It cannot be unsent.")) return;
    setMessage(null);
    start(async () => {
      const r = await sendAnnouncementAction({ schoolId, audience, title: v("title"), body: v("body"), gradeId: v("gradeId"), sectionId: v("sectionId") });
      if (r.ok) {
        const { inApp, emails, delivered, provider } = r.data;
        const emailNote = emails === 0 ? "" : delivered === emails ? ` ${emails} emailed.` : provider === "development-outbox"
          ? ` ${emails} emails were written to the development outbox (no email provider is configured, so none were delivered).`
          : ` ${delivered} of ${emails} emails delivered.`;
        setMessage({ tone: delivered < emails ? "warning" : "success", text: `Sent. ${inApp} parents notified in the app.${emailNote}` });
        setErrors({});
        formRef.current?.reset();
      } else {
        setErrors(r.fieldErrors ?? {});
        setMessage({ tone: "danger", text: r.message });
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Field label="Send to" name="audience">
        <Select id="audience" name="audience" value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
          {schoolWide && <option value="SCHOOL_PARENTS">All parents</option>}
          {schoolWide && <option value="GRADE_PARENTS">Parents of a class</option>}
          {sections.length > 0 && <option value="SECTION_PARENTS">Parents of a section</option>}
        </Select>
      </Field>
      {audience === "GRADE_PARENTS" && (
        <Field label="Class" name="gradeId" error={errors.gradeId}>
          <Select id="gradeId" name="gradeId">{grades.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</Select>
        </Field>
      )}
      {audience === "SECTION_PARENTS" && (
        <Field label="Section" name="sectionId" error={errors.sectionId}>
          <Select id="sectionId" name="sectionId">{sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>
        </Field>
      )}
      <Field label="Title" name="title" error={errors.title}><Input id="title" name="title" placeholder="e.g. PTM on Saturday" /></Field>
      <Field label="Message" name="body" error={errors.body}><Textarea id="body" name="body" rows={5} /></Field>
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending…" : "Send notice"}</Button>
    </form>
  );
}
