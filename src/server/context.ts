import "server-only";
import { notFound, redirect } from "next/navigation";
import type { PermissionKey } from "@/lib/permissions/catalog";
import { canSchoolWide, hasAnywhere, type Actor, type ActorSchool } from "@/lib/permissions/evaluate";
import { getActiveSchool } from "@/lib/tenant/active-school";
import { requireActor } from "./actor";

/** For staff pages: the actor, their active school, and a page-level permission gate. */
export async function requireSchoolPage(permission: PermissionKey, mode: "school-wide" | "any" = "school-wide"): Promise<{ actor: Actor; school: ActorSchool }> {
  const actor = await requireActor();
  const school = await getActiveSchool(actor);
  if (!school) redirect("/app/no-access");
  const ok = mode === "school-wide" ? canSchoolWide(actor, permission, school.id) : hasAnywhere(actor, permission, school.id);
  // 404 rather than 403 so restricted areas are not advertised.
  if (!ok) notFound();
  return { actor, school };
}
