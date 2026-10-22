import type { PermissionKey, Scope } from "./catalog";

/**
 * Pure permission evaluation. No database access here so it can be unit tested exhaustively.
 * The Actor is built once per request by src/server/actor.ts.
 */

export type Grant = {
  permission: PermissionKey;
  scope: Scope;
  roleKey: string;
  organizationId: string;
  /** null = granted organization-wide */
  schoolId: string | null;
};

export type ActorSchool = { id: string; organizationId: string; name: string; code: string; board: string };

export type Actor = {
  userId: string;
  name: string;
  email: string;
  grants: Grant[];
  /** Schools this actor may enter as staff (membership or org-wide role). */
  schools: ActorSchool[];
  /** schoolId -> section ids the actor is assigned to teach */
  assignedSections: Record<string, string[]>;
  /** Guardian record linked to this login, if any. */
  guardianId: string | null;
  roleKeys: string[];
};

export type ResourceScope = { schoolId: string; sectionId?: string | null };

function schoolOf(actor: Actor, schoolId: string) {
  return actor.schools.find((s) => s.id === schoolId);
}

/** All scopes under which the actor holds `permission` for the given school. */
export function scopesFor(actor: Actor, permission: PermissionKey, schoolId: string): Scope[] {
  const school = schoolOf(actor, schoolId);
  if (!school) return [];
  const scopes = new Set<Scope>();
  for (const g of actor.grants) {
    if (g.permission !== permission) continue;
    if (g.organizationId !== school.organizationId) continue;
    // An org-level assignment applies to every school; a school-level one only to its school.
    if (g.schoolId !== null && g.schoolId !== schoolId) continue;
    scopes.add(g.scope);
  }
  return [...scopes];
}

/** True when the actor can act on the whole school (not just assigned sections). */
export function canSchoolWide(actor: Actor, permission: PermissionKey, schoolId: string): boolean {
  const scopes = scopesFor(actor, permission, schoolId);
  return scopes.includes("ORGANIZATION") || scopes.includes("SCHOOL");
}

export function can(actor: Actor, permission: PermissionKey, resource: ResourceScope): boolean {
  const scopes = scopesFor(actor, permission, resource.schoolId);
  if (scopes.includes("ORGANIZATION") || scopes.includes("SCHOOL")) return true;
  if (scopes.includes("ASSIGNED") && resource.sectionId) {
    return (actor.assignedSections[resource.schoolId] ?? []).includes(resource.sectionId);
  }
  return false;
}

/**
 * Which sections the actor may see for a permission in a school:
 * "all" for school-wide access, a list for assigned access, or [] for none.
 */
export function sectionFilter(actor: Actor, permission: PermissionKey, schoolId: string): "all" | string[] {
  const scopes = scopesFor(actor, permission, schoolId);
  if (scopes.includes("ORGANIZATION") || scopes.includes("SCHOOL")) return "all";
  if (scopes.includes("ASSIGNED")) return actor.assignedSections[schoolId] ?? [];
  return [];
}

/** Family-scoped permission (parents). Which students is a separate, data-level check. */
export function hasFamilyPermission(actor: Actor, permission: PermissionKey): boolean {
  return actor.guardianId !== null && actor.grants.some((g) => g.permission === permission && g.scope === "OWN_FAMILY");
}

/** Organization-wide permission, e.g. for the owner's cross-school dashboard. */
export function canInOrganization(actor: Actor, permission: PermissionKey, organizationId: string): boolean {
  return actor.grants.some(
    (g) => g.permission === permission && g.organizationId === organizationId && g.schoolId === null && g.scope === "ORGANIZATION",
  );
}

/** Has the permission in at least one school (used to decide navigation entries). */
export function hasAnywhere(actor: Actor, permission: PermissionKey, schoolId?: string): boolean {
  if (schoolId) return scopesFor(actor, permission, schoolId).some((s) => s !== "OWN_FAMILY" && s !== "SELF");
  return actor.grants.some((g) => g.permission === permission && g.scope !== "OWN_FAMILY" && g.scope !== "SELF");
}
