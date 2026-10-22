"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/actor";
import { ACTIVE_SCHOOL_COOKIE } from "@/lib/tenant/active-school";
import { prisma } from "@/lib/db";

/** Switches the working school. Rejects schools the actor is not authorized for. */
export async function switchSchoolAction(schoolId: string) {
  const actor = await requireActor();
  if (!actor.schools.some((s) => s.id === schoolId)) return { ok: false as const, message: "You do not have access to that school." };
  (await cookies()).set(ACTIVE_SCHOOL_COOKIE, schoolId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  revalidatePath("/app", "layout");
  return { ok: true as const };
}

export async function markNotificationsReadAction() {
  const actor = await requireActor();
  await prisma.notification.updateMany({ where: { userId: actor.userId, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/app", "layout");
}
