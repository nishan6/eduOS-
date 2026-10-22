"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { getRoster } from "@/modules/attendance/service";
import { requestCorrectionAction, saveAttendanceAction } from "../../actions";

type Roster = Awaited<ReturnType<typeof getRoster>>;
type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
const OPTIONS: { value: Status; label: string; short: string; cls: string }[] = [
  { value: "PRESENT", label: "Present", short: "P", cls: "data-[on=true]:bg-success data-[on=true]:text-white" },
  { value: "ABSENT", label: "Absent", short: "A", cls: "data-[on=true]:bg-danger data-[on=true]:text-white" },
  { value: "LATE", label: "Late", short: "L", cls: "data-[on=true]:bg-warning data-[on=true]:text-white" },
  { value: "EXCUSED", label: "Excused", short: "E", cls: "data-[on=true]:bg-foreground/70 data-[on=true]:text-background" },
];

export function AttendanceForm({ roster, today }: { roster: Roster; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [marks, setMarks] = useState<Record<string, Status | null>>(() => Object.fromEntries(roster.students.map((s) => [s.id, s.status])));
  const submitted = roster.session?.status === "SUBMITTED";
  const readOnly = submitted || !roster.canMark;

  const counts = useMemo(() => {
    const c = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, unmarked: 0 };
    for (const s of roster.students) {
      const m = marks[s.id];
      if (m) c[m]++;
      else c.unmarked++;
    }
    return c;
  }, [marks, roster.students]);

  function save(submit: boolean) {
    setMessage(null);
    const entries = roster.students.filter((s) => marks[s.id]).map((s) => ({ studentId: s.id, status: marks[s.id]! }));
    start(async () => {
      const r = await saveAttendanceAction({ sectionId: roster.section.id, date: roster.date, submit, entries });
      setMessage(r.ok ? { tone: "success", text: r.message ?? "Saved." } : { tone: "danger", text: r.message });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form className="flex items-center gap-2" method="get">
          <label htmlFor="date" className="text-sm text-muted-foreground">Date</label>
          <Input id="date" name="date" type="date" max={today} defaultValue={roster.date} className="h-9 w-40" onChange={(e) => e.currentTarget.form?.requestSubmit()} />
        </form>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge status="PRESENT" label={`${counts.PRESENT} present`} />
          <StatusBadge status="ABSENT" label={`${counts.ABSENT} absent`} />
          <StatusBadge status="LATE" label={`${counts.LATE} late`} />
          {counts.unmarked > 0 && !readOnly && <span className="text-muted-foreground">{counts.unmarked} unmarked</span>}
        </div>
      </div>

      {submitted && <Alert tone="success" title="Submitted">This attendance is final. To change a mark, request a correction; the principal approves it.</Alert>}
      {!roster.canMark && !submitted && <Alert tone="info">You can view this class but not mark its attendance.</Alert>}
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <Card>
        {!readOnly && (
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">Tap a status for each student.</p>
            <Button variant="secondary" size="sm" type="button" onClick={() => setMarks(Object.fromEntries(roster.students.map((s) => [s.id, marks[s.id] ?? "PRESENT"])))}>
              <CheckCheck /> Mark rest present
            </Button>
          </div>
        )}
        <ul className="divide-y divide-border">
          {roster.students.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-medium"><span className="mr-2 inline-block w-6 text-right text-sm tabular-nums text-muted-foreground">{s.rollNo ?? ""}</span>{s.name}</p>
                <p className="pl-8 text-xs text-muted-foreground">{s.admissionNo}{s.remark ? ` · ${s.remark}` : ""}</p>
              </div>
              {readOnly ? (
                <div className="flex items-center gap-2 pl-8 sm:pl-0">
                  {s.status ? <StatusBadge status={s.status} /> : <span className="text-sm text-muted-foreground">Not marked</span>}
                  {submitted && roster.canMark && s.attendanceId && (
                    s.pendingCorrection ? <span className="text-xs text-warning">Correction to {s.pendingCorrection.toStatus.toLowerCase()} pending</span>
                      : <CorrectionButton attendanceId={s.attendanceId} current={s.status!} onDone={() => router.refresh()} />
                  )}
                </div>
              ) : (
                <div className="flex gap-1 pl-8 sm:pl-0" role="radiogroup" aria-label={`Attendance for ${s.name}`}>
                  {OPTIONS.map((o) => (
                    <button key={o.value} type="button" role="radio" aria-checked={marks[s.id] === o.value} aria-label={o.label} data-on={marks[s.id] === o.value}
                      onClick={() => setMarks((m) => ({ ...m, [s.id]: o.value }))}
                      className={cn("h-9 min-w-11 rounded-lg border border-border px-2 text-sm font-medium transition-colors hover:bg-surface-muted", o.cls)}>
                      <span className="sm:hidden">{o.short}</span><span className="hidden sm:inline">{o.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {!readOnly && roster.students.length > 0 && (
        <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Button variant="secondary" disabled={pending || counts.unmarked === roster.students.length} onClick={() => save(false)}>Save draft</Button>
          <Button disabled={pending || counts.unmarked > 0} onClick={() => save(true)}>{pending ? "Saving…" : `Submit attendance`}</Button>
        </div>
      )}
    </div>
  );
}

function CorrectionButton({ attendanceId, current, onDone }: { attendanceId: string; current: Status; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [toStatus, setToStatus] = useState<Status>(current === "ABSENT" ? "PRESENT" : "ABSENT");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open) return <Button variant="link" size="sm" onClick={() => setOpen(true)}>Request correction</Button>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select aria-label="Correct to" value={toStatus} onChange={(e) => setToStatus(e.target.value as Status)} className="h-8 w-28">
        {OPTIONS.filter((o) => o.value !== current).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
      <Input aria-label="Reason" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 w-48" />
      <Button size="sm" disabled={pending} onClick={() => start(async () => {
        const r = await requestCorrectionAction({ attendanceId, toStatus, reason });
        if (r.ok) { setOpen(false); onDone(); } else setError(r.message);
      })}>Send</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      {error && <p className="w-full text-xs text-danger">{error}</p>}
    </div>
  );
}
