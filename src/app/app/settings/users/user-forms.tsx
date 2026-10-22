"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { inviteStaffAction, setMembershipAction } from "../actions";

export function InviteStaffForm({ schoolId, roles }: { schoolId: string; roles: { key: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string; url?: string | null } | null>(null);
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = new FormData(form);
      start(async () => {
        const r = await inviteStaffAction({ schoolId, name: String(f.get("name")), email: String(f.get("email")), roleKey: String(f.get("roleKey")) });
        setMsg(r.ok ? { ok: true, text: r.data.delivered ? "Invitation emailed." : "Invitation created. Email is not configured, so share this link:", url: r.data.activationUrl } : { ok: false, text: r.message });
        if (r.ok) { form.reset(); router.refresh(); }
      });
    }}>
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}{msg.url && <span className="mt-1 block break-all font-mono text-xs">{msg.url}</span>}</Alert>}
      <Field label="Name" name="name"><Input id="name" name="name" required /></Field>
      <Field label="Email" name="email"><Input id="email" name="email" type="email" required /></Field>
      <Field label="Role" name="roleKey"><Select id="roleKey" name="roleKey" defaultValue="teacher">{roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</Select></Field>
      <Button disabled={pending}>{pending ? "Inviting…" : "Send invitation"}</Button>
    </form>
  );
}

export function MembershipToggle({ schoolId, userId, status }: { schoolId: string; userId: string; status: "ACTIVE" | "SUSPENDED" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
  return (
    <Button size="sm" variant="ghost" className={status === "ACTIVE" ? "text-danger" : ""} disabled={pending}
      onClick={() => start(async () => { await setMembershipAction(schoolId, userId, next); router.refresh(); })}>
      {status === "ACTIVE" ? "Suspend" : "Reactivate"}
    </Button>
  );
}
