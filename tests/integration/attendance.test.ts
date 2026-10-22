import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { schoolToday } from "@/lib/dates";
import { decideCorrection, getRoster, listPendingCorrections, requestCorrection, saveAttendance, schoolDailyOverview } from "@/modules/attendance/service";
import { getFamilyHome } from "@/modules/family/service";
import { actor, parentChild, school, section, T } from "../support/actors";

describe("attendance workflow", () => {
  it("teacher marks and submits, parent sees it, principal sees aggregates, correction is approved", async () => {
    const teacher = await actor(T.teacherSps);
    const sec = await section("SPS", "Class 6", "A");
    const today = schoolToday();
    const child = await parentChild(T.parent, "SPS");
    const roster = await getRoster(teacher, sec.id, today);
    expect(roster.session).toBeNull();

    const entries = roster.students.map((s) => ({ studentId: s.id, status: s.id === child.id ? ("ABSENT" as const) : ("PRESENT" as const) }));
    // Submitting with students missing is rejected.
    await expect(saveAttendance(teacher, { sectionId: sec.id, date: today, submit: true, entries: entries.slice(1) })).rejects.toBeInstanceOf(AppError);
    await saveAttendance(teacher, { sectionId: sec.id, date: today, submit: false, entries: entries.slice(0, 3) });
    await saveAttendance(teacher, { sectionId: sec.id, date: today, submit: true, entries });
    // Submitted attendance cannot be overwritten directly.
    await expect(saveAttendance(teacher, { sectionId: sec.id, date: today, submit: false, entries })).rejects.toMatchObject({ code: "CONFLICT" });

    const parent = await actor(T.parent);
    const home = await getFamilyHome(parent);
    expect(home.find((c) => c.id === child.id)!.today).toEqual({ status: "ABSENT", remark: null });
    const parentUser = await prisma.user.findUniqueOrThrow({ where: { email: T.parent } });
    expect(await prisma.notification.count({ where: { userId: parentUser.id, title: { contains: "absent" } } })).toBe(1);

    const principal = await actor(T.principalSps);
    const sps = await school("SPS");
    const overview = await schoolDailyOverview(principal, sps.id, today);
    const row = overview.sections.find((s) => s.sectionId === sec.id)!;
    expect(row.status).toBe("SUBMITTED");
    expect(row.tally.absent).toBe(1);
    expect(row.absentees.map((a) => a.id)).toEqual([child.id]);

    // Correction: teacher requests, cannot self-approve, principal approves.
    const after = await getRoster(teacher, sec.id, today);
    const rec = after.students.find((s) => s.id === child.id)!;
    const req = await requestCorrection(teacher, { attendanceId: rec.attendanceId!, toStatus: "PRESENT", reason: "Arrived after roll call with note" });
    await expect(requestCorrection(teacher, { attendanceId: rec.attendanceId!, toStatus: "LATE", reason: "duplicate request" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(decideCorrection(teacher, { requestId: req.id, approve: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await listPendingCorrections(principal, sps.id)).map((c) => c.id)).toContain(req.id);
    await decideCorrection(principal, { requestId: req.id, approve: true });
    await expect(decideCorrection(principal, { requestId: req.id, approve: false })).rejects.toMatchObject({ code: "CONFLICT" });
    const home2 = await getFamilyHome(parent);
    expect(home2.find((c) => c.id === child.id)!.today?.status).toBe("PRESENT");
    expect(await prisma.auditLog.count({ where: { action: "attendance.correction.approve", entityId: req.id } })).toBe(1);
  });

  it("rejects future dates", async () => {
    const teacher = await actor(T.teacherSps);
    const sec = await section("SPS", "Class 6", "B");
    const roster = await getRoster(teacher, sec.id, schoolToday());
    await expect(saveAttendance(teacher, { sectionId: sec.id, date: "2099-01-01", submit: false, entries: [{ studentId: roster.students[0]!.id, status: "PRESENT" }] }))
      .rejects.toMatchObject({ code: "VALIDATION" });
  });
});
