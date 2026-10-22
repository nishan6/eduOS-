"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { runAction } from "@/server/action";
import { createTicket, replyToTicket, updateTicket, type replyInput, type ticketInput, type updateInput } from "@/modules/tickets/service";

export async function createTicketAction(input: z.input<typeof ticketInput>) {
  const r = await runAction(async (actor) => (await createTicket(actor, input)).id, "Request sent.");
  if (r.ok) revalidatePath("/app/support");
  return r;
}

export async function replyAction(input: z.input<typeof replyInput>) {
  const r = await runAction((actor) => replyToTicket(actor, input), input.isInternal ? "Note added." : "Reply sent.");
  if (r.ok) { revalidatePath("/app/support", "layout"); revalidatePath("/app/helpdesk", "layout"); }
  return r;
}

export async function updateTicketAction(input: z.input<typeof updateInput>) {
  const r = await runAction((actor) => updateTicket(actor, input), "Ticket updated.");
  if (r.ok) { revalidatePath("/app/support", "layout"); revalidatePath("/app/helpdesk", "layout"); }
  return r;
}
