"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/action";
import { assignFeeStructure, createFeeCategory, createFeeStructure, recordPayment, reversePayment, setPaymentVerification } from "@/modules/fees/service";

type In<F extends (...a: never[]) => unknown> = Parameters<F>[1];

export async function recordPaymentAction(input: In<typeof recordPayment>) {
  const r = await runAction(async (actor) => {
    const res = await recordPayment(actor, input);
    return { receiptId: res.receipt.id, receiptNumber: res.receipt.number, duplicate: res.duplicate };
  }, "Payment recorded.");
  if (r.ok) revalidatePath("/app", "layout");
  return r;
}

export async function reversePaymentAction(input: In<typeof reversePayment>) {
  const r = await runAction((actor) => reversePayment(actor, input), "Payment reversed.");
  if (r.ok) revalidatePath("/app", "layout");
  return r;
}

export async function assignStructureAction(input: In<typeof assignFeeStructure>) {
  const r = await runAction(async (actor) => (await assignFeeStructure(actor, input)).length, "Fee structure assigned and invoices issued.");
  if (r.ok) revalidatePath("/app", "layout");
  return r;
}

export async function createCategoryAction(input: In<typeof createFeeCategory>) {
  const r = await runAction((actor) => createFeeCategory(actor, input).then(() => undefined), "Category created.");
  if (r.ok) revalidatePath("/app/fees/structures");
  return r;
}

export async function createStructureAction(input: In<typeof createFeeStructure>) {
  const r = await runAction((actor) => createFeeStructure(actor, input).then(() => undefined), "Fee structure created.");
  if (r.ok) revalidatePath("/app/fees/structures");
  return r;
}

export async function verifyPaymentAction(paymentId: string, verification: "VERIFIED" | "DISCREPANCY") {
  const r = await runAction((actor) => setPaymentVerification(actor, paymentId, verification));
  if (r.ok) revalidatePath("/app", "layout");
  return r;
}
