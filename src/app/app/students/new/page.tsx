import { requireSchoolPage } from "@/server/context";
import { listCurrentSections } from "@/modules/students/service";
import { PageHeader } from "@/components/ui/misc";
import { NewStudentForm } from "./new-student-form";

export const metadata = { title: "New student" };

export default async function NewStudentPage() {
  const { school } = await requireSchoolPage("students.create");
  const sections = await listCurrentSections(school.id);
  return (
    <>
      <PageHeader title="New student" description={`Admit a student into ${school.name} and link a guardian.`} breadcrumbs={[{ href: "/app/students", label: "Students" }]} />
      <NewStudentForm schoolId={school.id} sections={sections.map((s) => ({ id: s.id, label: `${s.grade.name} - ${s.name} (${s.academicYear.name})` }))} />
    </>
  );
}
