"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";

export type LoginState = { error?: string; email?: string };

const schema = z.object({ email: z.email(), password: z.string().min(1) });

export async function signInAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: "Enter your email and password.", email };
  try {
    const res = await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
    if (res && typeof res === "object" && "twoFactorRedirect" in res && res.twoFactorRedirect) {
      return { error: "Two-factor verification is enabled for this account but the verification screen is not available yet.", email };
    }
  } catch (e) {
    if (e instanceof APIError) {
      if (e.status === "TOO_MANY_REQUESTS") return { error: "Too many attempts. Wait a minute and try again.", email };
      if (e.status === "FORBIDDEN") return { error: e.message || "This account is not active.", email };
      return { error: "Incorrect email or password.", email };
    }
    throw e;
  }
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/app") ? next : "/app");
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
