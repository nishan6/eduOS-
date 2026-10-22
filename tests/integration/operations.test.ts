import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addDays, schoolToday } from "@/lib/dates";
import { addSlot, removeSlot, sectionTimetable, setEntry, studentTimetable, teacherTimetable } from "@/modules/timetable/service";
import { createEvent, deleteEvent, familyCalendar, schoolCalendar } from "@/modules/events/service";
import { createTicket, getTicket, listQueue, myTickets, replyToTicket, updateTicket } from "@/modules/tickets/service";
import { setGradingRules } from "@/modules/org/service";
import { createExam, reportCard, getPaper, saveMarks, publishExam } from "@/modules/exams/service";
import { actor, parentChild, school, section, T } from "../support/actors";

describe("timetable", () => {
  it("principal edits a class timetable; a teacher cannot be double-booked; parents see their child's", async () => {
    const sps = await school("SPS");
    const principal = await actor(T.principalSps);
    const teacher = await actor(T.teacherSps);
    const sixA = await section("SPS", "Class 6", "A");
    const sixB = await section("SPS", "Class 6", "B");
    const slots = await prisma.periodSlot.findMany({ where: { schoolId: sps.id }, orderBy: { order: "asc" } });
    const p1 = slots.find((s) => s.label === "Period 1")!;
    const brk = slots.find((s) => s.isBreak)!;
    const sci = await prisma.subject.findFirstOrThrow({ where: { schoolId: sps.id, code: "SCI" } });

    // Seed: Lakshmi teaches 6-A in Period 1 on Monday. Booking her for 6-B at the same time is refused.
    await expect(setEntry(principal, { sectionId: sixB.id, dayOfWeek: 1, slotId: p1.id, subjectId: sci.id, teacherId: teacher.userId })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(setEntry(principal, { sectionId: sixA.id, dayOfWeek: 1, slotId: brk.id, subjectId: sci.id })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setEntry(teacher, { sectionId: sixA.id, dayOfWeek: 1, slotId: p1.id, subjectId: sci.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    // A teacher from the other school cannot be put on this timetable.
    await expect(setEntry(principal, { sectionId: sixA.id, dayOfWeek: 6, slotId: p1.id, subjectId: sci.id, teacherId: (await actor(T.teacherSvl)).userId })).rejects.toMatchObject({ code: "VALIDATION" });

    await setEntry(principal, { sectionId: sixA.id, dayOfWeek: 6, slotId: p1.id, subjectId: sci.id, teacherId: (await actor(T.teacher2Sps)).userId });
    const tt = await sectionTimetable(teacher, sixA.id);
    expect(tt.grid[6]![p1.id]!.subject).toBe("Science");
    expect((await teacherTimetable(await actor(T.teacher2Sps), sps.id)).periods).toBeGreaterThanOrEqual(1);
    // Clearing a cell removes it.
    await setEntry(principal, { sectionId: sixA.id, dayOfWeek: 6, slotId: p1.id, subjectId: "" });
    expect((await sectionTimetable(principal, sixA.id)).grid[6]?.[p1.id]).toBeUndefined();

    const aanya = await parentChild(T.parent, "SPS");
    expect((await studentTimetable(await actor(T.parent), aanya.id))!.section.id).toBe(sixA.id);
    await expect(studentTimetable(await actor(T.parent2), aanya.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Cross-school staff cannot read it.
    await expect(sectionTimetable(await actor(T.principalSvl), sixA.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("periods cannot overlap, and a period in use cannot be removed", async () => {
    const sps = await school("SPS");
    const principal = await actor(T.principalSps);
    await expect(addSlot(principal, { schoolId: sps.id, label: "Overlap", startTime: "09:00", endTime: "09:20" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(addSlot(principal, { schoolId: sps.id, label: "Backwards", startTime: "15:00", endTime: "14:30" })).rejects.toMatchObject({ code: "VALIDATION" });
    const extra = await addSlot(principal, { schoolId: sps.id, label: "Period 7", startTime: "14:10", endTime: "14:55" });
    const ordered = await prisma.periodSlot.findMany({ where: { schoolId: sps.id }, orderBy: { order: "asc" } });
    expect(ordered.at(-1)!.id).toBe(extra.id);
    await removeSlot(principal, extra.id);
    const p1 = ordered.find((s) => s.label === "Period 1")!;
    await expect(removeSlot(principal, p1.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("calendar", () => {
  it("staff see all events; parents see only everyone-events at their children's schools", async () => {
    const sps = await school("SPS");
    const principal = await actor(T.principalSps);
    const staffOnly = await createEvent(principal, { schoolId: sps.id, title: "Inspection prep", kind: "MEETING", audience: "STAFF", startsOn: addDays(schoolToday(), 2) });
    const sports = await createEvent(principal, { schoolId: sps.id, title: "Sports day", kind: "EVENT", startsOn: addDays(schoolToday(), 4) });
    await expect(createEvent(await actor(T.teacherSps), { schoolId: sps.id, title: "Nope", kind: "EVENT", startsOn: schoolToday() })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createEvent(principal, { schoolId: sps.id, title: "Backwards", kind: "EVENT", startsOn: addDays(schoolToday(), 3), endsOn: addDays(schoolToday(), 1) })).rejects.toMatchObject({ code: "VALIDATION" });

    const staffIds = (await schoolCalendar(await actor(T.teacherSps), sps.id)).map((e) => e.id);
    expect(staffIds).toEqual(expect.arrayContaining([staffOnly.id, sports.id]));
    const parentIds = (await familyCalendar(await actor(T.parent2))).map((e) => e.id);
    expect(parentIds).toContain(sports.id);
    expect(parentIds).not.toContain(staffOnly.id);
    // parent2 only has an SPS child, so SVL events never appear.
    const svlEvent = await prisma.schoolEvent.findFirstOrThrow({ where: { school: { code: "SVL" }, audience: "EVERYONE" } });
    expect(parentIds).not.toContain(svlEvent.id);

    await expect(deleteEvent(await actor(T.principalSvl), sports.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await deleteEvent(principal, sports.id);
  });
});

describe("helpdesk", () => {
  it("parent raises a ticket about their own child; helpdesk replies with an internal note the parent never sees", async () => {
    const parent = await actor(T.parent);
    const helpdesk = await actor(T.helpdeskSps);
    const aanya = await parentChild(T.parent, "SPS");
    const kabir = await parentChild(T.parent2, "SPS");

    await expect(createTicket(parent, { studentId: kabir.id, category: "FEES", subject: "Not my child", body: "Should be refused" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createTicket(parent, { category: "FEES", subject: "No child", body: "Should be refused" })).rejects.toMatchObject({ code: "VALIDATION" });
    const t = await createTicket(parent, { studentId: aanya.id, category: "FEES", subject: "Receipt missing", body: "I paid by UPI but have no receipt." });
    expect(t.number).toMatch(/^TKT-SPS-\d{6}$/);

    expect((await listQueue(helpdesk, aanya.schoolId)).rows.map((r) => r.id)).toContain(t.id);
    await expect(listQueue(await actor(T.teacherSps), aanya.schoolId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getTicket(await actor(T.parent2), t.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getTicket(await actor(T.principalSvl), t.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    await replyToTicket(helpdesk, { ticketId: t.id, body: "Cashier says UTR not matched yet", isInternal: true });
    await expect(replyToTicket(parent, { ticketId: t.id, body: "sneaky", isInternal: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await replyToTicket(helpdesk, { ticketId: t.id, body: "We are checking with the bank and will update you." });
    const parentView = await getTicket(parent, t.id);
    expect(parentView.messages.map((m) => m.body)).not.toContain("Cashier says UTR not matched yet");
    expect(parentView.messages).toHaveLength(2);
    expect(parentView.status).toBe("IN_PROGRESS");

    // Parents cannot assign or set arbitrary statuses; helpdesk can; resolving notifies the parent.
    await expect(updateTicket(parent, { ticketId: t.id, status: "RESOLVED" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateTicket(helpdesk, { ticketId: t.id, assigneeId: (await actor(T.cashierSvl)).userId })).rejects.toMatchObject({ code: "VALIDATION" });
    await updateTicket(helpdesk, { ticketId: t.id, assigneeId: helpdesk.userId });
    await updateTicket(helpdesk, { ticketId: t.id, status: "RESOLVED" });
    const parentUser = await prisma.user.findUniqueOrThrow({ where: { email: T.parent } });
    expect(await prisma.notification.count({ where: { userId: parentUser.id, title: `${t.number} resolved` } })).toBe(1);

    // Parent replying reopens; parent may close; closed tickets take no replies.
    await replyToTicket(parent, { ticketId: t.id, body: "Still not received." });
    expect((await getTicket(helpdesk, t.id)).status).toBe("OPEN");
    await updateTicket(parent, { ticketId: t.id, status: "CLOSED" });
    await expect(replyToTicket(parent, { ticketId: t.id, body: "again" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await myTickets(parent)).map((x) => x.id)).toContain(t.id);
  });

  it("staff can raise tickets in their own school only", async () => {
    const teacher = await actor(T.teacherSps);
    const svl = await school("SVL");
    const sps = await school("SPS");
    await expect(createTicket(teacher, { schoolId: svl.id, category: "TECHNICAL", subject: "Projector", body: "Broken in 6-A" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const t = await createTicket(teacher, { schoolId: sps.id, category: "TECHNICAL", subject: "Projector", body: "Broken in 6-A" });
    expect(t.schoolId).toBe(sps.id);
  });
});

describe("grading scales", () => {
  it("a school's scale is locked into each exam when it is created", async () => {
    const svl = await school("SVL");
    const principal = await actor(T.principalSvl);
    // Seeded SVL exams use the AP state scale.
    const ut1 = await prisma.exam.findFirstOrThrow({ where: { schoolId: svl.id, name: "Unit Test 1" } });
    expect(ut1).toMatchObject({ gradingScale: "AP_SSC_9_POINT", passPercent: 35 });
    const vivaan = await parentChild(T.parent, "SVL");
    const card = await reportCard(await actor(T.parent), vivaan.id, ut1.id);
    expect(card.gradingScale).toBe("AP_SSC_9_POINT");

    await expect(setGradingRules(await actor(T.teacherSvl), { schoolId: svl.id, scale: "CBSE_9_POINT", passPercent: 33 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setGradingRules(principal, { schoolId: svl.id, scale: "CBSE_9_POINT", passPercent: 90 })).rejects.toMatchObject({ code: "VALIDATION" });
    await setGradingRules(principal, { schoolId: svl.id, scale: "CBSE_9_POINT", passPercent: 33 });
    // Old exam unchanged; a new one picks up the new scale.
    expect((await prisma.exam.findUniqueOrThrow({ where: { id: ut1.id } })).gradingScale).toBe("AP_SSC_9_POINT");
    const g = await prisma.grade.findFirstOrThrow({ where: { schoolId: svl.id, name: "Class 7" } });
    const eng = await prisma.subject.findFirstOrThrow({ where: { schoolId: svl.id, code: "ENG" } });
    const exam = await createExam(principal, { schoolId: svl.id, name: "Scale check", gradeIds: [g.id], subjects: [{ subjectId: eng.id, maxMarks: 100 }] });
    expect(exam).toMatchObject({ gradingScale: "CBSE_9_POINT", passPercent: 33 });

    // 34/100 passes on CBSE (33%) — on the old AP scale (35%) it would have failed.
    for (const paper of await prisma.examPaper.findMany({ where: { examId: exam.id } })) {
      const pp = await getPaper(principal, paper.id);
      await saveMarks(principal, { paperId: paper.id, submit: true, entries: pp.students.map((s) => ({ studentId: s.id, marks: 34, isAbsent: false })) });
    }
    await publishExam(principal, exam.id);
    const r = await reportCard(principal, vivaan.id, exam.id);
    expect(r).toMatchObject({ passed: true, grade: "D" });
    await setGradingRules(principal, { schoolId: svl.id, scale: "AP_SSC_9_POINT", passPercent: 35 });
  });
});
