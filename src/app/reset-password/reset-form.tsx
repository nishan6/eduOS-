"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { resetPasswordAction, type ResetState } from "./actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPasswordAction, {});
  if (!token) return <Alert tone="danger">This link is missing its token. Request a new reset email.</Alert>;
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" hint="At least 10 characters."><Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} /></Field>
      <Field label="Confirm password" name="confirm"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></Field>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Set password"}</Button>
    </form>
  );
}
