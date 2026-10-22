"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { createStudentAction } from "../actions";

type Errors = Record<string, string[]>;

export function NewStudentForm({ schoolId, sections }: { schoolId: string; sections: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [withGuardian, setWithGuardian] = useState(true);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    setMessage(null);
    start(async () => {
      const r = await createStudentAction({
        schoolId,
        admissionNo: v("admissionNo"),
        firstName: v("firstName"),
        lastName: v("lastName"),
        dateOfBirth: v("dateOfBirth"),
        gender: v("gender") as "MALE",
        sectionId: v("sectionId"),
        rollNo: v("rollNo") ? Number(v("rollNo")) : undefined,
        guardian: withGuardian
          ? { name: v("gName"), phone: v("gPhone"), email: v("gEmail") || undefined, relation: v("gRelation") as "FATHER", isPrimary: true }
          : undefined,
      });
      if (r.ok) router.push(`/app/students/${r.data}`);
      else {
        setErrors(r.fieldErrors ?? {});
        setMessage(r.message);
      }
    });
  }
  const err = (k: string) => errors[k];

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {message && <Alert tone="danger">{message}</Alert>}
      <Card>
        <CardHeader><div><CardTitle>Student details</CardTitle><CardDescription>Admission numbers must be unique within the school.</CardDescription></div></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Admission number" name="admissionNo" error={err("admissionNo")}><Input id="admissionNo" name="admissionNo" required aria-invalid={!!err("admissionNo")} /></Field>
          <Field label="Class and section" name="sectionId" error={err("sectionId")}>
            <Select id="sectionId" name="sectionId" required defaultValue="">
              <option value="" disabled>Choose…</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="First name" name="firstName" error={err("firstName")}><Input id="firstName" name="firstName" required autoComplete="off" /></Field>
          <Field label="Last name" name="lastName" error={err("lastName")}><Input id="lastName" name="lastName" required autoComplete="off" /></Field>
          <Field label="Date of birth" name="dateOfBirth" error={err("dateOfBirth")}><Input id="dateOfBirth" name="dateOfBirth" type="date" required /></Field>
          <Field label="Gender" name="gender" error={err("gender")}>
            <Select id="gender" name="gender" defaultValue="UNDISCLOSED">
              <option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option><option value="UNDISCLOSED">Prefer not to say</option>
            </Select>
          </Field>
          <Field label="Roll number (optional)" name="rollNo" error={err("rollNo")}><Input id="rollNo" name="rollNo" type="number" min={1} /></Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div><CardTitle>Primary guardian</CardTitle><CardDescription>If this phone number already belongs to a guardian in your group, the existing record is reused (siblings share one guardian).</CardDescription></div>
          <label className="flex shrink-0 items-center gap-2 text-sm"><input type="checkbox" checked={withGuardian} onChange={(e) => setWithGuardian(e.target.checked)} /> Add now</label>
        </CardHeader>
        {withGuardian && (
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Guardian name" name="gName" error={err("guardian.name")}><Input id="gName" name="gName" required /></Field>
            <Field label="Relation" name="gRelation" error={err("guardian.relation")}>
              <Select id="gRelation" name="gRelation" defaultValue="FATHER">
                <option value="FATHER">Father</option><option value="MOTHER">Mother</option><option value="GUARDIAN">Guardian</option><option value="GRANDPARENT">Grandparent</option><option value="OTHER">Other</option>
              </Select>
            </Field>
            <Field label="Mobile number" name="gPhone" error={err("guardian.phone")}><Input id="gPhone" name="gPhone" inputMode="tel" required placeholder="10-digit mobile" /></Field>
            <Field label="Email (optional)" name="gEmail" error={err("guardian.email")}><Input id="gEmail" name="gEmail" type="email" /></Field>
          </CardContent>
        )}
      </Card>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Create student"}</Button>
      </div>
    </form>
  );
}
