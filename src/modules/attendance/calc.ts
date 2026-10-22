/** Pure attendance calculations (unit tested). */

export type AttendanceStatusValue = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export type AttendanceTally = { present: number; absent: number; late: number; excused: number; total: number };

export function tally(statuses: AttendanceStatusValue[]): AttendanceTally {
  const t: AttendanceTally = { present: 0, absent: 0, late: 0, excused: 0, total: statuses.length };
  for (const s of statuses) {
    if (s === "PRESENT") t.present++;
    else if (s === "ABSENT") t.absent++;
    else if (s === "LATE") t.late++;
    else t.excused++;
  }
  return t;
}

/**
 * Attendance rate definition (documented in docs/METRICS.md):
 * (present + late) / (total - excused). Excused days are removed from the denominator.
 * Returns null when there is nothing to measure, so the UI can say "no data" instead of 0%.
 */
export function attendanceRate(t: AttendanceTally): number | null {
  const denominator = t.total - t.excused;
  if (denominator <= 0) return null;
  return (t.present + t.late) / denominator;
}

export function formatRate(rate: number | null): string {
  return rate === null ? "No data" : `${(rate * 100).toFixed(1)}%`;
}
