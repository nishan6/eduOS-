"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { activateAction, type ActivateState } from "./actions";

export function ActivateForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ActivateState, FormData>(activateAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <Field label="Password" name="password" hint="At least 10 characters." error={state.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Field label="Confirm password" name="confirm" error={state.fieldErrors?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Activating…" : "Activate account"}</Button>
    </form>
  );
}
