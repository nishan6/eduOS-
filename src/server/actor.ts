import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import type { Actor } from "@/lib/permissions/evaluate";
import { loadActor } from "./load-actor";

export { loadActor };

/** Actor for the current request. Redirects to /login when signed out. */
export const requireActor = cache(async (): Promise<Actor> => {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  if (!actor) redirect("/login?error=inactive");
  return actor;
});
