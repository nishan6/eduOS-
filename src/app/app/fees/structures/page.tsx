import { requireSchoolPage } from "@/server/context";
import { prisma } from "@/lib/db";
import { canSchoolWide } from "@/lib/permissions/evaluate";
import { listFeeConfig } from "@/modules/fees/service";
import { formatPaise } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { CategoryForm, StructureForm } from "./structure-forms";

export const metadata = { title: "Fee structures" };

export default async function StructuresPage() {
  const { actor, school } = await requireSchoolPage("fees.read");
  const { categories, structures } = await listFeeConfig(actor, school.id);
  const canConfigure = canSchoolWide(actor, "fees.configure", school.id);
  const [year, grades] = canConfigure
    ? await Promise.all([
        prisma.academicYear.findFirst({ where: { schoolId: school.id, isCurrent: true } }),
        prisma.grade.findMany({ where: { schoolId: school.id }, orderBy: { order: "asc" } }),
      ])
    : [null, []];
  return (
    <>
      <PageHeader title="Fee structures" description="Per-class fee schedules for the current academic year. Each due date becomes one installment invoice." breadcrumbs={[{ href: "/app/fees", label: "Fees" }]} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {structures.length === 0 && <Card><CardContent className="text-sm text-muted-foreground">No fee structures for the current year yet.</CardContent></Card>}
          {structures.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div><CardTitle>{s.name}</CardTitle><CardDescription>{s.grade?.name ?? "All classes"} · {s.academicYear.name} · assigned to {s._count.assignments} students</CardDescription></div>
                <p className="text-sm font-semibold tabular-nums">{formatPaise(s.totalPaise)}</p>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <THead><tr><TH>Component</TH><TH>Category</TH><TH>Due</TH><TH className="text-right">Amount</TH></tr></THead>
                  <tbody>{s.components.map((c) => (
                    <TR key={c.id}><TD>{c.label}</TD><TD className="text-muted-foreground">{c.category.name}</TD><TD>{formatDate(c.dueDate)}</TD><TD className="text-right tabular-nums">{formatPaise(c.amountPaise)}</TD></TR>
                  ))}</tbody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Categories</CardTitle></CardHeader>
            <CardContent>
              <ul className="mb-3 space-y-1 text-sm">{categories.map((c) => <li key={c.id}><span className="font-mono text-xs text-muted-foreground">{c.code}</span> {c.name}</li>)}</ul>
              {canConfigure && <CategoryForm schoolId={school.id} />}
            </CardContent>
          </Card>
          {canConfigure && year && (
            <Card>
              <CardHeader><div><CardTitle>New fee structure</CardTitle><CardDescription>{year.name}</CardDescription></div></CardHeader>
              <CardContent>
                <StructureForm schoolId={school.id} academicYearId={year.id} grades={grades.map((g) => ({ id: g.id, name: g.name }))} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
