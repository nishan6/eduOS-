import { cn } from "@/lib/utils";

type Slot = { id: string; label: string; startTime: string; endTime: string; isBreak: boolean };
export type Cell = { subject: string; subjectId?: string; teacher: string | null; teacherId?: string | null; className?: string };
export const WEEKDAYS = [
  { value: 1, short: "Mon" }, { value: 2, short: "Tue" }, { value: 3, short: "Wed" }, { value: 4, short: "Thu" }, { value: 5, short: "Fri" }, { value: 6, short: "Sat" },
];

/**
 * Read-only weekly grid. `show` picks the second line: the teacher (class view) or the class (teacher view).
 * Scrolls horizontally inside its own box on narrow screens.
 */
export function TimetableGrid({ slots, grid, show = "teacher", renderCell }: {
  slots: Slot[]; grid: Record<number, Record<string, Cell>>; show?: "teacher" | "class";
  renderCell?: (day: number, slot: Slot, cell: Cell | undefined) => React.ReactNode;
}) {
  if (slots.length === 0) return <p className="px-5 py-6 text-sm text-muted-foreground">No periods have been set up for this school yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className="w-28 border-b border-border px-3 py-2 text-left text-xs font-medium text-muted-foreground">Period</th>
            {WEEKDAYS.map((d) => <th key={d.value} scope="col" className="border-b border-border px-2 py-2 text-left text-xs font-medium text-muted-foreground">{d.short}</th>)}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot.id} className={cn(slot.isBreak && "bg-surface-muted/60")}>
              <th scope="row" className="border-b border-border px-3 py-2 text-left align-top font-medium">
                {slot.label}
                <span className="block text-xs font-normal tabular-nums text-muted-foreground">{slot.startTime}–{slot.endTime}</span>
              </th>
              {slot.isBreak ? (
                <td colSpan={6} className="border-b border-border px-2 py-2 text-center text-xs text-muted-foreground">{slot.label}</td>
              ) : WEEKDAYS.map((d) => {
                const cell = grid[d.value]?.[slot.id];
                return (
                  <td key={d.value} className="border-b border-border px-2 py-1.5 align-top">
                    {renderCell ? renderCell(d.value, slot, cell) : cell ? (
                      <div>
                        <p className="font-medium">{cell.subject}</p>
                        <p className="text-xs text-muted-foreground">{show === "teacher" ? cell.teacher ?? "No teacher" : cell.className}</p>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
