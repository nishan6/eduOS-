"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { createExamAction, publishExamAction, reopenPaperAction } from "./actions";

type Opt = { id: string; label: string };

export function CreateExamForm({ schoolId, grades, subjects }: { schoolId: string; grades: Opt[]; subjects: Opt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const chosen = subjects.filter((s) => f.get(`subject-${s.id}`) === "on").map((s) => ({ subjectId: s.id, maxMarks: Number(f.get(`max-${s.id}`) || 0) }));
    setError(null);
    start(async () => {
      const r = await createExamAction({
        schoolId, name: String(f.get("name") ?? ""), startsOn: String(f.get("startsOn") ?? ""),
        gradeIds: grades.filter((g) => f.get(`grade-${g.id}`) === "on").map((g) => g.id), subjects: chosen,
      });
      if (r.ok) router.push(`/app/exams/${r.data}`);
      else { setError(r.message); setErrors(r.fieldErrors ?? {}); }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Exam name" name="name" error={errors.name}><Input id="name" name="name" placeholder="e.g. Unit Test 2" /></Field>
      <Field label="Starts on (optional)" name="startsOn"><Input id="startsOn" name="startsOn" type="date" /></Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Classes</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {grades.map((g) => (
            <label key={g.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name={`grade-${g.id}`} defaultChecked /> {g.label}</label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Subjects and maximum marks</legend>
        <div className="space-y-2">
          {subjects.map((s) => (
            <div key={s.id} className="flex items-center gap-3">
              <label className="flex flex-1 items-center gap-2 text-sm"><input type="checkbox" name={`subject-${s.id}`} defaultChecked /> {s.label}</label>
              <Input aria-label={`Maximum marks for ${s.label}`} name={`max-${s.id}`} type="number" min={5} max={200} defaultValue={50} className="h-9 w-20" />
            </div>
          ))}
        </div>
      </fieldset>
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Creating…" : "Create exam"}</Button>
    </form>
  );
}

export function PublishButton({ examId, disabled }: { examId: string; disabled: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button disabled={disabled || pending} onClick={() => {
        if (!confirm("Publish results? Parents will see report cards and marks will be locked.")) return;
        start(async () => { const r = await publishExamAction(examId); setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Published." : r.message }); });
      }}>{pending ? "Publishing…" : "Publish results"}</Button>
      {msg && <p className={msg.ok ? "text-xs text-success" : "text-xs text-danger"} role="status">{msg.text}</p>}
    </div>
  );
}

export function ReopenPaper({ paperId }: { paperId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open) return <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Reopen for corrections</Button>;
  return (
    <div className="w-full max-w-sm space-y-2">
      <Textarea aria-label="Reason for reopening" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why do the marks need changing?" />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await reopenPaperAction(paperId, reason); if (!r.ok) setError(r.message); else setOpen(false); })}>Reopen</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
