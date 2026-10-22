import Link from "next/link";
import { GraduationCap, Plus } from "lucide-react";
import { requireSchoolPage } from "@/server/context";
import { canSchoolWide, sectionFilter } from "@/lib/permissions/evaluate";
import { listCurrentSections, listStudents } from "@/modules/students/service";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; section?: string; page?: string }> }) {
  const { actor, school } = await requireSchoolPage("students.read", "any");
  const sp = await searchParams;
  const filter = sectionFilter(actor, "students.read", school.id);
  const allSections = await listCurrentSections(school.id);
  const sections = filter === "all" ? allSections : allSections.filter((s) => filter.includes(s.id));
  const sectionId = sections.some((s) => s.id === sp.section) ? sp.section : undefined;
  const result = await listStudents(actor, school.id, { q: sp.q, sectionId, page: Number(sp.page) || 1 });
  const canCreate = canSchoolWide(actor, "students.create", school.id);
  const qs = (page: number) => `?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sectionId ? { section: sectionId } : {}), page: String(page) })}`;

  return (
    <>
      <PageHeader title="Students" description={`${result.total} students${filter === "all" ? "" : " in your assigned sections"} · ${school.name}`}
        actions={canCreate ? <Link href="/app/students/new" className={buttonVariants()}><Plus /> New student</Link> : null} />
      <Card>
        <form className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row" method="get" role="search">
          <Input name="q" placeholder="Name or admission number" defaultValue={sp.q} aria-label="Search" className="sm:max-w-xs" />
          <Select name="section" defaultValue={sectionId ?? ""} aria-label="Section" className="sm:max-w-48">
            <option value="">All sections</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.grade.name} - {s.name}</option>)}
          </Select>
          <button className={buttonVariants({ variant: "secondary" })}>Filter</button>
        </form>
        {result.items.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No students found" description={sp.q ? "Try a different name or admission number." : "Students you can access will appear here."} />
        ) : (
          <>
            <Table>
              <THead><tr><TH>Student</TH><TH>Admission no.</TH><TH>Class</TH><TH className="hidden md:table-cell">Primary guardian</TH><TH>Status</TH></tr></THead>
              <tbody>
                {result.items.map((s) => (
                  <TR key={s.id}>
                    <TD><Link href={`/app/students/${s.id}`} className="font-medium hover:underline">{s.name}</Link></TD>
                    <TD className="font-mono text-xs">{s.admissionNo}</TD>
                    <TD>{s.className}{s.rollNo ? <span className="text-muted-foreground"> · #{s.rollNo}</span> : null}</TD>
                    <TD className="hidden md:table-cell text-muted-foreground">{s.primaryGuardian ?? "—"}</TD>
                    <TD><StatusBadge status={s.status} /></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
              <span className="text-muted-foreground">Page {result.page} of {result.pageCount}</span>
              <div className="flex gap-2">
                {result.page > 1 && <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href={qs(result.page - 1)}>Previous</Link>}
                {result.page < result.pageCount && <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href={qs(result.page + 1)}>Next</Link>}
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
