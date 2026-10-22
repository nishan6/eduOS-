"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { requestResetAction, type ForgotState } from "./actions";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestResetAction, {});
  return (
    <AuthShell title="Reset your password" description="We'll email you a link to choose a new password.">
      {state.sent ? (
        <Alert tone="success" title="Check your email">
          If an account exists for that address, a reset link is on its way. In development, messages are stored in the outbox instead of being sent.
        </Alert>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          {state.error && <Alert tone="danger">{state.error}</Alert>}
          <Field label="Email" name="email"><Input id="email" name="email" type="email" required autoComplete="email" /></Field>
          <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
        </form>
      )}
      <Link href="/login" className="mt-6 block text-center text-sm text-primary hover:underline">Back to sign in</Link>
    </AuthShell>
  );
}
