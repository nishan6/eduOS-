import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { requireActor } from "@/server/actor";
import { orNull } from "@/server/or-null";
import { familyCalendar } from "@/modules/events/service";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { EventList } from "@/components/event-list";

export const metadata = { title: "School calendar" };

export default async function FamilyCalendar() {
  const actor = await requireActor();
  const events = await orNull(familyCalendar(actor));
  if (!events) notFound();
  return (
    <>
      <PageHeader title="School calendar" description="Holidays, exams and events at your children's schools." />
      <Card>{events.length === 0 ? <EmptyState icon={CalendarDays} title="Nothing coming up" /> : <EventList events={events} />}</Card>
    </>
  );
}
