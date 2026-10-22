import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createStudent, linkGuardian, enrollStudent } from "@/modules/students/service";
import { acceptInvitation, inviteGuardian, inviteStaff } from "@/modules/identity/service";
import { getFamilyHome } from "@/modules/family/service";
import { loadActor } from "@/server/load-actor";
import { actor, school, section, T } from "../support/actors";

describe("student enrollment, guardian linking and family login", () => {
  it("admin creates a student, links a guardian (deduplicated by phone), invites them; guardian sees only that child", async () => {
    const admissions = await actor(T.admissionsSps);
    const sps = await school("SPS");
    const sec = await section("SPS", "Class 5", "A");
    const { student, guardianId } = await createStudent(admissions, {
      schoolId: sps.id, admissionNo: "SPS-T-0001", firstName: "Test", lastName: "Child", dateOfBirth: "2016-04-01", gender: "FEMALE",
      sectionId: sec.id, guardian: { name: "Test Guardian", phone: "9876500001", relation: "MOTHER", isPrimary: true },
    });
    expect(guardianId).toBeTruthy();
    await expect(createStudent(admissions, {
      schoolId: sps.id, admissionNo: "SPS-T-0001", firstName: "Dup", lastName: "Child", dateOfBirth: "2016-04-01", gender: "MALE", sectionId: sec.id,
    })).rejects.toMatchObject({ code: "CONFLICT" });

    // Sibling with the same guardian phone reuses the guardian record.
    const sib = await createStudent(admissions, {
      schoolId: sps.id, admissionNo: "SPS-T-0002", firstName: "Test", lastName: "Sibling", dateOfBirth: "2018-02-01", gender: "MALE",
      sectionId: sec.id, guardian: { name: "Different Spelling", phone: "9876500001", relation: "MOTHER", isPrimary: true },
    });
    expect(sib.guardianId).toBe(guardianId);
    await expect(linkGuardian(admissions, { studentId: student.id, guardian: { name: "Test Guardian", phone: "9876500001", relation: "MOTHER", isPrimary: true } }))
      .rejects.toMatchObject({ code: "CONFLICT" });

    // A teacher cannot create students.
    const teacher = await actor(T.teacherSps);
    await expect(createStudent(teacher, { schoolId: sps.id, admissionNo: "X1", firstName: "A", lastName: "B", dateOfBirth: "2016-01-01", gender: "MALE", sectionId: sec.id }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    // An SVL section cannot be used for an SPS student.
    const svlSec = await section("SVL", "Class 5", "A");
    await expect(enrollStudent(admissions, { studentId: student.id, sectionId: svlSec.id })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const invite = await inviteGuardian(admissions, { guardianId: guardianId!, email: "test.guardian@example.test" });
    expect(invite.activationUrl).toContain("/activate?token=");
    const token = new URL(invite.activationUrl!).searchParams.get("token")!;
    await expect(acceptInvitation({ token, password: "short", confirm: "short" })).rejects.toMatchObject({ code: "VALIDATION" });
    await acceptInvitation({ token, password: "a-strong-password-1", confirm: "a-strong-password-1" });
    await expect(acceptInvitation({ token, password: "a-strong-password-1", confirm: "a-strong-password-1" })).rejects.toMatchObject({ code: "VALIDATION" });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "test.guardian@example.test" } });
    const guardianActor = (await loadActor(user.id))!;
    const kids = await getFamilyHome(guardianActor);
    expect(kids.map((k) => k.admissionNo).sort()).toEqual(["SPS-T-0001", "SPS-T-0002"]);
    expect(await prisma.devOutboxMessage.count({ where: { to: "test.guardian@example.test" } })).toBe(1);
  });

  it("staff invitations cannot escalate privileges", async () => {
    const principal = await actor(T.principalSps);
    const sps = await school("SPS");
    // Principals do not hold ledger permissions, so they cannot mint an Accounts Administrator.
    await expect(inviteStaff(principal, { schoolId: sps.id, email: "x@example.test", name: "X Person", roleKey: "accounts_admin" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
