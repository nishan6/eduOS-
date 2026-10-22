import { requireSchoolPage } from "@/server/context";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { EnquiryForm } from "../enquiry-forms";

export const metadata = { title: "New enquiry" };

export default async function NewEnquiryPage() {
  const { school } = await requireSchoolPage("admissions.manage");
  const grades = await prisma.grade.findMany({ where: { schoolId: school.id }, orderBy: { order: "asc" } });
  return (
    <>
      <PageHeader title="New enquiry" description={school.name} breadcrumbs={[{ href: "/app/admissions", label: "Admissions" }]} />
      <EnquiryForm schoolId={school.id} grades={grades.map((g) => ({ id: g.id, label: g.name }))} />
    </>
  );
}
