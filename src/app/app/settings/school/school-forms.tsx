"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import type { ActionResult } from "@/lib/errors";
import { addClassAction, assignTeacherAction, createSchoolAction, setGradingAction } from "../actions";

function useSubmit() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string; fields?: Record<string, string[]> } | null>(null);
  const run = (fn: () => Promise<ActionResult<unknown>>, onOk?: () => void) => start(async () => {
    const r = await fn();
    setMsg(r.ok ? { ok: true, text: r.message ?? "Saved." } : { ok: false, text: r.message, fields: r.fieldErrors });
    if (r.ok) { onOk?.(); router.refresh(); }
  });
  return { pending, msg, run };
}

export function AddClassForm({ schoolId }: { schoolId: string }) {
  const { pending, msg, run } = useSubmit();
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = new FormData(form);
      run(() => addClassAction({ schoolId, gradeName: String(f.get("gradeName")), order: Number(f.get("order")), sections: String(f.get("sections")) }), () => form.reset());
    }}>
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
      <Field label="Class name" name="gradeName"><Input id="gradeName" name="gradeName" placeholder="Class 9" required /></Field>
      <Field label="Sort order" name="order"><Input id="order" name="order" type="number" min={0} max={20} defaultValue={9} /></Field>
      <Field label="Sections" name="sections" hint="Comma separated, e.g. A,B,C"><Input id="sections" name="sections" defaultValue="A" required /></Field>
      <Button variant="secondary" disabled={pending}>Save class</Button>
    </form>
  );
}

export function AssignTeacherForm({ schoolId, staff, sections }: { schoolId: string; staff: { id: string; name: string }[]; sections: { id: string; label: string }[] }) {
  const { pending, msg, run } = useSubmit();
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      run(() => assignTeacherAction({ schoolId, userId: String(f.get("userId")), sectionId: String(f.get("sectionId")), isClassTeacher: f.get("ct") === "on" }));
    }}>
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
      <Field label="Teacher" name="userId"><Select id="userId" name="userId" required defaultValue=""><option value="" disabled>Choose…</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Section" name="sectionId"><Select id="sectionId" name="sectionId" required defaultValue=""><option value="" disabled>Choose…</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ct" /> Class teacher</label>
      <Button variant="secondary" disabled={pending}>Assign</Button>
    </form>
  );
}

export function CreateSchoolForm({ organizationId }: { organizationId: string }) {
  const { pending, msg, run } = useSubmit();
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = new FormData(form);
      const v = (k: string) => String(f.get(k) ?? "").trim();
      run(() => createSchoolAction({
        organizationId, name: v("name"), code: v("code"), board: v("board") as "CBSE", city: v("city") || undefined, state: v("state") || undefined,
        academicYear: { name: v("yname"), startDate: v("ystart"), endDate: v("yend") },
      }), () => form.reset());
    }}>
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
      <Field label="School name" name="name" error={msg?.fields?.name}><Input id="name" name="name" required /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Code" name="code" error={msg?.fields?.code}><Input id="code" name="code" placeholder="ABC" required /></Field>
        <Field label="Board" name="board"><Select id="board" name="board" defaultValue="CBSE"><option value="CBSE">CBSE</option><option value="AP_STATE">AP State Board</option><option value="ICSE">ICSE</option><option value="IB">IB</option><option value="OTHER">Other</option></Select></Field>
        <Field label="City" name="city"><Input id="city" name="city" /></Field>
        <Field label="State" name="state"><Input id="state" name="state" defaultValue="Andhra Pradesh" /></Field>
      </div>
      <Field label="Academic year" name="yname" error={msg?.fields?.["academicYear.name"]}><Input id="yname" name="yname" defaultValue="2026-27" required /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Starts" name="ystart"><Input id="ystart" name="ystart" type="date" defaultValue="2026-06-01" required /></Field>
        <Field label="Ends" name="yend"><Input id="yend" name="yend" type="date" defaultValue="2027-04-30" required /></Field>
      </div>
      <Button variant="secondary" disabled={pending}>Create school</Button>
    </form>
  );
}

export function GradingForm({ schoolId, scale, passPercent, options }: { schoolId: string; scale: string; passPercent: number; options: { value: string; label: string }[] }) {
  const { pending, msg, run } = useSubmit();
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      run(() => setGradingAction({ schoolId, scale: String(f.get("scale")) as "CBSE_9_POINT", passPercent: Number(f.get("passPercent")) }));
    }}>
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
      <Field label="Grading scale" name="scale">
        <Select id="scale" name="scale" defaultValue={scale}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
      </Field>
      <Field label="Pass mark (%)" name="passPercent" hint="Per subject. Applies to exams created after saving.">
        <Input id="passPercent" name="passPercent" type="number" min={20} max={60} defaultValue={passPercent} />
      </Field>
      <Button variant="secondary" disabled={pending}>Save grading</Button>
    </form>
  );
}
