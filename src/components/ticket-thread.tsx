import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Msg = { id: string; body: string; isInternal: boolean; createdAt: Date; author: { id: string; name: string } };

export function TicketThread({ messages, raisedById }: { messages: Msg[]; raisedById: string }) {
  return (
    <ol className="space-y-3">
      {messages.map((m) => (
        <li key={m.id} className={cn("rounded-lg border p-3", m.isInternal ? "border-warning/40 bg-warning-soft/40" : m.author.id === raisedById ? "border-border bg-surface" : "border-primary/30 bg-primary-soft/40")}>
          <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{m.author.name}</span> {formatDateTime(m.createdAt)}
            {m.isInternal && <Badge tone="warning">Internal note</Badge>}
          </p>
          <p className="whitespace-pre-line text-sm">{m.body}</p>
        </li>
      ))}
    </ol>
  );
}

export const TICKET_TONE = { OPEN: "primary", IN_PROGRESS: "warning", RESOLVED: "success", CLOSED: "neutral" } as const;
