"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/action";
import { createManualEntry, reverseManualEntry } from "@/modules/finance/ledger";

export async function createEntryAction(input: Parameters<typeof createManualEntry>[1]) {
  const r = await runAction(async (actor) => (await createManualEntry(actor, input)).number, "Journal entry posted.");
  if (r.ok) revalidatePath("/app/finance");
  return r;
}

export async function reverseEntryAction(entryId: string, reason: string) {
  const r = await runAction(async (actor) => (await reverseManualEntry(actor, entryId, reason)).number, "Entry reversed.");
  if (r.ok) revalidatePath("/app/finance");
  return r;
}
