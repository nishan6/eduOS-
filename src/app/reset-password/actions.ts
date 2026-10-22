"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";

export type ResetState = { error?: string };

export async function resetPasswordAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 10) return { error: "Use at least 10 characters." };
  if (password !== formData.get("confirm")) return { error: "Passwords do not match." };
  try {
    await auth.api.resetPassword({ body: { token, newPassword: password }, headers: await headers() });
  } catch {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }
  redirect("/login?reset=1");
}
