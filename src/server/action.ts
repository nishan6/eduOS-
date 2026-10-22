import "server-only";
import { toActionError, type ActionResult } from "@/lib/errors";
import type { Actor } from "@/lib/permissions/evaluate";
import { requireActor } from "./actor";

/**
 * Standard server-action wrapper: resolves the actor (redirecting if signed out),
 * runs the service call and converts AppErrors into a serializable ActionResult.
 */
export async function runAction<T>(fn: (actor: Actor) => Promise<T>, message?: string): Promise<ActionResult<T>> {
  const actor = await requireActor();
  try {
    const data = await fn(actor);
    return { ok: true, data, message };
  } catch (err) {
    return toActionError(err);
  }
}
