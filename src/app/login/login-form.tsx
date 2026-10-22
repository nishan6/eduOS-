"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { signInAction, type LoginState } from "./actions";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      {notice && !state.error && <Alert tone="warning">{notice}</Alert>}
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" name="email">
        <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} />
      </Field>
      <Field label="Password" name="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending} size="lg">{pending ? "Signing in…" : "Sign in"}</Button>
      <Link href="/forgot-password" className="text-center text-sm text-primary hover:underline">Forgot your password?</Link>
    </form>
  );
}
