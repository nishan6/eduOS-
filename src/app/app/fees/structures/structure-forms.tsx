"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { rupeesToPaise } from "@/lib/money";
import { createCategoryAction, createStructureAction } from "../actions";

export function CategoryForm({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="flex flex-col gap-2 border-t border-border pt-3" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = new FormData(form);
      start(async () => {
        const r = await createCategoryAction({ schoolId, code: String(f.get("code")), name: String(f.get("name")) });
        if (r.ok) { form.reset(); setError(null); router.refresh(); } else setError(r.message);
      });
    }}>
      <div className="flex gap-2"><Input name="code" placeholder="CODE" aria-label="Category code" className="w-28" required /><Input name="name" placeholder="Name" aria-label="Category name" required /></div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button size="sm" variant="secondary" disabled={pending}>Add category</Button>
    </form>
  );
}

type Row = { categoryId: string; label: string; amount: string; dueDate: string };

export function StructureForm({ schoolId, academicYearId, grades, categories }: { schoolId: string; academicYearId: string; grades: { id: string; name: string }[]; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [rows, setRows] = useState<Row[]>([{ categoryId: categories[0]?.id ?? "", label: "", amount: "", dueDate: "" }]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault();
      const components = rows.map((r) => ({ categoryId: r.categoryId, label: r.label, amountPaise: rupeesToPaise(r.amount) ?? -1, dueDate: r.dueDate }));
      if (components.some((c) => c.amountPaise <= 0)) { setMsg({ ok: false, text: "Enter a valid rupee amount for every component." }); return; }
      start(async () => {
        const r = await createStructureAction({ schoolId, academicYearId, gradeId: gradeId || undefined, name, components });
        setMsg({ ok: r.ok, text: r.ok ? "Structure created." : r.message });
        if (r.ok) { setName(""); setRows([{ categoryId: categories[0]?.id ?? "", label: "", amount: "", dueDate: "" }]); router.refresh(); }
      });
    }}>
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
      <Field label="Name" name="sname"><Input id="sname" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Class 9 Fees 2026-27" /></Field>
      <Field label="Class" name="sgrade">
        <Select id="sgrade" value={gradeId} onChange={(e) => setGradeId(e.target.value)}><option value="">All classes</option>{grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
      </Field>
      <p className="text-sm font-medium">Components</p>
      {rows.map((r, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border p-2">
          <div className="flex gap-2">
            <Select aria-label="Category" value={r.categoryId} onChange={(e) => update(i, { categoryId: e.target.value })} className="h-9">{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            {rows.length > 1 && <Button type="button" size="icon" variant="ghost" aria-label="Remove component" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}><Trash2 /></Button>}
          </div>
          <Input aria-label="Label" placeholder="Label, e.g. Tuition - Term 1" value={r.label} onChange={(e) => update(i, { label: e.target.value })} className="h-9" required />
          <div className="flex gap-2">
            <Input aria-label="Amount in rupees" placeholder="₹ amount" inputMode="decimal" value={r.amount} onChange={(e) => update(i, { amount: e.target.value })} className="h-9" required />
            <Input aria-label="Due date" type="date" value={r.dueDate} onChange={(e) => update(i, { dueDate: e.target.value })} className="h-9" required />
          </div>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={() => setRows((rs) => [...rs, { categoryId: categories[0]?.id ?? "", label: "", amount: "", dueDate: "" }])}><Plus /> Add component</Button>
      <Button disabled={pending}>{pending ? "Saving…" : "Create structure"}</Button>
    </form>
  );
}
