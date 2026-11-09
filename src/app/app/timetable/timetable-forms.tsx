"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { TimetableGrid, WEEKDAYS, type Cell } from "@/components/timetable-grid";
import { addSlotAction, removeSlotAction, setEntryAction } from "./actions";

type Opt = { id: string; label: string };
type Slot = { id: string; label: string; startTime: string; endTime: string; isBreak: boolean };

export function EditableTimetable({ sectionId, slots, grid, subjects, staff }: {
  sectionId: string; slots: Slot[]; grid: Record<number, Record<string, Cell>>; subjects: Opt[]; staff: Opt[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(day: number, slotId: string, subjectId: string, teacherId: string) {
    setError(null);
    start(async () => {
      const r = await setEntryAction({ sectionId, dayOfWeek: day, slotId, subjectId, teacherId });
      if (r.ok) setEditing(null);
      else setError(r.message);
    });
  }

  return (
    <>
      {error && <Alert tone="danger" className="mx-5 mb-3">{error}</Alert>}
      <TimetableGrid slots={slots} grid={grid} renderCell={(day, slot, cell) => {
        const key = `${day}:${slot.id}`;
        const dayName = WEEKDAYS.find((d) => d.value === day)!.short;
        if (editing !== key) {
          return (
            <button type="button" onClick={() => { setEditing(key); setError(null); }} aria-label={`Edit ${dayName} ${slot.label}`}
              className="w-full rounded-md px-1.5 py-1 text-left hover:bg-surface-muted">
              {cell ? <><span className="block font-medium">{cell.subject}</span><span className="block text-xs text-muted-foreground">{cell.teacher ?? "No teacher"}</span></>
                : <span className="text-xs text-muted-foreground">+ Add</span>}
            </button>
          );
        }
        return (
          <form className="flex flex-col gap-1" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save(day, slot.id, String(f.get("subjectId") ?? ""), String(f.get("teacherId") ?? ""));
          }}>
            <Select name="subjectId" aria-label={`Subject for ${dayName} ${slot.label}`} defaultValue={cell?.subjectId ?? ""} className="h-8 text-xs">
              <option value="">(empty)</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
            <Select name="teacherId" aria-label={`Teacher for ${dayName} ${slot.label}`} defaultValue={cell?.teacherId ?? ""} className="h-8 text-xs">
              <option value="">No teacher</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
            <div className="flex gap-1">
              <Button size="sm" type="submit" disabled={pending} className="h-7 flex-1 px-2 text-xs">Save</Button>
              <Button size="sm" type="button" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        );
      }} />
    </>
  );
}

export function SlotManager({ schoolId, slots }: { schoolId: string; slots: Slot[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ul className="divide-y divide-border rounded-lg border border-border">
        {slots.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No periods yet.</li>}
        {slots.map((s) => (
          <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="flex-1 font-medium">{s.label}{s.isBreak && <span className="ml-1 text-xs font-normal text-muted-foreground">(break)</span>}</span>
            <span className="tabular-nums text-muted-foreground">{s.startTime}–{s.endTime}</span>
            <Button size="icon" variant="ghost" aria-label={`Remove ${s.label}`} disabled={pending} onClick={() => start(async () => {
              const r = await removeSlotAction(s.id);
              setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Removed." : r.message });
            })}><X /></Button>
          </li>
        ))}
      </ul>
      <form className="flex flex-col gap-3" onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        start(async () => {
          const r = await addSlotAction({ schoolId, label: String(f.get("label")), startTime: String(f.get("startTime")), endTime: String(f.get("endTime")), isBreak: f.get("isBreak") === "on" });
          setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Added." : r.message });
          if (r.ok) form.reset();
        });
      }}>
        {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
        <Field label="Period name" name="label"><Input id="label" name="label" placeholder="e.g. Period 3" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" name="startTime"><Input id="startTime" name="startTime" type="time" /></Field>
          <Field label="Ends" name="endTime"><Input id="endTime" name="endTime" type="time" /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isBreak" /> This is a break</label>
        <Button variant="secondary" disabled={pending}>Add period</Button>
      </form>
    </div>
  );
}
