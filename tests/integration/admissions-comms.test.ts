import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { convertEnquiry, createEnquiry, getEnquiry, listEnquiries, moveStage } from "@/modules/admissions/service";
import { familyAnnouncements, sendAnnouncement } from "@/modules/announcements/service";
import { actor, section, school, T } from "../support/actors";

describe("admissions pipeline", () => {
  it("officer logs, progresses and converts an enquiry into an enrolled student", async () => {
    const sps = await school("SPS");
    const officer = await actor(T.admissionsSps);
    const grade5 = await prisma.grade.findFirstOrThrow({ where: { schoolId: sps.id, name: "Class 5" } });
    const base = { schoolId: sps.id, gradeId: grade5.id, childFirstName: "Nila", childLastName: "Varma", guardianName: "Suma Varma", phone: "9876500011" };

    await expect(createEnquiry(await actor(T.teacherSps), base)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const e = await createEnquiry(officer, { ...base, source: "Walk-in" });
    expect(e.number).toMatch(/^ENQ-SPS-\d{6}$/);
    await expect(createEnquiry(officer, base)).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(moveStage(officer, { enquiryId: e.id, toStage: "LOST" })).rejects.toMatchObject({ code: "VALIDATION" });
    await moveStage(officer, { enquiryId: e.id, toStage: "CONTACTED", note: "Called mother" });
    await moveStage(officer, { enquiryId: e.id, toStage: "APPLIED" });
    expect((await listEnquiries(officer, sps.id, { stage: "APPLIED" })).rows.map((r) => r.id)).toContain(e.id);

    // Other school's principal cannot see it.
    await expect(getEnquiry(await actor(T.principalSvl), e.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Section from another school is rejected during conversion.
    const svlSection = await section("SVL", "Class 5", "A");
    await expect(convertEnquiry(officer, { enquiryId: e.id, admissionNo: "SPS-ENQ-1", sectionId: svlSection.id, dateOfBirth: "2021-04-02", gender: "FEMALE", relation: "MOTHER" })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const fiveA = await section("SPS", "Class 5", "A");
    const student = await convertEnquiry(officer, { enquiryId: e.id, admissionNo: "SPS-ENQ-1", sectionId: fiveA.id, dateOfBirth: "2021-04-02", gender: "FEMALE", relation: "MOTHER" });
    const after = await getEnquiry(officer, e.id);
    expect(after.stage).toBe("ADMITTED");
    expect(after.studentId).toBe(student.id);
    expect(await prisma.studentEnrollment.count({ where: { studentId: student.id, sectionId: fiveA.id } })).toBe(1);
    expect(await prisma.studentGuardianRelationship.count({ where: { studentId: student.id, guardian: { phone: base.phone } } })).toBe(1);
    await expect(convertEnquiry(officer, { enquiryId: e.id, admissionNo: "SPS-ENQ-2", sectionId: fiveA.id, dateOfBirth: "2021-04-02", gender: "FEMALE", relation: "MOTHER" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(moveStage(officer, { enquiryId: e.id, toStage: "NEW" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("a failed conversion leaves no student behind", async () => {
    const sps = await school("SPS");
    const officer = await actor(T.admissionsSps);
    const grade5 = await prisma.grade.findFirstOrThrow({ where: { schoolId: sps.id, name: "Class 5" } });
    const e = await createEnquiry(officer, { schoolId: sps.id, gradeId: grade5.id, childFirstName: "Tara", childLastName: "Rao", guardianName: "Kiran Rao", phone: "9876500022" });
    await moveStage(officer, { enquiryId: e.id, toStage: "LOST", lostReason: "Relocated" });
    const fiveA = await section("SPS", "Class 5", "A");
    await expect(convertEnquiry(officer, { enquiryId: e.id, admissionNo: "SPS-ENQ-3", sectionId: fiveA.id, dateOfBirth: "2021-01-01", gender: "FEMALE", relation: "FATHER" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.student.count({ where: { admissionNo: "SPS-ENQ-3" } })).toBe(0);
  });
});

describe("announcements", () => {
  it("teachers message only their sections; leadership messages the school; parents see what is addressed to them", async () => {
    const sps = await school("SPS");
    const teacher = await actor(T.teacherSps);
    const sixA = await section("SPS", "Class 6", "A");
    const sevenA = await section("SPS", "Class 7", "A");
    const msg = { schoolId: sps.id, title: "Bring art supplies", body: "Please send crayons tomorrow." };

    await expect(sendAnnouncement(teacher, { ...msg, audience: "SECTION_PARENTS", sectionId: sevenA.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(sendAnnouncement(teacher, { ...msg, audience: "SCHOOL_PARENTS" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(sendAnnouncement(await actor(T.principalSvl), { ...msg, audience: "SCHOOL_PARENTS" })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const sent = await sendAnnouncement(teacher, { ...msg, audience: "SECTION_PARENTS", sectionId: sixA.id });
    expect(sent.inApp).toBeGreaterThanOrEqual(1); // the demo parent of Aanya has a login
    expect(sent.provider).toBe("development-outbox");
    expect(sent.delivered).toBe(0); // the outbox never claims delivery

    const parent = await actor(T.parent);
    const parent2 = await actor(T.parent2);
    expect((await familyAnnouncements(parent)).map((a) => a.id)).toContain(sent.id);
    expect((await familyAnnouncements(parent2)).map((a) => a.id)).not.toContain(sent.id);

    const all = await sendAnnouncement(await actor(T.principalSps), { ...msg, title: "School closed Monday", audience: "SCHOOL_PARENTS" });
    expect((await familyAnnouncements(parent2)).map((a) => a.id)).toContain(all.id);
    // Parent has a child in SVL too, but an SVL-only notice must not leak to parent2.
    const svlAll = await sendAnnouncement(await actor(T.principalSvl), { schoolId: (await school("SVL")).id, title: "SVL sports day", body: "Friday.", audience: "SCHOOL_PARENTS" });
    expect((await familyAnnouncements(parent)).map((a) => a.id)).toContain(svlAll.id);
    expect((await familyAnnouncements(parent2)).map((a) => a.id)).not.toContain(svlAll.id);
  });
});
