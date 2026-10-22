"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/action";
import { requestCorrection, saveAttendance, type saveAttendanceInput, type correctionInput } from "@/modules/attendance/service";
import type { z } from "zod";

export async function saveAttendanceAction(input: z.input<typeof saveAttendanceInput>) {
  const r = await runAction((actor) => saveAttendance(actor, input).then(() => undefined), input.submit ? "Attendance submitted." : "Draft saved.");
  if (r.ok) revalidatePath("/app", "layout");
  return r;
}

export async function requestCorrectionAction(input: z.input<typeof correctionInput>) {
  const r = await runAction((actor) => requestCorrection(actor, input).then(() => undefined), "Correction sent for approval.");
  if (r.ok) revalidatePath("/app", "layout");
  return r;
}
