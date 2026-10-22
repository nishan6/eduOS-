import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/server/actor";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/permissions/evaluate";
import { studentFeeAccount } from "@/modules/fees/service";
import { formatPaise } from "@/lib/money";
import { formatDate, schoolToday } from "@/lib/dates";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Stat } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { AssignStructureForm, PaymentRowActions, RecordPaymentForm } from "./fee-forms";

export const metadata = { title: "Student fees" };

export default async function StudentFeesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  let account;
  try { account = await studentFeeAccount(actor, id); } catch (e) { if (e instanceof AppError) notFound(); throw e; }
  if (account.via !== "staff") notFound();
  const student = await prisma.student.findUniqueOrThrow({
    where: { id },
    include: { school: true, enrollments: { where: { academicYear: { isCurrent: true } }, include: { section: { include: { grade: true } } } } },
  });
  const scope = { schoolId: student.schoolId };
  const canCollect = can(actor, "fees.collect", scope);
  const canAssign = can(actor, "fees.assign", scope);
  const canReverse = can(actor, "fees.reverse", scope);
  const canReconcile = can(actor, "finance.reconcile", scope);
  const assignedIds = new Set(account.assignments.map((a) => a.structureId));
  const structures = canAssign
    ? (await prisma.feeStructure.findMany({ where: { schoolId: student.schoolId, academicYear: { isCurrent: true } }, include: { components: true, grade: true }, orderBy: { name: "asc" } }))
        .filter((s) => !assignedIds.has(s.id))
        .map((s) => ({ id: s.id, label: `${s.name} · ${formatPaise(s.components.reduce((t, c) => t + c.amountPaise, 0))}`, matchesGrade: s.gradeId === student.enrollments[0]?.section.gradeId }))
    : [];
  const enrollment = student.enrollments[0];

  return (
    <>
      <PageHeader title={`Fees · ${student.firstName} ${student.lastName}`}
        description={`Adm. ${student.admissionNo} · ${enrollment ? `${enrollment.section.grade.name} - ${enrollment.section.name}` : "Not enrolled"} · ${student.school.name}`}
        breadcrumbs={[{ href: "/app/fees", label: "Fees" }, { href: `/app/students/${id}`, label: "Student profile" }]} />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Invoiced" value={formatPaise(account.totals.invoicedPaise)} />
        <Stat label="Received" value={formatPaise(account.totals.paidPaise)} tone="success" />
        <Stat label="Outstanding" value={formatPaise(account.totals.outstandingPaise)} />
        <Stat label="Overdue" value={formatPaise(account.totals.overduePaise)} tone={account.totals.overduePaise ? "danger" : undefined} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><div><CardTitle>Invoices</CardTitle><CardDescription>Payments are applied to the oldest due invoice first.</CardDescription></div></CardHeader>
            <CardContent className="px-0">
              {account.invoices.length === 0 ? <p className="px-5 text-sm text-muted-foreground">No invoices yet. Assign a fee structure to issue invoices.</p> : (
                <Table>
                  <THead><tr><TH>Invoice</TH><TH>Items</TH><TH>Due</TH><TH className="text-right">Total</TH><TH className="text-right">Balance</TH><TH>Status</TH></tr></THead>
                  <tbody>{account.invoices.map((i) => (
                    <TR key={i.id}>
                      <TD className="font-mono text-xs">{i.number}</TD>
                      <TD className="text-xs text-muted-foreground">{i.lines.map((l) => l.description).join(", ")}</TD>
                      <TD>{formatDate(i.dueDateIso)}</TD>
                      <TD className="text-right tabular-nums">{formatPaise(i.totalPaise)}</TD>
                      <TD className="text-right tabular-nums">{formatPaise(i.outstandingPaise)}</TD>
                      <TD>{i.isOverdue ? <Badge tone="danger">Overdue</Badge> : <StatusBadge status={i.status} />}</TD>
                    </TR>
                  ))}</tbody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>Payments</CardTitle><CardDescription>Recorded payments are not edited or deleted; corrections are made by reversal.</CardDescription></div></CardHeader>
            <CardContent className="px-0">
              {account.payments.length === 0 ? <p className="px-5 text-sm text-muted-foreground">No payments recorded.</p> : (
                <Table>
                  <THead><tr><TH>Receipt</TH><TH>Date</TH><TH>Mode</TH><TH className="text-right">Amount</TH><TH>Status</TH><TH /></tr></THead>
                  <tbody>{account.payments.map((p) => (
                    <TR key={p.id}>
                      <TD>{p.receipt ? <Link href={`/app/fees/receipts/${p.receipt.id}`} className="font-mono text-xs text-primary hover:underline">{p.receipt.number}</Link> : "—"}</TD>
                      <TD>{formatDate(p.receivedAt)}</TD>
                      <TD>{p.mode.replace("_", " ").toLowerCase()}{p.reference ? <span className="block text-xs text-muted-foreground">{p.reference}</span> : null}</TD>
                      <TD className="text-right tabular-nums">{formatPaise(p.amountPaise)}</TD>
                      <TD className="space-x-1"><StatusBadge status={p.status} />{p.mode !== "CASH" && p.status === "RECORDED" && <StatusBadge status={p.verification} />}</TD>
                      <TD className="text-right">{p.status === "RECORDED" && (canReverse || canReconcile) && <PaymentRowActions paymentId={p.id} canReverse={canReverse} canVerify={canReconcile && p.mode !== "CASH" && p.verification === "UNVERIFIED"} />}</TD>
                    </TR>
                  ))}</tbody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          {canCollect && (
            <Card>
              <CardHeader><div><CardTitle>Record payment</CardTitle><CardDescription>Record money already received at the counter or by UPI/bank. Recording does not verify a UPI transfer.</CardDescription></div></CardHeader>
              <CardContent>
                {account.totals.outstandingPaise > 0
                  ? <RecordPaymentForm studentId={id} outstandingPaise={account.totals.outstandingPaise} today={schoolToday()} />
                  : <p className="text-sm text-muted-foreground">Nothing outstanding.</p>}
              </CardContent>
            </Card>
          )}
          {canAssign && (
            <Card>
              <CardHeader><div><CardTitle>Assign fee structure</CardTitle><CardDescription>Issues one invoice per installment due date.</CardDescription></div></CardHeader>
              <CardContent>
                {account.assignments.length > 0 && <p className="mb-3 text-sm text-muted-foreground">Assigned: {account.assignments.map((a) => a.structure.name).join(", ")}</p>}
                {structures.length ? <AssignStructureForm studentId={id} structures={structures} /> : <p className="text-sm text-muted-foreground">No other structures available for this year.</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
