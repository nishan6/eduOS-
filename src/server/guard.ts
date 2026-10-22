import "server-only";
import { forbidden } from "@/lib/errors";
import type { PermissionKey } from "@/lib/permissions/catalog";
import { can, type Actor, type ResourceScope } from "@/lib/permissions/evaluate";

/** Throws FORBIDDEN unless the actor holds the permission for the resource. */
export function assertCan(actor: Actor, permission: PermissionKey, resource: ResourceScope, message?: string) {
  if (!can(actor, permission, resource)) throw forbidden(message);
}
