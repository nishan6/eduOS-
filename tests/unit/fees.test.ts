import { describe, expect, it } from "vitest";
import { agingBucket, allocateOldestFirst, groupComponentsByDueDate, statusForPaid, validateJournalLines } from "@/modules/fees/calc";
import { formatPaise, rupeesToPaise } from "@/lib/money";

const inv = (id: string, total: number, paid: number, dueDate: string) => ({ id, totalPaise: total, paidPaise: paid, dueDate, number: `INV-${id}` });

describe("payment allocation", () => {
  it("fills the oldest due invoice first and splits across invoices", () => {
    const r = allocateOldestFirst(15_000, [inv("b", 10_000, 0, "2026-10-15"), inv("a", 10_000, 0, "2026-06-15")]);
    expect(r).toEqual([{ invoiceId: "a", amountPaise: 10_000 }, { invoiceId: "b", amountPaise: 5_000 }]);
  });
  it("respects partial payments already made", () => {
    expect(allocateOldestFirst(3_000, [inv("a", 10_000, 8_000, "2026-06-15"), inv("b", 5_000, 0, "2026-10-15")])).toEqual([
      { invoiceId: "a", amountPaise: 2_000 }, { invoiceId: "b", amountPaise: 1_000 },
    ]);
  });
  it("rejects overpayment, zero, negative and fractional paise", () => {
    expect(() => allocateOldestFirst(10_001, [inv("a", 10_000, 0, "2026-06-15")])).toThrow(/exceeds/);
    expect(() => allocateOldestFirst(0, [inv("a", 10_000, 0, "2026-06-15")])).toThrow();
    expect(() => allocateOldestFirst(-5, [inv("a", 10_000, 0, "2026-06-15")])).toThrow();
    expect(() => allocateOldestFirst(10.5, [inv("a", 10_000, 0, "2026-06-15")])).toThrow();
  });
  it("allocations always sum to the payment", () => {
    const invoices = [inv("a", 33_333, 0, "2026-06-15"), inv("b", 33_333, 1, "2026-06-15"), inv("c", 33_334, 0, "2027-01-15")];
    for (const amt of [1, 33_333, 50_000, 99_999]) {
      expect(allocateOldestFirst(amt, invoices).reduce((s, a) => s + a.amountPaise, 0)).toBe(amt);
    }
  });
});

describe("invoice status and grouping", () => {
  it("derives status from paid amount", () => {
    expect(statusForPaid(100, 0)).toBe("ISSUED");
    expect(statusForPaid(100, 40)).toBe("PARTIALLY_PAID");
    expect(statusForPaid(100, 100)).toBe("PAID");
    expect(() => statusForPaid(100, 101)).toThrow();
  });
  it("groups components into one invoice per due date, sorted", () => {
    const g = groupComponentsByDueDate([
      { dueDate: "2026-10-15", amountPaise: 300 }, { dueDate: "2026-06-15", amountPaise: 100 }, { dueDate: "2026-06-15", amountPaise: 50 },
    ]);
    expect(g.map((x) => [x.dueDate, x.totalPaise])).toEqual([["2026-06-15", 150], ["2026-10-15", 300]]);
  });
  it("buckets aging by days past due", () => {
    expect(agingBucket("2026-10-30", "2026-10-23")).toBe("current");
    expect(agingBucket("2026-10-15", "2026-10-23")).toBe("1-30");
    expect(agingBucket("2026-06-15", "2026-10-23")).toBe("90+");
  });
});

describe("journal validation", () => {
  it("requires balanced, one-sided, non-negative lines", () => {
    expect(validateJournalLines([{ debitPaise: 100, creditPaise: 0 }, { debitPaise: 0, creditPaise: 100 }])).toBeNull();
    expect(validateJournalLines([{ debitPaise: 100, creditPaise: 0 }, { debitPaise: 0, creditPaise: 90 }])).toMatch(/equal/);
    expect(validateJournalLines([{ debitPaise: 100, creditPaise: 100 }, { debitPaise: 0, creditPaise: 0 }])).toMatch(/either/);
    expect(validateJournalLines([{ debitPaise: 100, creditPaise: 0 }])).toMatch(/two lines/);
  });
});

describe("money", () => {
  it("parses rupees to integer paise without floating point drift", () => {
    expect(rupeesToPaise("1,250.50")).toBe(125_050);
    expect(rupeesToPaise("0.1")).toBe(10);
    expect(rupeesToPaise("19.99")).toBe(1_999);
    expect(rupeesToPaise("1.234")).toBeNull();
    expect(rupeesToPaise("-5")).toBeNull();
    expect(rupeesToPaise("abc")).toBeNull();
  });
  it("formats with Indian grouping", () => {
    expect(formatPaise(12_345_678_00)).toBe("₹1,23,45,678.00");
  });
});
