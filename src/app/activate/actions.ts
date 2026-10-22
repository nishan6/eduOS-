"use server";

import { redirect } from "next/navigation";
import { toActionError } from "@/lib/errors";
import { acceptInvitation } from "@/modules/identity/service";

export type ActivateState = { error?: string; fieldErrors?: Record<string, string[]> };

export async function activateAction(_prev: ActivateState, formData: FormData): Promise<ActivateState> {
  try {
    await acceptInvitation({
      token: String(formData.get("token") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirm: String(formData.get("confirm") ?? ""),
    });
  } catch (e) {
    const r = toActionError(e);
    return { error: r.message, fieldErrors: r.fieldErrors };
  }
  redirect("/login?reset=1");
}
