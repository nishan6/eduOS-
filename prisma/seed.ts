/**
 * EduOS development seed. ALL DATA IS FICTIONAL DEMO DATA.
 * - Refuses to run when EDUOS_ENV=production.
 * - Refuses to run if the demo organization already exists (it never wipes data).
 *   To start over in development: `npx prisma migrate reset` (drops the dev database), which re-runs this seed.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient, type AcademicYear, type AttendanceStatus, type Gender, type Grade, type GuardianRelation, type School, type Section } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { syncPermissionCatalog, syncRoleTemplates } from "@/modules/identity/roles";
import { ensureDefaultAccounts } from "@/modules/finance/ledger";
import { loadActor } from "@/server/load-actor";
import { assignFeeStructure, recordPayment } from "@/modules/fees/service";
import { createExam, publishExam, saveMarks } from "@/modules/exams/service";
import { createHomework } from "@/modules/homework/service";
import { createEnquiry, moveStage } from "@/modules/admissions/service";
import { sendAnnouncement } from "@/modules/announcements/service";
import { addDays, schoolToday, toDbDate } from "@/lib/dates";

const prisma = new PrismaClient();
export const DEMO_PASSWORD = "EduOS-demo-2026!";
export const DEMO_ORG_SLUG = "demo-group";

// Deterministic PRNG so the seed is reproducible.
let state = 20261022;
function rand() {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
}
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;

const FIRST_M = ["Aarav", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan", "Rohan", "Karthik", "Aditya", "Nikhil", "Varun", "Charan", "Harsha", "Teja"];
const FIRST_F = ["Ananya", "Diya", "Aadhya", "Saanvi", "Meghana", "Lakshmi", "Keerthi", "Harini", "Pranavi", "Sravya", "Navya", "Ira", "Tanvi", "Bhavya", "Riya"];
const LAST = ["Reddy", "Rao", "Naidu", "Sharma", "Varma", "Chowdary", "Iyer", "Kumar", "Prasad", "Murthy", "Gupta", "Shetty", "Pillai", "Das", "Menon"];
const FATHER = ["Srinivas", "Ravi", "Suresh", "Venkat", "Mahesh", "Ramesh", "Prakash", "Kiran", "Anil", "Rajesh"];

async function createUser(email: string, name: string) {
  const user = await prisma.user.create({ data: { email, name, emailVerified: true, status: "ACTIVE" } });
  await prisma.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: await hashPassword(DEMO_PASSWORD) } });
  return user;
}

async function main() {
  if (process.env.EDUOS_ENV === "production") throw new Error("Refusing to seed demo data into production.");
  if (await prisma.organization.findUnique({ where: { slug: DEMO_ORG_SLUG } })) {
    console.log("Demo organization already exists; nothing to do. Use `npx prisma migrate reset` in development to start over.");
    return;
  }

  const today = schoolToday();
  console.log(`Seeding demo data (school date ${today})...`);

  await prisma.$transaction(async (tx) => syncPermissionCatalog(tx));
  const org = await prisma.organization.create({ data: { name: "Demo Educational Society", slug: DEMO_ORG_SLUG } });
  await prisma.$transaction(async (tx) => syncRoleTemplates(tx, org.id), { timeout: 60000 });
  const roles = new Map((await prisma.role.findMany({ where: { organizationId: org.id } })).map((r) => [r.key, r.id]));

  const schoolDefs = [
    { name: "Sunrise Public School (Demo)", code: "SPS", board: "CBSE" as const, city: "Vijayawada", hasHostel: false, brandColor: "#2563eb" },
    { name: "Sunrise Vidyalaya (Demo)", code: "SVL", board: "AP_STATE" as const, city: "Guntur", hasHostel: true, brandColor: "#0d9488" },
  ];
  const schools: { school: School; year: AcademicYear; sections: (Section & { grade: Grade })[] }[] = [];
  for (const d of schoolDefs) {
    const school = await prisma.school.create({ data: { organizationId: org.id, state: "Andhra Pradesh", ...d } });
    await prisma.academicYear.create({ data: { schoolId: school.id, name: "2025-26", startDate: toDbDate("2025-06-01"), endDate: toDbDate("2026-04-30") } });
    const year = await prisma.academicYear.create({ data: { schoolId: school.id, name: "2026-27", startDate: toDbDate("2026-06-01"), endDate: toDbDate("2027-04-30"), isCurrent: true } });
    await prisma.$transaction((tx) => ensureDefaultAccounts(tx, school.id));
    const sections: (Section & { grade: Grade })[] = [];
    for (const [order, gradeName] of ["Class 5", "Class 6", "Class 7", "Class 8"].entries()) {
      const grade = await prisma.grade.create({ data: { schoolId: school.id, name: gradeName, order: order + 5 } });
      for (const s of ["A", "B"]) {
        sections.push(await prisma.section.create({ data: { schoolId: school.id, gradeId: grade.id, academicYearId: year.id, name: s }, include: { grade: true } }));
      }
    }
    for (const [code, name] of [["ENG", "English"], ["MATH", "Mathematics"], ["SCI", "Science"], ["SOC", "Social Studies"], [d.board === "CBSE" ? "HIN" : "TEL", d.board === "CBSE" ? "Hindi" : "Telugu"]]) {
      await prisma.subject.create({ data: { schoolId: school.id, code: code!, name: name! } });
    }
    schools.push({ school, year, sections });
  }
  const [sps, svl] = schools as [typeof schools[number], typeof schools[number]];
  const sec = (s: typeof sps, grade: string, name: string) => s.sections.find((x) => x.grade.name === grade && x.name === name)!;

  // --- Staff ---
  type StaffDef = { email: string; name: string; role: string; school: typeof sps | null; teach?: { section: string; classTeacher: boolean }[] };
  const staff: StaffDef[] = [
    { email: "owner@demo.eduos.test", name: "Demo Owner", role: "org_owner", school: null },
    { email: "groupadmin@demo.eduos.test", name: "Demo Group Admin", role: "group_admin", school: null },
    { email: "principal.sps@demo.eduos.test", name: "Demo Principal SPS", role: "principal", school: sps },
    { email: "principal.svl@demo.eduos.test", name: "Demo Principal SVL", role: "principal", school: svl },
    { email: "teacher.sps@demo.eduos.test", name: "Demo Teacher Lakshmi", role: "teacher", school: sps, teach: [{ section: "Class 6/A", classTeacher: true }, { section: "Class 6/B", classTeacher: false }] },
    { email: "teacher2.sps@demo.eduos.test", name: "Demo Teacher Kiran", role: "teacher", school: sps, teach: [{ section: "Class 7/A", classTeacher: true }] },
    { email: "teacher.svl@demo.eduos.test", name: "Demo Teacher Ravi", role: "teacher", school: svl, teach: [{ section: "Class 7/A", classTeacher: true }] },
    { email: "accounts.sps@demo.eduos.test", name: "Demo Accounts Admin SPS", role: "accounts_admin", school: sps },
    { email: "cashier.sps@demo.eduos.test", name: "Demo Cashier SPS", role: "accountant", school: sps },
    { email: "cashier.svl@demo.eduos.test", name: "Demo Cashier SVL", role: "accountant", school: svl },
    { email: "admissions.sps@demo.eduos.test", name: "Demo Admissions SPS", role: "admissions_officer", school: sps },
  ];
  const users: Record<string, string> = {};
  for (const s of staff) {
    const u = await createUser(s.email, s.name);
    users[s.email] = u.id;
    if (s.school) await prisma.userSchoolMembership.create({ data: { userId: u.id, schoolId: s.school.school.id } });
    await prisma.userRoleAssignment.create({ data: { userId: u.id, roleId: roles.get(s.role)!, organizationId: org.id, schoolId: s.school?.school.id ?? null } });
    for (const t of s.teach ?? []) {
      const [g, n] = t.section.split("/");
      const section = sec(s.school!, g!, n!);
      await prisma.teacherAssignment.create({ data: { userId: u.id, schoolId: s.school!.school.id, sectionId: section.id, isClassTeacher: t.classTeacher } });
    }
  }

  // --- Students, guardians ---
  let phoneSeq = 9000000001;
  let admission = 1;
  const allStudents: { id: string; schoolIdx: number; gradeName: string }[] = [];
  for (const [schoolIdx, s] of schools.entries()) {
    for (const section of s.sections) {
      for (let roll = 1; roll <= 22; roll++) {
        const gender: Gender = rand() < 0.5 ? "MALE" : "FEMALE";
        const last = pick(LAST);
        const age = 5 + section.grade.order; // Class 6 -> ~11
        const student = await prisma.student.create({
          data: {
            schoolId: s.school.id,
            admissionNo: `${s.school.code}${String(admission++).padStart(5, "0")}`,
            firstName: gender === "MALE" ? pick(FIRST_M) : pick(FIRST_F),
            lastName: last,
            dateOfBirth: toDbDate(`${2026 - age}-${String(1 + Math.floor(rand() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 28)).padStart(2, "0")}`),
            gender,
            isDemo: true,
            statusHistory: { create: { toStatus: "ACTIVE", reason: "Demo seed" } },
            enrollments: { create: { academicYearId: s.year.id, sectionId: section.id, rollNo: roll } },
          },
        });
        const guardian = await prisma.guardian.create({
          data: { organizationId: org.id, name: `${pick(FATHER)} ${last}`, phone: String(phoneSeq++), isDemo: true },
        });
        await prisma.studentGuardianRelationship.create({ data: { studentId: student.id, guardianId: guardian.id, relation: "FATHER", isPrimary: true } });
        allStudents.push({ id: student.id, schoolIdx, gradeName: section.grade.name });
      }
    }
  }

  // --- Demo parent logins: one family with children in BOTH schools, one with a single child ---
  async function demoFamily(email: string, name: string, children: { school: typeof sps; grade: string; section: string; first: string; gender: Gender }[], relation: GuardianRelation) {
    const user = await createUser(email, name);
    await prisma.userRoleAssignment.create({ data: { userId: user.id, roleId: roles.get("parent")!, organizationId: org.id, schoolId: null } });
    const guardian = await prisma.guardian.create({ data: { organizationId: org.id, userId: user.id, name, phone: String(phoneSeq++), email, isDemo: true } });
    const family = await prisma.familyAccount.create({ data: { organizationId: org.id, name: `${name.split(" ").pop()} family`, members: { create: { guardianId: guardian.id } } } });
    for (const c of children) {
      const section = sec(c.school, c.grade, c.section);
      const roll = 23 + (await prisma.studentEnrollment.count({ where: { sectionId: section.id, rollNo: { gt: 22 } } }));
      const student = await prisma.student.create({
        data: {
          schoolId: c.school.school.id, admissionNo: `${c.school.school.code}${String(admission++).padStart(5, "0")}`,
          firstName: c.first, lastName: name.split(" ").pop()!, dateOfBirth: toDbDate("2015-03-14"), gender: c.gender, isDemo: true,
          statusHistory: { create: { toStatus: "ACTIVE", reason: "Demo seed" } },
          enrollments: { create: { academicYearId: c.school.year.id, sectionId: section.id, rollNo: roll } },
        },
      });
      await prisma.studentGuardianRelationship.create({ data: { studentId: student.id, guardianId: guardian.id, relation, isPrimary: true } });
      allStudents.push({ id: student.id, schoolIdx: schools.indexOf(c.school), gradeName: c.grade });
    }
    return family;
  }
  await demoFamily("parent@demo.eduos.test", "Demo Parent Sharma", [
    { school: sps, grade: "Class 6", section: "A", first: "Aanya", gender: "FEMALE" },
    { school: svl, grade: "Class 7", section: "A", first: "Vivaan", gender: "MALE" },
  ], "MOTHER");
  await demoFamily("parent2@demo.eduos.test", "Demo Parent Rao", [{ school: sps, grade: "Class 6", section: "B", first: "Kabir", gender: "MALE" }], "FATHER");

  // --- Attendance: last 20 school days (Mon–Sat), submitted; today left for teachers to mark ---
  console.log("  attendance...");
  for (const s of schools) {
    const teacherId = Object.values(users)[0]!;
    for (const section of s.sections) {
      const enrolled = await prisma.studentEnrollment.findMany({ where: { sectionId: section.id }, select: { studentId: true } });
      let d = today;
      let days = 0;
      while (days < 20) {
        d = addDays(d, -1);
        if (new Date(`${d}T00:00:00Z`).getUTCDay() === 0) continue; // Sunday
        days++;
        const session = await prisma.attendanceSession.create({
          data: { schoolId: s.school.id, sectionId: section.id, date: toDbDate(d), status: "SUBMITTED", markedById: teacherId, submittedAt: new Date(`${d}T04:00:00Z`) },
        });
        await prisma.studentAttendance.createMany({
          data: enrolled.map((e) => {
            const r = rand();
            const status: AttendanceStatus = r < 0.9 ? "PRESENT" : r < 0.95 ? "ABSENT" : r < 0.98 ? "LATE" : "EXCUSED";
            return { sessionId: session.id, studentId: e.studentId, status };
          }),
        });
      }
    }
  }

  // --- Fees: categories, one structure per class, invoices via the real service, demo payments ---
  console.log("  fees...");
  const tuitionByGrade: Record<string, number> = { "Class 5": 1_500_000, "Class 6": 1_650_000, "Class 7": 1_800_000, "Class 8": 2_000_000 };
  for (const [idx, s] of schools.entries()) {
    const cats = {
      TUITION: await prisma.feeCategory.create({ data: { schoolId: s.school.id, code: "TUITION", name: "Tuition Fee" } }),
      EXAM: await prisma.feeCategory.create({ data: { schoolId: s.school.id, code: "EXAM", name: "Examination Fee" } }),
      BOOKS: await prisma.feeCategory.create({ data: { schoolId: s.school.id, code: "BOOKS", name: "Books & Materials" } }),
    };
    const accountsEmail = idx === 0 ? "accounts.sps@demo.eduos.test" : "owner@demo.eduos.test";
    const feeActor = (await loadActor(users[accountsEmail]!))!;
    const cashierActor = (await loadActor(users[idx === 0 ? "cashier.sps@demo.eduos.test" : "cashier.svl@demo.eduos.test"]!))!;
    // Owner holds fees.assign org-wide; for SVL the owner assigns structures in this demo.
    for (const grade of await prisma.grade.findMany({ where: { schoolId: s.school.id } })) {
      const annual = tuitionByGrade[grade.name]! * (idx === 0 ? 1 : 0.8);
      const term = Math.round(annual / 3 / 100) * 100;
      const structure = await prisma.feeStructure.create({
        data: {
          schoolId: s.school.id, academicYearId: s.year.id, gradeId: grade.id, name: `${grade.name} Fees 2026-27`,
          components: {
            create: [
              { categoryId: cats.TUITION.id, label: "Tuition - Term 1", amountPaise: term, dueDate: toDbDate("2026-06-15") },
              { categoryId: cats.BOOKS.id, label: "Books & Materials", amountPaise: 450_000, dueDate: toDbDate("2026-06-15") },
              { categoryId: cats.TUITION.id, label: "Tuition - Term 2", amountPaise: term, dueDate: toDbDate("2026-10-15") },
              { categoryId: cats.EXAM.id, label: "Examination Fee", amountPaise: 150_000, dueDate: toDbDate("2026-10-15") },
              { categoryId: cats.TUITION.id, label: "Tuition - Term 3", amountPaise: term, dueDate: toDbDate("2027-01-15") },
            ],
          },
        },
        include: { components: true },
      });
      const studentsInGrade = allStudents.filter((x) => x.schoolIdx === idx && x.gradeName === grade.name);
      for (const st of studentsInGrade) {
        const invoices = await assignFeeStructure(feeActor, { studentId: st.id, structureId: structure.id });
        const [t1, t2] = invoices;
        const r = rand();
        if (t1 && r < 0.85) {
          await recordPayment(cashierActor, {
            studentId: st.id, amountPaise: t1.totalPaise, mode: rand() < 0.55 ? "UPI" : "CASH",
            reference: `DEMO-UPI-${Math.floor(rand() * 1e9)}`, receivedOn: addDays("2026-06-10", Math.floor(rand() * 40)),
            idempotencyKey: `seed-${st.id}-t1`,
          });
        }
        if (t2 && r < 0.45) {
          const amount = rand() < 0.7 ? t2.totalPaise : Math.round(t2.totalPaise / 2);
          await recordPayment(cashierActor, {
            studentId: st.id, amountPaise: amount, mode: rand() < 0.6 ? "UPI" : "CASH",
            reference: `DEMO-UPI-${Math.floor(rand() * 1e9)}`, receivedOn: addDays("2026-10-01", Math.floor(rand() * 20)),
            idempotencyKey: `seed-${st.id}-t2`,
          });
        }
      }
    }
  }

  // --- Academics: a published unit test with marks, an open half-yearly, and homework ---
  console.log("  exams and homework...");
  for (const [idx, s] of schools.entries()) {
    const principal = (await loadActor(users[idx === 0 ? "principal.sps@demo.eduos.test" : "principal.svl@demo.eduos.test"]!))!;
    const grades = await prisma.grade.findMany({ where: { schoolId: s.school.id } });
    const subjects = await prisma.subject.findMany({ where: { schoolId: s.school.id } });
    const ut1 = await createExam(principal, {
      schoolId: s.school.id, name: "Unit Test 1", startsOn: "2026-07-20",
      gradeIds: grades.map((g) => g.id), subjects: subjects.map((x) => ({ subjectId: x.id, maxMarks: 25 })),
    });
    for (const paper of await prisma.examPaper.findMany({ where: { examId: ut1.id } })) {
      const enrolled = await prisma.studentEnrollment.findMany({ where: { sectionId: paper.sectionId, status: "ACTIVE" }, select: { studentId: true } });
      await saveMarks(principal, {
        paperId: paper.id, submit: true,
        entries: enrolled.map((e) => {
          const absent = rand() < 0.02;
          // Skewed toward the upper half, in half marks.
          const marks = Math.round(Math.min(25, Math.max(4, 25 * (0.45 + 0.55 * Math.sqrt(rand())))) * 2) / 2;
          return { studentId: e.studentId, isAbsent: absent, marks: absent ? null : marks };
        }),
      });
    }
    await publishExam(principal, ut1.id);
    await createExam(principal, {
      schoolId: s.school.id, name: "Half-Yearly", startsOn: addDays(today, 10),
      gradeIds: grades.map((g) => g.id), subjects: subjects.map((x) => ({ subjectId: x.id, maxMarks: 80 })),
    });
  }
  const teacher = (await loadActor(users["teacher.sps@demo.eduos.test"]!))!;
  const [maths, science] = await Promise.all([
    prisma.subject.findFirstOrThrow({ where: { schoolId: sps.school.id, code: "MATH" } }),
    prisma.subject.findFirstOrThrow({ where: { schoolId: sps.school.id, code: "SCI" } }),
  ]);
  await createHomework(teacher, { sectionId: sec(sps, "Class 6", "A").id, subjectId: maths.id, title: "Fractions worksheet", instructions: "Complete exercise 4.2, questions 1 to 10, in your maths notebook.", dueOn: addDays(today, 2) });
  await createHomework(teacher, { sectionId: sec(sps, "Class 6", "A").id, subjectId: science.id, title: "Plant observation", instructions: "Observe a plant at home for three days and note how it changes. Draw it once.", dueOn: addDays(today, 5) });
  await createHomework(teacher, { sectionId: sec(sps, "Class 6", "B").id, subjectId: maths.id, title: "Fractions worksheet", instructions: "Complete exercise 4.2, questions 1 to 10.", dueOn: addDays(today, 2) });

  // --- Admissions pipeline for next year's intake ---
  console.log("  admissions and notices...");
  const admissions = (await loadActor(users["admissions.sps@demo.eduos.test"]!))!;
  const spsGrades = await prisma.grade.findMany({ where: { schoolId: sps.school.id }, orderBy: { order: "asc" } });
  const enquiries: [string, string, number, string, ("CONTACTED" | "VISIT_SCHEDULED" | "APPLIED" | "OFFERED" | "LOST")[]][] = [
    ["Ira", "Menon", 0, "Walk-in", []],
    ["Dev", "Pillai", 1, "Website", ["CONTACTED"]],
    ["Meera", "Shetty", 0, "Referral", ["CONTACTED", "VISIT_SCHEDULED"]],
    ["Arnav", "Gupta", 2, "Sibling", ["CONTACTED", "VISIT_SCHEDULED", "APPLIED"]],
    ["Sia", "Das", 1, "Phone", ["CONTACTED", "VISIT_SCHEDULED", "APPLIED", "OFFERED"]],
    ["Kabir", "Iyer", 3, "Advertisement", ["CONTACTED", "LOST"]],
  ];
  for (const [i, [first, last, g, source, path]] of enquiries.entries()) {
    const e = await createEnquiry(admissions, {
      schoolId: sps.school.id, gradeId: spsGrades[g]!.id, childFirstName: first, childLastName: last,
      guardianName: `${pick(FATHER)} ${last}`, phone: `98480${String(10000 + i)}`, source, followUpOn: addDays(today, i % 3),
    });
    for (const stage of path) {
      await moveStage(admissions, { enquiryId: e.id, toStage: stage, lostReason: stage === "LOST" ? "Chose a school closer to home" : undefined });
    }
  }

  const principalSps = (await loadActor(users["principal.sps@demo.eduos.test"]!))!;
  await sendAnnouncement(principalSps, {
    schoolId: sps.school.id, audience: "SCHOOL_PARENTS", title: "Parent-teacher meeting on Saturday",
    body: "Dear parents, the term 1 parent-teacher meeting is this Saturday from 9:30 am to 12:30 pm. Please meet your child's class teacher.",
  });

  console.log(`Done. ${allStudents.length} demo students across ${schools.length} schools.`);
  console.log(`Demo password for every account: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
