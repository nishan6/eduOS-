import { CalendarDays } from "lucide-react";
import { requireSchoolPage } from "@/server/context";
import { canSchoolWide } from "@/lib/permissions/evaluate";
import { schoolCalendar } from "@/modules/events/service";
import { schoolToday } from "@/lib/dates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { EventList } from "@/components/event-list";
import { DeleteEventButton, EventForm } from "./event-form";

export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const { actor, school } = await requireSchoolPage("academics.read");
  const events = await schoolCalendar(actor, school.id);
  const canManage = canSchoolWide(actor, "events.manage", school.id);
  return (
    <>
      <PageHeader title="Calendar" description={`${school.name} · holidays, exams and events`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="h-fit">
          {events.length === 0 ? <EmptyState icon={CalendarDays} title="Nothing scheduled" description={canManage ? "Add holidays and events with the form." : undefined} />
            : <EventList events={events} action={canManage ? (id) => <DeleteEventButton id={id} /> : undefined} />}
        </Card>
        {canManage && (
          <Card className="h-fit">
            <CardHeader><div><CardTitle>Add to calendar</CardTitle><CardDescription>Events for everyone also appear in the parent app.</CardDescription></div></CardHeader>
            <CardContent><EventForm schoolId={school.id} today={schoolToday()} /></CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
