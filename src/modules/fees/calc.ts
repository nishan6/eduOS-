/** Pure fee arithmetic in integer paise. All functions are deterministic and unit tested. */

export type OpenInvoice = { id: string; totalPaise: number; paidPaise: number; dueDate: string; number: string };
export type Allocation = { invoiceId: string; amountPaise: number };

export function outstanding(inv: Pick<OpenInvoice, "totalPaise" | "paidPaise">): number {
  return Math.max(0, inv.totalPaise - inv.paidPaise);
}

/**
 * Allocates a payment to open invoices, oldest due date first (ties broken by invoice number).
 * Throws if the amount is not a positive integer or exceeds the total outstanding:
 * advance payments / credit balances are not supported in this release.
 */
export function allocateOldestFirst(amountPaise: number, invoices: OpenInvoice[]): Allocation[] {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) throw new Error("Payment amount must be a positive whole number of paise.");
  const open = invoices
    .filter((i) => outstanding(i) > 0)
    .sort((a, b) => (a.dueDate === b.dueDate ? a.number.localeCompare(b.number) : a.dueDate.localeCompare(b.dueDate)));
  const totalOutstanding = open.reduce((s, i) => s + outstanding(i), 0);
  if (amountPaise > totalOutstanding) {
    throw new Error(`Payment exceeds the outstanding balance of ${totalOutstanding} paise.`);
  }
  let remaining = amountPaise;
  const result: Allocation[] = [];
  for (const inv of open) {
    if (remaining === 0) break;
    const take = Math.min(remaining, outstanding(inv));
    result.push({ invoiceId: inv.id, amountPaise: take });
    remaining -= take;
  }
  return result;
}

export type InvoiceStatusValue = "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";

export function statusForPaid(totalPaise: number, paidPaise: number): Exclude<InvoiceStatusValue, "VOID"> {
  if (paidPaise < 0 || paidPaise > totalPaise) throw new Error("Paid amount out of range.");
  if (paidPaise === 0) return "ISSUED";
  return paidPaise === totalPaise ? "PAID" : "PARTIALLY_PAID";
}

/** Groups structure components into one invoice per due date (installments). */
export function groupComponentsByDueDate<T extends { dueDate: string; amountPaise: number }>(components: T[]) {
  const groups = new Map<string, T[]>();
  for (const c of components) {
    if (!Number.isSafeInteger(c.amountPaise) || c.amountPaise <= 0) throw new Error("Component amounts must be positive.");
    const list = groups.get(c.dueDate) ?? [];
    list.push(c);
    groups.set(c.dueDate, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dueDate, items]) => ({ dueDate, items, totalPaise: items.reduce((s, i) => s + i.amountPaise, 0) }));
}

export type AgingBucket = "current" | "1-30" | "31-60" | "61-90" | "90+";

export function agingBucket(dueDate: string, today: string): AgingBucket {
  const days = Math.floor((Date.parse(today) - Date.parse(dueDate)) / 86_400_000);
  if (days <= 0) return "current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

/** Double-entry check for journal lines. */
export function validateJournalLines(lines: { debitPaise: number; creditPaise: number }[]): string | null {
  if (lines.length < 2) return "A journal entry needs at least two lines.";
  let dr = 0;
  let cr = 0;
  for (const l of lines) {
    if (!Number.isSafeInteger(l.debitPaise) || !Number.isSafeInteger(l.creditPaise)) return "Amounts must be whole paise.";
    if (l.debitPaise < 0 || l.creditPaise < 0) return "Amounts cannot be negative.";
    if ((l.debitPaise > 0) === (l.creditPaise > 0)) return "Each line must have either a debit or a credit.";
    dr += l.debitPaise;
    cr += l.creditPaise;
  }
  if (dr !== cr) return `Debits (${dr}) and credits (${cr}) must be equal.`;
  return null;
}
