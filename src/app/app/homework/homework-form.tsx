"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { cancelHomeworkAction, createHomeworkAction } from "./actions";

type Opt = { id: string; label: string };

export function HomeworkForm({ sections, subjects, today, defaultSection }: { sections: Opt[]; subjects: Opt[]; today: string; defaultSection?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    setMessage(null);
    start(async () => {
      const r = await createHomeworkAction({ sectionId: v("sectionId"), subjectId: v("subjectId"), title: v("title"), instructions: v("instructions"), dueOn: v("dueOn") });
      if (r.ok) {
        setErrors({});
        setMessage({ tone: "success", text: r.message ?? "Saved." });
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
      <Field label="Class" name="sectionId" error={errors.sectionId}>
        <Select id="sectionId" name="sectionId" defaultValue={defaultSection ?? sections[0]?.id}>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
      </Field>
      <Field label="Subject (optional)" name="subjectId" error={errors.subjectId}>
        <Select id="subjectId" name="subjectId" defaultValue="">
          <option value="">General</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
      </Field>
      <Field label="Title" name="title" error={errors.title}><Input id="title" name="title" placeholder="e.g. Fractions worksheet" /></Field>
      <Field label="Instructions" name="instructions" error={errors.instructions}><Textarea id="instructions" name="instructions" rows={4} placeholder="What should students do?" /></Field>
      <Field label="Due on" name="dueOn" error={errors.dueOn}><Input id="dueOn" name="dueOn" type="date" min={today} defaultValue={today} /></Field>
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : "Set homework"}</Button>
    </form>
  );
}

export function CancelHomeworkButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => {
        if (!confirm("Cancel this homework? Parents will see it as cancelled.")) return;
        start(async () => { const r = await cancelHomeworkAction(id); if (!r.ok) setError(r.message); });
      }}>Cancel</Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
