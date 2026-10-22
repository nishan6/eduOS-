import "server-only";
import { cookies } from "next/headers";
import type { Actor, ActorSchool } from "@/lib/permissions/evaluate";

export const ACTIVE_SCHOOL_COOKIE = "eduos_school";

/**
 * Resolves the school the staff user is working in. The cookie is only a preference:
 * it is honoured only if the actor is authorized for that school, otherwise we fall back.
 */
export async function getActiveSchool(actor: Actor): Promise<ActorSchool | null> {
  const preferred = (await cookies()).get(ACTIVE_SCHOOL_COOKIE)?.value;
  return actor.schools.find((s) => s.id === preferred) ?? actor.schools[0] ?? null;
}
