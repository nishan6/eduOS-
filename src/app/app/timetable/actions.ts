"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { runAction } from "@/server/action";
import { addSlot, removeSlot, setEntry, type entryInput, type slotInput } from "@/modules/timetable/service";

export async function addSlotAction(input: z.input<typeof slotInput>) {
  const r = await runAction((actor) => addSlot(actor, input).then(() => undefined), "Period added.");
  if (r.ok) revalidatePath("/app/timetable");
  return r;
}

export async function removeSlotAction(slotId: string) {
  const r = await runAction((actor) => removeSlot(actor, slotId), "Period removed.");
  if (r.ok) revalidatePath("/app/timetable");
  return r;
}

export async function setEntryAction(input: z.input<typeof entryInput>) {
  const r = await runAction((actor) => setEntry(actor, input), "Saved.");
  if (r.ok) revalidatePath("/app/timetable");
  return r;
}
