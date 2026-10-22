import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";

type Ev = { id: string; title: string; description: string | null; kind: "HOLIDAY" | "EXAM" | "EVENT" | "MEETING"; audience: "EVERYONE" | "STAFF"; startsOn: string; endsOn: string; school?: string };
const TONE = { HOLIDAY: "success", EXAM: "warning", EVENT: "primary", MEETING: "neutral" } as const;
const LABEL = { HOLIDAY: "Holiday", EXAM: "Exam", EVENT: "Event", MEETING: "Meeting" } as const;

function monthOf(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

/** Events grouped by month. `action` renders per-event controls (e.g. delete for managers). */
export function EventList({ events, action }: { events: Ev[]; action?: (id: string) => React.ReactNode }) {
  const groups = new Map<string, Ev[]>();
  for (const e of events) groups.set(monthOf(e.startsOn), [...(groups.get(monthOf(e.startsOn)) ?? []), e]);
  return (
    <div className="divide-y divide-border">
      {[...groups.entries()].map(([month, list]) => (
        <section key={month} className="px-5 py-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{month}</h2>
          <ul className="space-y-3">
            {list.map((e) => (
              <li key={e.id} className="flex items-start gap-3">
                <div className="w-24 shrink-0 text-sm tabular-nums">
                  {formatDate(e.startsOn)}{e.endsOn !== e.startsOn && <span className="block text-xs text-muted-foreground">to {formatDate(e.endsOn)}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{e.title} <Badge tone={TONE[e.kind]} className="ml-1">{LABEL[e.kind]}</Badge>{e.audience === "STAFF" && <Badge className="ml-1">Staff only</Badge>}</p>
                  {e.description && <p className="text-sm text-muted-foreground">{e.description}</p>}
                  {e.school && <p className="text-xs text-muted-foreground">{e.school}</p>}
                </div>
                {action?.(e.id)}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
