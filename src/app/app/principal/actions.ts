"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/action";
import { decideCorrection } from "@/modules/attendance/service";

export async function decideCorrectionAction(requestId: string, approve: boolean) {
  const r = await runAction((actor) => decideCorrection(actor, { requestId, approve }), approve ? "Correction approved." : "Correction rejected.");
  if (r.ok) revalidatePath("/app", "layout");
  return r;
}
