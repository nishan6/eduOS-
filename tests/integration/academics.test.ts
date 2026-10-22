import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addDays, schoolToday } from "@/lib/dates";
import { createHomework, cancelHomework, listHomework, studentHomework } from "@/modules/homework/service";
import { createExam, getExam, getPaper, listExams, publishExam, reopenPaper, reportCard, saveMarks, studentResults } from "@/modules/exams/service";
import { actor, parentChild, school, section, T } from "../support/actors";

describe("homework", () => {
  it("teacher sets homework for an assigned class only; parents of that class see it, others cannot", async () => {
    const teacher = await actor(T.teacherSps);
    const sixA = await section("SPS", "Class 6", "A");
    const sevenA = await section("SPS", "Class 7", "A");
    const due = addDays(schoolToday(), 3);

    await expect(createHomework(teacher, { sectionId: sevenA.id, title: "Not my class", instructions: "Should fail", dueOn: due })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createHomework(teacher, { sectionId: sixA.id, title: "Past due", instructions: "Should fail", dueOn: addDays(schoolToday(), -1) })).rejects.toMatchObject({ code: "VALIDATION" });
    const otherSchoolSubject = await prisma.subject.findFirstOrThrow({ where: { school: { code: "SVL" } } });
    await expect(createHomework(teacher, { sectionId: sixA.id, subjectId: otherSchoolSubject.id, title: "Wrong subject", instructions: "Should fail", dueOn: due })).rejects.toMatchObject({ code: "VALIDATION" });

    const hw = await createHomework(teacher, { sectionId: sixA.id, subjectId: "", title: "Read chapter 5", instructions: "Read and summarise in five lines.", dueOn: due });
    expect((await listHomework(teacher, sixA.schoolId)).map((h) => h.id)).toContain(hw.id);
    // Teachers cannot list classes they do not teach.
    await expect(listHomework(teacher, sixA.schoolId, { sectionId: sevenA.id })).rejects.toMatchObject({ code: "NOT_FOUND" });

    const parent = await actor(T.parent);
    const aanya = await parentChild(T.parent, "SPS");
    expect((await studentHomework(parent, aanya.id)).map((h) => h.id)).toContain(hw.id);
    const parentUser = await prisma.user.findUniqueOrThrow({ where: { email: T.parent } });
    expect(await prisma.notification.count({ where: { userId: parentUser.id, title: "New homework: Read chapter 5" } })).toBe(1);

    // Parent 2 (child in 6-B) cannot read Aanya's homework.
    await expect(studentHomework(await actor(T.parent2), aanya.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Another school's teacher cannot cancel it; the author can, once.
    await expect(cancelHomework(await actor(T.teacherSvl), hw.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await cancelHomework(teacher, hw.id);
    await expect(cancelHomework(teacher, hw.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await studentHomework(parent, aanya.id)).map((h) => h.id)).not.toContain(hw.id);
  });
});

describe("exams and marks", () => {
  it("only leadership creates exams; teachers enter marks for their sections; publish requires all papers", async () => {
    const sps = await school("SPS");
    const principal = await actor(T.principalSps);
    const teacher = await actor(T.teacherSps);
    const grade6 = await prisma.grade.findFirstOrThrow({ where: { schoolId: sps.id, name: "Class 6" } });
    const maths = await prisma.subject.findFirstOrThrow({ where: { schoolId: sps.id, code: "MATH" } });
    const eng = await prisma.subject.findFirstOrThrow({ where: { schoolId: sps.id, code: "ENG" } });

    await expect(createExam(teacher, { schoolId: sps.id, name: "Teacher exam", gradeIds: [grade6.id], subjects: [{ subjectId: maths.id, maxMarks: 20 }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const exam = await createExam(principal, { schoolId: sps.id, name: "Class test (integration)", gradeIds: [grade6.id], subjects: [{ subjectId: maths.id, maxMarks: 20 }, { subjectId: eng.id, maxMarks: 20 }] });
    await expect(createExam(principal, { schoolId: sps.id, name: "Class test (integration)", gradeIds: [grade6.id], subjects: [{ subjectId: maths.id, maxMarks: 20 }] })).rejects.toMatchObject({ code: "CONFLICT" });

    const detail = await getExam(principal, exam.id);
    expect(detail.papers).toHaveLength(4); // 6-A and 6-B × 2 subjects
    // Teacher of 6-A and 6-B sees both sections; teacher of 7-A sees none of this exam.
    expect((await listExams(teacher, sps.id)).map((e) => e.id)).toContain(exam.id);
    await expect(getExam(await actor(T.teacher2Sps), exam.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const sixA = await section("SPS", "Class 6", "A");
    const paperId = detail.papers.find((p) => p.sectionId === sixA.id && p.subject === "Mathematics")!.id;
    const paper = await getPaper(teacher, paperId);
    expect(paper.canEnter).toBe(true);
    const [first, ...rest] = paper.students;

    await expect(saveMarks(teacher, { paperId, entries: [{ studentId: first!.id, marks: 21, isAbsent: false }] })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(saveMarks(teacher, { paperId, entries: [{ studentId: first!.id, marks: 12.3, isAbsent: false }] })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(saveMarks(teacher, { paperId, submit: true, entries: [{ studentId: first!.id, marks: 10, isAbsent: false }] })).rejects.toMatchObject({ code: "VALIDATION" });
    // A student from another section cannot be smuggled into the paper.
    const kabir = await parentChild(T.parent2, "SPS");
    await expect(saveMarks(teacher, { paperId, entries: [{ studentId: kabir.id, marks: 10, isAbsent: false }] })).rejects.toMatchObject({ code: "VALIDATION" });
    // Teacher 2 (7-A only) cannot enter marks here.
    await expect(saveMarks(await actor(T.teacher2Sps), { paperId, entries: [{ studentId: first!.id, marks: 10, isAbsent: false }] })).rejects.toMatchObject({ code: "FORBIDDEN" });

    await saveMarks(teacher, { paperId, entries: [{ studentId: first!.id, marks: 18.5, isAbsent: false }] });
    await saveMarks(teacher, { paperId, submit: true, entries: rest.map((s, i) => ({ studentId: s.id, marks: i === 0 ? null : 10 + (i % 10), isAbsent: i === 0 })) });
    await expect(saveMarks(teacher, { paperId, entries: [{ studentId: first!.id, marks: 1, isAbsent: false }] })).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(publishExam(principal, exam.id)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(reopenPaper(teacher, paperId, "typo")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await reopenPaper(principal, paperId, "Fixing a typo");
    await saveMarks(teacher, { paperId, submit: true, entries: [{ studentId: first!.id, marks: 19, isAbsent: false }] });

    // Fill the other three papers as the principal (who holds marks.enter school-wide), then publish.
    for (const p of detail.papers.filter((x) => x.id !== paperId)) {
      const pp = await getPaper(principal, p.id);
      await saveMarks(principal, { paperId: p.id, submit: true, entries: pp.students.map((s) => ({ studentId: s.id, marks: 15, isAbsent: false })) });
    }

    const aanya = await parentChild(T.parent, "SPS");
    const parent = await actor(T.parent);
    // Before publishing, parents cannot see this exam at all.
    expect((await studentResults(parent, aanya.id)).map((r) => r.examId)).not.toContain(exam.id);
    await expect(reportCard(parent, aanya.id, exam.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Staff can.
    expect((await reportCard(principal, aanya.id, exam.id)).rows).toHaveLength(2);

    await publishExam(principal, exam.id);
    await expect(publishExam(principal, exam.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(reopenPaper(principal, paperId, "too late")).rejects.toMatchObject({ code: "CONFLICT" });

    const card = await reportCard(parent, aanya.id, exam.id);
    expect(card.max).toBe(40);
    expect(card.rows.map((r) => r.subject).sort()).toEqual(["English", "Mathematics"]);
    const parentUser = await prisma.user.findUniqueOrThrow({ where: { email: T.parent } });
    expect(await prisma.notification.count({ where: { userId: parentUser.id, title: { contains: "Class test (integration)" } } })).toBe(1);

    // Parent 2 cannot open Aanya's report card.
    await expect(reportCard(await actor(T.parent2), aanya.id, exam.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Seeded open exam (Half-Yearly) stays hidden from parents.
    const open = await prisma.exam.findFirstOrThrow({ where: { schoolId: sps.id, name: "Half-Yearly" } });
    expect((await studentResults(parent, aanya.id)).map((r) => r.examId)).not.toContain(open.id);
  });
});
