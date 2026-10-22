import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { assertCanReadStudent, getStudentProfile, listStudents } from "@/modules/students/service";
import { getRoster, saveAttendance, schoolDailyOverview } from "@/modules/attendance/service";
import { schoolFeeSummary, studentFeeAccount } from "@/modules/fees/service";
import { getFamilyHome } from "@/modules/family/service";
import { actor, parentChild, school, section, T } from "../support/actors";
import { schoolToday } from "@/lib/dates";

const code = async (p: Promise<unknown>) => {
  try { await p; return "OK"; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
};

describe("tenant isolation and scoped access", () => {
  it("a School A user cannot reach School B records", async () => {
    const principal = await actor(T.principalSps);
    const svl = await school("SVL");
    expect(principal.schools.map((s) => s.code)).toEqual(["SPS"]);
    expect(await code(listStudents(principal, svl.id))).toBe("FORBIDDEN");
    expect(await code(schoolDailyOverview(principal, svl.id))).toBe("FORBIDDEN");
    expect(await code(schoolFeeSummary(principal, svl.id))).toBe("FORBIDDEN");
    const svlStudent = await parentChild(T.parent, "SVL");
    // Existence of another school's student is not revealed.
    expect(await code(getStudentProfile(principal, svlStudent.id))).toBe("NOT_FOUND");
    expect(await code(studentFeeAccount(principal, svlStudent.id))).toBe("NOT_FOUND");
  });

  it("a teacher sees and marks only assigned sections", async () => {
    const teacher = await actor(T.teacherSps);
    const sps = await school("SPS");
    const own = await section("SPS", "Class 6", "A");
    const other = await section("SPS", "Class 7", "A");
    const list = await listStudents(teacher, sps.id);
    expect(list.total).toBe(22 * 2 + 2); // Class 6-A and 6-B plus the two demo-family children
    expect(await code(getRoster(teacher, own.id, schoolToday()))).toBe("OK");
    expect(await code(getRoster(teacher, other.id, schoolToday()))).toBe("FORBIDDEN");
    const roster = await getRoster(teacher, own.id, schoolToday());
    const foreign = await getRoster(await actor(T.teacher2Sps), other.id, schoolToday());
    expect(await code(saveAttendance(teacher, { sectionId: other.id, date: schoolToday(), submit: false, entries: [{ studentId: foreign.students[0]!.id, status: "PRESENT" }] }))).toBe("FORBIDDEN");
    // Smuggling a student from another section into an assigned section's roll is rejected.
    expect(await code(saveAttendance(teacher, { sectionId: own.id, date: schoolToday(), submit: false, entries: [{ studentId: foreign.students[0]!.id, status: "PRESENT" }] }))).toBe("VALIDATION");
    expect(roster.students.length).toBeGreaterThan(0);
  });

  it("parents only see children linked to them, across schools", async () => {
    const parent = await actor(T.parent);
    const children = await getFamilyHome(parent);
    expect(children.map((c) => c.school.code).sort()).toEqual(["SPS", "SVL"]);
    const other = await actor(T.parent2);
    const kabir = (await getFamilyHome(other))[0]!;
    expect(await code(assertCanReadStudent(parent, kabir.id))).toBe("NOT_FOUND");
    expect(await code(studentFeeAccount(parent, kabir.id))).toBe("NOT_FOUND");
    expect(parent.schools).toEqual([]); // parents get no staff access to any school
  });
});
