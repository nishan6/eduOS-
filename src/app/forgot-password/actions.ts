"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";

export type ForgotState = { sent?: boolean; error?: string };

export async function requestResetAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };
  try {
    await auth.api.requestPasswordReset({ body: { email: email.data, redirectTo: "/reset-password" }, headers: await headers() });
  } catch {
    // Same response whether or not the account exists, and when rate limited, to avoid account enumeration.
  }
  return { sent: true };
}
