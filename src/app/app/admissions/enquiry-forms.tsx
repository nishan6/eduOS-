"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { addNoteAction, convertEnquiryAction, createEnquiryAction, moveStageAction } from "./actions";

type Opt = { id: string; label: string };
type Errors = Record<string, string[]>;
const val = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export function EnquiryForm({ schoolId, grades }: { schoolId: string; grades: Opt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setMessage(null);
    start(async () => {
      const r = await createEnquiryAction({
        schoolId, gradeId: val(f, "gradeId"), childFirstName: val(f, "childFirstName"), childLastName: val(f, "childLastName"),
        dateOfBirth: val(f, "dateOfBirth"), gender: val(f, "gender") as "MALE", guardianName: val(f, "guardianName"), phone: val(f, "phone"),
        email: val(f, "email"), source: val(f, "source"), followUpOn: val(f, "followUpOn"), note: val(f, "note"),
      });
      if (r.ok) router.push(`/app/admissions/${r.data}`);
      else { setErrors(r.fieldErrors ?? {}); setMessage(r.message); }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {message && <Alert tone="danger">{message}</Alert>}
      <Card>
        <CardHeader><div><CardTitle>Child</CardTitle></div></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" name="childFirstName" error={errors.childFirstName}><Input id="childFirstName" name="childFirstName" autoComplete="off" /></Field>
          <Field label="Last name" name="childLastName" error={errors.childLastName}><Input id="childLastName" name="childLastName" autoComplete="off" /></Field>
          <Field label="Class applying for" name="gradeId" error={errors.gradeId}>
            <Select id="gradeId" name="gradeId" defaultValue="">
              <option value="" disabled>Choose…</option>
              {grades.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </Select>
          </Field>
          <Field label="Date of birth (optional)" name="dateOfBirth" error={errors.dateOfBirth}><Input id="dateOfBirth" name="dateOfBirth" type="date" /></Field>
          <Field label="Gender (optional)" name="gender">
            <Select id="gender" name="gender" defaultValue=""><option value="">Not given</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option></Select>
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>Parent or guardian</CardTitle></div></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Guardian name" name="guardianName" error={errors.guardianName}><Input id="guardianName" name="guardianName" /></Field>
          <Field label="Mobile number" name="phone" error={errors.phone}><Input id="phone" name="phone" inputMode="tel" placeholder="10-digit mobile" /></Field>
          <Field label="Email (optional)" name="email" error={errors.email}><Input id="email" name="email" type="email" /></Field>
          <Field label="How did they hear about us? (optional)" name="source">
            <Select id="source" name="source" defaultValue=""><option value="">Not asked</option><option>Walk-in</option><option>Phone</option><option>Website</option><option>Referral</option><option>Sibling</option><option>Advertisement</option></Select>
          </Field>
          <Field label="Follow up on (optional)" name="followUpOn" error={errors.followUpOn}><Input id="followUpOn" name="followUpOn" type="date" /></Field>
          <Field label="Notes (optional)" name="note" className="sm:col-span-2"><Textarea id="note" name="note" rows={3} /></Field>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Log enquiry"}</Button>
      </div>
    </form>
  );
}

const MOVABLE: { value: string; label: string }[] = [
  { value: "CONTACTED", label: "Contacted" }, { value: "VISIT_SCHEDULED", label: "Visit scheduled" }, { value: "APPLIED", label: "Applied" },
  { value: "OFFERED", label: "Offered" }, { value: "NEW", label: "New" }, { value: "LOST", label: "Lost" },
];

export function StageForm({ enquiryId, current }: { enquiryId: string; current: string }) {
  const [to, setTo] = useState(MOVABLE.find((m) => m.value !== current)!.value);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      start(async () => {
        const r = await moveStageAction({ enquiryId, toStage: to as "CONTACTED", note: val(f, "stageNote"), followUpOn: val(f, "stageFollowUp"), lostReason: val(f, "lostReason") });
        setMessage({ ok: r.ok, text: r.ok ? r.message ?? "Updated." : r.message });
        if (r.ok) formRef.current?.reset();
      });
    }}>
      {message && <Alert tone={message.ok ? "success" : "danger"}>{message.text}</Alert>}
      <Field label="Move to" name="toStage">
        <Select id="toStage" value={to} onChange={(e) => setTo(e.target.value)}>
          {MOVABLE.filter((m) => m.value !== current).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </Select>
      </Field>
      {to === "LOST" ? (
        <Field label="Reason lost" name="lostReason"><Input id="lostReason" name="lostReason" placeholder="e.g. Chose another school" /></Field>
      ) : (
        <>
          <Field label="Note (optional)" name="stageNote"><Input id="stageNote" name="stageNote" /></Field>
          <Field label="Next follow-up (optional)" name="stageFollowUp"><Input id="stageFollowUp" name="stageFollowUp" type="date" /></Field>
        </>
      )}
      <Button type="submit" size="sm" disabled={pending}>Update stage</Button>
    </form>
  );
}

export function NoteForm({ enquiryId }: { enquiryId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} className="space-y-2" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      start(async () => {
        const r = await addNoteAction(enquiryId, val(f, "note"), val(f, "noteFollowUp") || undefined);
        if (r.ok) { setError(null); formRef.current?.reset(); } else setError(r.message);
      });
    }}>
      <Textarea aria-label="Note" name="note" rows={2} placeholder="Called, spoke to mother, visiting Saturday…" />
      <div className="flex items-center gap-2">
        <label htmlFor="noteFollowUp" className="text-xs text-muted-foreground">Follow up</label>
        <Input id="noteFollowUp" name="noteFollowUp" type="date" className="h-8 w-40" />
        <Button size="sm" type="submit" disabled={pending} className="ml-auto">Add note</Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

export function ConvertForm({ enquiryId, sections, dateOfBirth, gender }: { enquiryId: string; sections: Opt[]; dateOfBirth: string | null; gender: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader><div><CardTitle>Admit student</CardTitle><CardDescription>Creates the student record, enrolls them and links the guardian.</CardDescription></div></CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setMessage(null);
          start(async () => {
            const r = await convertEnquiryAction({
              enquiryId, admissionNo: val(f, "admissionNo"), sectionId: val(f, "sectionId"), dateOfBirth: val(f, "convertDob"),
              gender: val(f, "convertGender") as "MALE", relation: val(f, "relation") as "FATHER",
            });
            if (r.ok) router.push(`/app/students/${r.data}`);
            else { setErrors(r.fieldErrors ?? {}); setMessage(r.message); }
          });
        }}>
          {message && <Alert tone="danger" className="sm:col-span-2">{message}</Alert>}
          <Field label="Admission number" name="admissionNo" error={errors.admissionNo}><Input id="admissionNo" name="admissionNo" /></Field>
          <Field label="Section" name="sectionId" error={errors.sectionId}>
            <Select id="sectionId" name="sectionId" defaultValue="">
              <option value="" disabled>Choose…</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Date of birth" name="convertDob" error={errors.dateOfBirth}><Input id="convertDob" name="convertDob" type="date" defaultValue={dateOfBirth ?? ""} /></Field>
          <Field label="Gender" name="convertGender">
            <Select id="convertGender" name="convertGender" defaultValue={gender ?? "UNDISCLOSED"}>
              <option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option><option value="UNDISCLOSED">Prefer not to say</option>
            </Select>
          </Field>
          <Field label="Guardian relation" name="relation">
            <Select id="relation" name="relation" defaultValue="FATHER">
              <option value="FATHER">Father</option><option value="MOTHER">Mother</option><option value="GUARDIAN">Guardian</option><option value="GRANDPARENT">Grandparent</option><option value="OTHER">Other</option>
            </Select>
          </Field>
          <div className="flex items-end justify-end"><Button type="submit" disabled={pending}>{pending ? "Admitting…" : "Admit student"}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}
