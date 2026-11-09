import "server-only";
import type { Tx } from "@/lib/db";

/** Atomically reserves the next number for a school's document series (gap-free within a committed tx). */
export async function nextDocumentNumber(tx: Tx, schoolId: string, key: "invoice" | "receipt" | "journal" | "enquiry" | "ticket"): Promise<number> {
  const row = await tx.documentSequence.upsert({
    where: { schoolId_key: { schoolId, key } },
    create: { schoolId, key, next: 2 },
    update: { next: { increment: 1 } },
  });
  return row.next - 1;
}

export function formatDocNumber(prefix: string, schoolCode: string, n: number) {
  return `${prefix}-${schoolCode}-${String(n).padStart(6, "0")}`;
}
