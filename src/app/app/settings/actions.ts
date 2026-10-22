"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/action";
import { addClassWithSections, assignTeacher, createSchool } from "@/modules/org/service";
import { inviteStaff, setMembershipStatus } from "@/modules/identity/service";

type In<F extends (...a: never[]) => unknown> = Parameters<F>[1];

export async function createSchoolAction(input: In<typeof createSchool>) {
  const r = await runAction(async (actor) => (await createSchool(actor, input)).id, "School created.");
  if (r.ok) revalidatePath("/app", "layout");
  return r;
}
export async function addClassAction(input: In<typeof addClassWithSections>) {
  const r = await runAction((actor) => addClassWithSections(actor, input).then(() => undefined), "Class saved.");
  if (r.ok) revalidatePath("/app/settings/school");
  return r;
}
export async function assignTeacherAction(input: In<typeof assignTeacher>) {
  const r = await runAction((actor) => assignTeacher(actor, input).then(() => undefined), "Teacher assigned.");
  if (r.ok) revalidatePath("/app/settings/school");
  return r;
}
export async function inviteStaffAction(input: In<typeof inviteStaff>) {
  const r = await runAction(async (actor) => {
    const res = await inviteStaff(actor, input);
    return { activationUrl: res.activationUrl, delivered: res.delivered };
  }, "Invitation created.");
  if (r.ok) revalidatePath("/app/settings/users");
  return r;
}
export async function setMembershipAction(schoolId: string, userId: string, status: "ACTIVE" | "SUSPENDED") {
  const r = await runAction((actor) => setMembershipStatus(actor, schoolId, userId, status));
  if (r.ok) revalidatePath("/app/settings/users");
  return r;
}
