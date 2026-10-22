/** Schools operate in IST. "School date" = calendar date in Asia/Kolkata, stored as a UTC-midnight Date for @db.Date columns. */
export const SCHOOL_TZ = "Asia/Kolkata";

export function schoolToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SCHOOL_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function toDbDate(isoDate: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error(`Invalid date: ${isoDate}`);
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function fromDbDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const d = toDbDate(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return fromDbDate(d);
}

const display = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export function formatDate(d: Date | string): string {
  return display.format(typeof d === "string" ? toDbDate(d) : d);
}

const displayTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: SCHOOL_TZ,
});
export function formatDateTime(d: Date): string {
  return displayTime.format(d);
}
