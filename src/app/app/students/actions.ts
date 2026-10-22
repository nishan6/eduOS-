"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/action";
import { createStudent, enrollStudent, linkGuardian, type CreateStudentInput } from "@/modules/students/service";
import { inviteGuardian } from "@/modules/identity/service";

export async function createStudentAction(input: CreateStudentInput) {
  return runAction(async (actor) => (await createStudent(actor, input)).student.id, "Student created.");
}

export async function linkGuardianAction(input: Parameters<typeof linkGuardian>[1]) {
  const r = await runAction((actor) => linkGuardian(actor, input), "Guardian linked.");
  if (r.ok) revalidatePath(`/app/students/${input.studentId}`);
  return r;
}

export async function enrollStudentAction(input: Parameters<typeof enrollStudent>[1]) {
  const r = await runAction((actor) => enrollStudent(actor, input).then(() => undefined), "Enrollment updated.");
  if (r.ok) revalidatePath(`/app/students/${input.studentId}`);
  return r;
}

export async function inviteGuardianAction(studentId: string, guardianId: string, email: string) {
  const r = await runAction(async (actor) => {
    const res = await inviteGuardian(actor, { guardianId, email });
    return { activationUrl: res.activationUrl, delivered: res.delivered };
  }, "Invitation created.");
  if (r.ok) revalidatePath(`/app/students/${studentId}`);
  return r;
}
