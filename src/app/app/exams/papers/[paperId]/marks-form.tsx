"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { validateMark } from "@/modules/exams/calc";
import type { getPaper } from "@/modules/exams/service";
import { saveMarksAction } from "../../actions";

type Paper = Awaited<ReturnType<typeof getPaper>>;
type Entry = { value: string; isAbsent: boolean };

export function MarksForm({ paper }: { paper: Paper }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(paper.students.map((s) => [s.id, { value: s.marks === null ? "" : String(s.marks), isAbsent: s.isAbsent }])),
  );
  const readOnly = !paper.canEnter;

  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of paper.students) {
      const e = entries[s.id]!;
      if (e.isAbsent || e.value.trim() === "") continue;
      const err = validateMark(Number(e.value), paper.maxMarks);
      if (err) out[s.id] = err;
    }
    return out;
  }, [entries, paper]);
  const missing = paper.students.filter((s) => !entries[s.id]!.isAbsent && entries[s.id]!.value.trim() === "").length;

  function save(submit: boolean) {
    setMessage(null);
    const payload = paper.students.map((s) => {
      const e = entries[s.id]!;
      return { studentId: s.id, isAbsent: e.isAbsent, marks: e.isAbsent || e.value.trim() === "" ? null : Number(e.value) };
    });
    start(async () => {
      const r = await saveMarksAction({ paperId: paper.id, submit, entries: payload });
      setServerErrors(r.ok ? {} : r.fieldErrors ?? {});
      setMessage(r.ok ? { tone: "success", text: r.message ?? "Saved." } : { tone: "danger", text: r.message });
      if (r.ok) router.refresh();
    });
  }

  const set = (id: string, patch: Partial<Entry>) => setEntries((m) => ({ ...m, [id]: { ...m[id]!, ...patch } }));

  return (
    <div className="space-y-4">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Card>
        <ul className="divide-y divide-border">
          {paper.students.map((s) => {
            const e = entries[s.id]!;
            const err = errors[s.id] ?? serverErrors[s.id]?.[0];
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-6 text-right text-sm tabular-nums text-muted-foreground">{s.rollNo ?? ""}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.admissionNo}</p>
                </div>
                {readOnly ? (
                  e.isAbsent ? <Badge tone="danger">Absent</Badge> : <span className="tabular-nums">{e.value === "" ? "—" : e.value} / {paper.maxMarks}</span>
                ) : (
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input type="checkbox" checked={e.isAbsent} onChange={(ev) => set(s.id, { isAbsent: ev.target.checked })} aria-label={`${s.name} absent`} /> Absent
                      </label>
                      <input
                        inputMode="decimal" aria-label={`Marks for ${s.name}`} aria-invalid={!!err} disabled={e.isAbsent}
                        value={e.isAbsent ? "" : e.value} onChange={(ev) => set(s.id, { value: ev.target.value })}
                        className="h-9 w-20 rounded-lg border border-border bg-surface px-2 text-right tabular-nums aria-[invalid=true]:border-danger disabled:opacity-50"
                      />
                      <span className="w-10 text-xs text-muted-foreground">/ {paper.maxMarks}</span>
                    </div>
                    {err && <p className="text-xs text-danger" role="alert">{err}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      {!readOnly && (
        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          {missing > 0 && <span className="mr-auto text-sm text-muted-foreground">{missing} not entered</span>}
          <Button variant="secondary" disabled={pending || Object.keys(errors).length > 0} onClick={() => save(false)}>Save</Button>
          <Button disabled={pending || missing > 0 || Object.keys(errors).length > 0} onClick={() => save(true)}>{pending ? "Saving…" : "Submit marks"}</Button>
        </div>
      )}
    </div>
  );
}
