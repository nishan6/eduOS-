import { notFound } from "next/navigation";
import { requireActor } from "@/server/actor";
import { getRoster } from "@/modules/attendance/service";
import { AppError } from "@/lib/errors";
import { formatDate, schoolToday } from "@/lib/dates";
import { PageHeader } from "@/components/ui/misc";
import { AttendanceForm } from "./attendance-form";

export const metadata = { title: "Attendance" };

export default async function AttendancePage({ params, searchParams }: { params: Promise<{ sectionId: string }>; searchParams: Promise<{ date?: string }> }) {
  const { sectionId } = await params;
  const { date: qDate } = await searchParams;
  const today = schoolToday();
  const date = qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate) && qDate <= today ? qDate : today;
  const actor = await requireActor();
  let roster;
  try {
    roster = await getRoster(actor, sectionId, date);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  return (
    <>
      <PageHeader title={`Attendance · ${roster.section.name}`} description={`${formatDate(date)} · ${roster.students.length} students · ${roster.section.academicYear}`}
        breadcrumbs={[{ href: "/app/teacher", label: "My classes" }]} />
      <AttendanceForm roster={roster} today={today} />
    </>
  );
}
