"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { runAction } from "@/server/action";
import { createEvent, deleteEvent, type eventInput } from "@/modules/events/service";

export async function createEventAction(input: z.input<typeof eventInput>) {
  const r = await runAction((actor) => createEvent(actor, input).then(() => undefined), "Added to the calendar.");
  if (r.ok) revalidatePath("/app/calendar");
  return r;
}

export async function deleteEventAction(id: string) {
  const r = await runAction((actor) => deleteEvent(actor, id), "Removed.");
  if (r.ok) revalidatePath("/app/calendar");
  return r;
}
