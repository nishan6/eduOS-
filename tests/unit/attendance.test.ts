import { describe, expect, it } from "vitest";
import { attendanceRate, formatRate, tally } from "@/modules/attendance/calc";
import { addDays, schoolToday } from "@/lib/dates";

describe("attendance calculations", () => {
  it("counts late as attended and removes excused from the denominator", () => {
    const t = tally(["PRESENT", "PRESENT", "LATE", "ABSENT", "EXCUSED"]);
    expect(t).toEqual({ present: 2, absent: 1, late: 1, excused: 1, total: 5 });
    expect(attendanceRate(t)).toBe(0.75);
  });
  it("reports no data instead of 0% when nothing is measurable", () => {
    expect(attendanceRate(tally([]))).toBeNull();
    expect(attendanceRate(tally(["EXCUSED"]))).toBeNull();
    expect(formatRate(null)).toBe("No data");
  });
});

describe("school dates", () => {
  it("uses the IST calendar date", () => {
    // 20:00 UTC on 22 Oct is 01:30 IST on 23 Oct
    expect(schoolToday(new Date("2026-10-22T20:00:00Z"))).toBe("2026-10-23");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
