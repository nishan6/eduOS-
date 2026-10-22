import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { schoolToday } from "@/lib/dates";
import { recordPayment, reversePayment, studentFeeAccount, assignFeeStructure, createFeeStructure } from "@/modules/fees/service";
import { createManualEntry, listLedger } from "@/modules/finance/ledger";
import { actor, parentChild, school, T } from "../support/actors";

async function ledgerBalanced(schoolId: string) {
  const agg = await prisma.journalLine.aggregate({ where: { entry: { schoolId } }, _sum: { debitPaise: true, creditPaise: true } });
  return agg._sum.debitPaise === agg._sum.creditPaise;
}

describe("fee collection workflow", () => {
  it("cashier records a payment, receipt is issued, balances and ledger update; parent sees it", async () => {
    const cashier = await actor(T.cashierSps);
    const child = await parentChild(T.parent, "SPS");
    const before = await studentFeeAccount(cashier, child.id);
    expect(before.totals.outstandingPaise).toBeGreaterThan(0);
    const amount = Math.min(before.totals.outstandingPaise, 250_000);
    const key = randomUUID();

    const res = await recordPayment(cashier, { studentId: child.id, amountPaise: amount, mode: "UPI", reference: "UTR123456789", receivedOn: schoolToday(), idempotencyKey: key });
    expect(res.receipt.number).toMatch(/^RCT-SPS-\d{6}$/);
    expect(res.payment.verification).toBe("UNVERIFIED");

    // Replaying the same form does not record twice.
    const replay = await recordPayment(cashier, { studentId: child.id, amountPaise: amount, mode: "UPI", reference: "UTR123456789", receivedOn: schoolToday(), idempotencyKey: key });
    expect(replay.duplicate).toBe(true);
    expect(replay.payment.id).toBe(res.payment.id);

    const after = await studentFeeAccount(cashier, child.id);
    expect(after.totals.outstandingPaise).toBe(before.totals.outstandingPaise - amount);
    const parentView = await studentFeeAccount(await actor(T.parent), child.id);
    expect(parentView.totals.outstandingPaise).toBe(after.totals.outstandingPaise);
    expect(parentView.payments.some((p) => p.id === res.payment.id)).toBe(true);

    const sps = await school("SPS");
    expect(await ledgerBalanced(sps.id)).toBe(true);
    const entry = await prisma.journalEntry.findFirstOrThrow({ where: { source: "PAYMENT", sourceId: res.payment.id }, include: { lines: { include: { account: true } } } });
    expect(entry.lines.map((l) => [l.account.code, l.debitPaise, l.creditPaise]).sort()).toEqual([["1010", amount, 0], ["1100", 0, amount]]);

    // Validation: overpayment, missing UPI reference, future date.
    await expect(recordPayment(cashier, { studentId: child.id, amountPaise: after.totals.outstandingPaise + 1, mode: "CASH", receivedOn: schoolToday(), idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(recordPayment(cashier, { studentId: child.id, amountPaise: 100, mode: "UPI", receivedOn: schoolToday(), idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(recordPayment(cashier, { studentId: child.id, amountPaise: 100, mode: "CASH", receivedOn: "2099-01-01", idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: "VALIDATION" });

    // Cashiers cannot reverse; accounts admin can, which restores the balance.
    await expect(reversePayment(cashier, { paymentId: res.payment.id, reason: "Wrong student" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const accounts = await actor(T.accountsSps);
    await reversePayment(accounts, { paymentId: res.payment.id, reason: "Bounced UPI mandate" });
    await expect(reversePayment(accounts, { paymentId: res.payment.id, reason: "Bounced UPI mandate" })).rejects.toMatchObject({ code: "CONFLICT" });
    const reversed = await studentFeeAccount(cashier, child.id);
    expect(reversed.totals.outstandingPaise).toBe(before.totals.outstandingPaise);
    expect(await ledgerBalanced(sps.id)).toBe(true);
  });

  it("unauthorized users cannot collect fees or write the ledger", async () => {
    const child = await parentChild(T.parent, "SPS");
    const sps = await school("SPS");
    const cash = (await prisma.ledgerAccount.findFirstOrThrow({ where: { schoolId: sps.id, code: "1000" } })).id;
    const exp = (await prisma.ledgerAccount.findFirstOrThrow({ where: { schoolId: sps.id, code: "5000" } })).id;
    const entry = { schoolId: sps.id, date: schoolToday(), narration: "Stationery", lines: [{ accountId: exp, debitPaise: 5000, creditPaise: 0 }, { accountId: cash, debitPaise: 0, creditPaise: 5000 }] };
    for (const email of [T.teacherSps, T.principalSps, T.cashierSps, T.groupAdmin, T.parent]) {
      await expect(createManualEntry(await actor(email), entry), email).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    for (const email of [T.teacherSps, T.principalSps, T.parent, T.cashierSvl]) {
      await expect(recordPayment(await actor(email), { studentId: child.id, amountPaise: 100, mode: "CASH", receivedOn: schoolToday(), idempotencyKey: randomUUID() }), email)
        .rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    // Teachers cannot even read the ledger.
    await expect(listLedger(await actor(T.teacherSps), sps.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Authorized finance staff and owners can; unbalanced entries are rejected.
    const accounts = await actor(T.accountsSps);
    await expect(createManualEntry(accounts, { ...entry, lines: [entry.lines[0]!, { ...entry.lines[1]!, creditPaise: 4000 }] })).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await createManualEntry(accounts, entry)).number).toMatch(/^JV-SPS-/);
    expect((await createManualEntry(await actor(T.owner), entry)).number).toMatch(/^JV-SPS-/);
  });

  it("concurrent collections cannot over-allocate the same invoices", async () => {
    const cashier = await actor(T.cashierSps);
    const child = await parentChild(T.parent2, "SPS");
    const { totals } = await studentFeeAccount(cashier, child.id);
    const amount = Math.ceil(totals.outstandingPaise * 0.6);
    const results = await Promise.allSettled([0, 1].map(() =>
      recordPayment(cashier, { studentId: child.id, amountPaise: amount, mode: "CASH", receivedOn: schoolToday(), idempotencyKey: randomUUID() })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const after = await studentFeeAccount(cashier, child.id);
    expect(after.totals.outstandingPaise).toBe(totals.outstandingPaise - amount);
    expect(after.invoices.every((i) => i.paidPaise <= i.totalPaise)).toBe(true);
  });

  it("configures a structure, assigns it, and refuses duplicate assignment", async () => {
    const accounts = await actor(T.accountsSps);
    const sps = await school("SPS");
    const year = await prisma.academicYear.findFirstOrThrow({ where: { schoolId: sps.id, isCurrent: true } });
    const cat = await prisma.feeCategory.findFirstOrThrow({ where: { schoolId: sps.id, code: "TUITION" } });
    const s = await createFeeStructure(accounts, {
      schoolId: sps.id, academicYearId: year.id, name: "Activity Fees 2026-27",
      components: [{ categoryId: cat.id, label: "Sports kit", amountPaise: 120_000, dueDate: "2026-11-30" }, { categoryId: cat.id, label: "Annual day", amountPaise: 80_000, dueDate: "2026-11-30" }],
    });
    await expect(createFeeStructure(accounts, { schoolId: sps.id, academicYearId: year.id, name: "Bad", components: [{ categoryId: cat.id, label: "Out of year", amountPaise: 100, dueDate: "2030-01-01" }] }))
      .rejects.toMatchObject({ code: "VALIDATION" });
    const child = await parentChild(T.parent2, "SPS");
    const invoices = await assignFeeStructure(accounts, { studentId: child.id, structureId: s.id });
    expect(invoices).toHaveLength(1);
    expect(invoices[0]!.totalPaise).toBe(200_000);
    await expect(assignFeeStructure(accounts, { studentId: child.id, structureId: s.id })).rejects.toMatchObject({ code: "CONFLICT" });
    // A structure from School A cannot be assigned to a School B student.
    const svlChild = await parentChild(T.parent, "SVL");
    await expect(assignFeeStructure(await actor(T.owner), { studentId: svlChild.id, structureId: s.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
