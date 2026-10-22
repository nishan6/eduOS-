import { requireSchoolPage } from "@/server/context";
import { canSchoolWide } from "@/lib/permissions/evaluate";
import { listLedger } from "@/modules/finance/ledger";
import { formatPaise } from "@/lib/money";
import { formatDate, schoolToday } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { ManualEntryForm, ReverseEntryButton } from "./ledger-forms";

export const metadata = { title: "Ledger" };

export default async function FinancePage() {
  const { actor, school } = await requireSchoolPage("finance.ledger.read");
  const { accounts, entries } = await listLedger(actor, school.id);
  const canCreate = canSchoolWide(actor, "finance.ledger.create", school.id);
  const canReverse = canSchoolWide(actor, "finance.ledger.update", school.id);
  return (
    <>
      <PageHeader title="Ledger" description={`Double-entry journal for ${school.name}. Invoices and receipts post automatically; Tally remains the accounting system of record.`} />
      {!canCreate && <Alert tone="info" className="mb-4">You have read-only access to the ledger. Only authorized finance staff and designated owners can post entries.</Alert>}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><div><CardTitle>Account balances</CardTitle><CardDescription>Natural-sign balances from all posted entries.</CardDescription></div></CardHeader>
            <CardContent className="px-0">
              <Table>
                <THead><tr><TH>Code</TH><TH>Account</TH><TH>Type</TH><TH className="text-right">Debits</TH><TH className="text-right">Credits</TH><TH className="text-right">Balance</TH></tr></THead>
                <tbody>{accounts.map((a) => (
                  <TR key={a.id}><TD className="font-mono text-xs">{a.code}</TD><TD>{a.name}{a.tallyLedgerName && <span className="block text-xs text-muted-foreground">Tally: {a.tallyLedgerName}</span>}</TD><TD className="text-xs text-muted-foreground">{a.type.toLowerCase()}</TD>
                    <TD className="text-right tabular-nums">{formatPaise(a.debitPaise)}</TD><TD className="text-right tabular-nums">{formatPaise(a.creditPaise)}</TD><TD className="text-right font-medium tabular-nums">{formatPaise(a.balancePaise)}</TD></TR>
                ))}</tbody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>Recent journal entries</CardTitle><CardDescription>Latest 50. Entries are never edited; reversals create a mirror entry.</CardDescription></div></CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y divide-border">
                {entries.map((e) => (
                  <li key={e.id} className="px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs">{e.number}</span><span className="text-muted-foreground">{formatDate(e.date)}</span>
                      <Badge>{e.source.replace("_", " ").toLowerCase()}</Badge>
                      {e.reversal && <Badge tone="danger">Reversed by {e.reversal.number}</Badge>}
                      {canReverse && e.source === "MANUAL" && !e.reversal && !e.reversesId && <span className="ml-auto"><ReverseEntryButton entryId={e.id} /></span>}
                    </div>
                    <p className="mt-0.5">{e.narration}</p>
                    <ul className="mt-1 text-xs text-muted-foreground">
                      {e.lines.map((l) => <li key={l.id} className="flex justify-between gap-4"><span className={l.creditPaise ? "pl-6" : ""}>{l.account.name}</span><span className="tabular-nums">{l.debitPaise ? `Dr ${formatPaise(l.debitPaise)}` : `Cr ${formatPaise(l.creditPaise)}`}</span></li>)}
                    </ul>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
        {canCreate && (
          <Card className="h-fit">
            <CardHeader><div><CardTitle>Manual journal entry</CardTitle><CardDescription>Debits must equal credits.</CardDescription></div></CardHeader>
            <CardContent><ManualEntryForm schoolId={school.id} today={schoolToday()} accounts={accounts.map((a) => ({ id: a.id, label: `${a.code} ${a.name}` }))} /></CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
