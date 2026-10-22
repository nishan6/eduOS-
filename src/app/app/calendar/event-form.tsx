"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { createEventAction, deleteEventAction } from "./actions";

export function EventForm({ schoolId, today }: { schoolId: string; today: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form ref={formRef} className="space-y-4" noValidate onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const v = (k: string) => String(f.get(k) ?? "");
      start(async () => {
        const r = await createEventAction({
          schoolId, title: v("title"), description: v("description"), kind: v("kind") as "EVENT",
          audience: v("audience") as "EVERYONE", startsOn: v("startsOn"), endsOn: v("endsOn"),
        });
        setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Added." : r.message });
        setErrors(r.ok ? {} : r.fieldErrors ?? {});
        if (r.ok) formRef.current?.reset();
      });
    }}>
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
      <Field label="Title" name="title" error={errors.title}><Input id="title" name="title" placeholder="e.g. Diwali holidays" /></Field>
      <Field label="Type" name="kind">
        <Select id="kind" name="kind" defaultValue="EVENT"><option value="HOLIDAY">Holiday</option><option value="EXAM">Exam</option><option value="EVENT">Event</option><option value="MEETING">Meeting</option></Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From" name="startsOn" error={errors.startsOn}><Input id="startsOn" name="startsOn" type="date" defaultValue={today} /></Field>
        <Field label="To (optional)" name="endsOn" error={errors.endsOn}><Input id="endsOn" name="endsOn" type="date" /></Field>
      </div>
      <Field label="Who sees it" name="audience">
        <Select id="audience" name="audience" defaultValue="EVERYONE"><option value="EVERYONE">Staff and parents</option><option value="STAFF">Staff only</option></Select>
      </Field>
      <Field label="Details (optional)" name="description"><Textarea id="description" name="description" rows={3} /></Field>
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : "Add to calendar"}</Button>
    </form>
  );
}

export function DeleteEventButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="icon" variant="ghost" aria-label="Remove event" disabled={pending} onClick={() => {
      if (confirm("Remove this event from the calendar?")) start(async () => { await deleteEventAction(id); });
    }}><Trash2 /></Button>
  );
}
