"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { runAction } from "@/server/action";
import { cancelHomework, createHomework, type homeworkInput } from "@/modules/homework/service";

export async function createHomeworkAction(input: z.input<typeof homeworkInput>) {
  const r = await runAction((actor) => createHomework(actor, input).then(() => undefined), "Homework set. Parents with the app have been notified.");
  if (r.ok) revalidatePath("/app/homework");
  return r;
}

export async function cancelHomeworkAction(id: string) {
  const r = await runAction((actor) => cancelHomework(actor, id), "Homework cancelled.");
  if (r.ok) revalidatePath("/app/homework");
  return r;
}
