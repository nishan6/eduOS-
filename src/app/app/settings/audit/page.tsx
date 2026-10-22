import { requireSchoolPage } from "@/server/context";
import { listAudit } from "@/modules/org/service";
import { formatDateTime } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  const { actor, school } = await requireSchoolPage("audit.read");
  const rows = await listAudit(actor, school.id);
  return (
    <>
      <PageHeader title="Audit log" description="Sensitive actions in this school, newest first (latest 100). Records cannot be edited." />
      <Card>
        <Table>
          <THead><tr><TH>When</TH><TH>Who</TH><TH>Action</TH><TH>Details</TH></tr></THead>
          <tbody>{rows.map((r) => (
            <TR key={r.id}>
              <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</TD>
              <TD className="whitespace-nowrap">{r.actor?.name ?? "System"}</TD>
              <TD className="font-mono text-xs">{r.action}</TD>
              <TD className="text-sm">{r.summary}</TD>
            </TR>
          ))}</tbody>
        </Table>
      </Card>
    </>
  );
}
