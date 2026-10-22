"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { runAction } from "@/server/action";
import { sendAnnouncement, type announcementInput } from "@/modules/announcements/service";

export async function sendAnnouncementAction(input: z.input<typeof announcementInput>) {
  const r = await runAction(async (actor) => {
    const res = await sendAnnouncement(actor, input);
    return { inApp: res.inApp, emails: res.emails, delivered: res.delivered, provider: res.provider };
  });
  if (r.ok) revalidatePath("/app/notices");
  return r;
}
