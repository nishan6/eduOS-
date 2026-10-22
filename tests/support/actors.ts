import { prisma } from "@/lib/db";
import { loadActor } from "@/server/load-actor";

export async function actor(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const a = await loadActor(user.id);
  if (!a) throw new Error(`No actor for ${email}`);
  return a;
}

export async function school(code: string) {
  return prisma.school.findFirstOrThrow({ where: { code } });
}

export async function section(schoolCode: string, grade: string, name: string) {
  return prisma.section.findFirstOrThrow({ where: { name, grade: { name: grade }, school: { code: schoolCode }, academicYear: { isCurrent: true } } });
}

export async function parentChild(email: string, schoolCode: string) {
  const g = await prisma.guardian.findFirstOrThrow({ where: { user: { email } } });
  const link = await prisma.studentGuardianRelationship.findFirstOrThrow({ where: { guardianId: g.id, student: { school: { code: schoolCode } } }, include: { student: true } });
  return link.student;
}

export const T = {
  owner: "owner@demo.eduos.test",
  groupAdmin: "groupadmin@demo.eduos.test",
  principalSps: "principal.sps@demo.eduos.test",
  principalSvl: "principal.svl@demo.eduos.test",
  teacherSps: "teacher.sps@demo.eduos.test",
  teacher2Sps: "teacher2.sps@demo.eduos.test",
  teacherSvl: "teacher.svl@demo.eduos.test",
  accountsSps: "accounts.sps@demo.eduos.test",
  cashierSps: "cashier.sps@demo.eduos.test",
  cashierSvl: "cashier.svl@demo.eduos.test",
  admissionsSps: "admissions.sps@demo.eduos.test",
  parent: "parent@demo.eduos.test",
  parent2: "parent2@demo.eduos.test",
};
