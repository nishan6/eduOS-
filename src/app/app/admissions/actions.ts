"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { runAction } from "@/server/action";
import { addEnquiryNote, convertEnquiry, createEnquiry, moveStage, type convertInput, type enquiryInput, type moveStageInput } from "@/modules/admissions/service";

export async function createEnquiryAction(input: z.input<typeof enquiryInput>) {
  return runAction(async (actor) => (await createEnquiry(actor, input)).id, "Enquiry logged.");
}

export async function moveStageAction(input: z.input<typeof moveStageInput>) {
  const r = await runAction((actor) => moveStage(actor, input), "Stage updated.");
  if (r.ok) revalidatePath("/app/admissions", "layout");
  return r;
}

export async function addNoteAction(enquiryId: string, text: string, followUpOn?: string) {
  const r = await runAction((actor) => addEnquiryNote(actor, enquiryId, text, followUpOn), "Note added.");
  if (r.ok) revalidatePath(`/app/admissions/${enquiryId}`);
  return r;
}

export async function convertEnquiryAction(input: z.input<typeof convertInput>) {
  const r = await runAction(async (actor) => (await convertEnquiry(actor, input)).id, "Student admitted.");
  if (r.ok) revalidatePath("/app/admissions", "layout");
  return r;
}
