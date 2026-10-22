"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { runAction } from "@/server/action";
import { createExam, publishExam, reopenPaper, saveMarks, type createExamInput, type saveMarksInput } from "@/modules/exams/service";

export async function createExamAction(input: z.input<typeof createExamInput>) {
  const r = await runAction(async (actor) => (await createExam(actor, input)).id, "Exam created. Teachers can now enter marks.");
  if (r.ok) revalidatePath("/app/exams");
  return r;
}

export async function saveMarksAction(input: z.input<typeof saveMarksInput>) {
  const r = await runAction((actor) => saveMarks(actor, input), input.submit ? "Marks submitted." : "Marks saved.");
  if (r.ok) revalidatePath("/app/exams", "layout");
  return r;
}

export async function reopenPaperAction(paperId: string, reason: string) {
  const r = await runAction((actor) => reopenPaper(actor, paperId, reason), "Paper reopened for corrections.");
  if (r.ok) revalidatePath("/app/exams", "layout");
  return r;
}

export async function publishExamAction(examId: string) {
  const r = await runAction((actor) => publishExam(actor, examId), "Results published to parents.");
  if (r.ok) revalidatePath("/app/exams", "layout");
  return r;
}
