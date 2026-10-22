import "server-only";
import { prisma } from "@/lib/db";
import type { PermissionKey, Scope } from "@/lib/permissions/catalog";
import type { Actor, Grant } from "@/lib/permissions/evaluate";

/**
 * Builds the authorization context for a user from the database.
 * Rules enforced here:
 * - Suspended users get no grants.
 * - A school-level role assignment only counts while the user has an ACTIVE membership in that school.
 * - Org-level assignments apply to all schools of that organization.
 */
export async function loadActor(userId: string): Promise<Actor | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: { where: { status: "ACTIVE" } },
      roleAssignments: { include: { role: { include: { permissions: true } } } },
      teacherAssignments: { select: { schoolId: true, sectionId: true } },
      guardian: { select: { id: true } },
    },
  });
  if (!user || user.status !== "ACTIVE") return null;

  const memberSchoolIds = new Set(user.memberships.map((m) => m.schoolId));
  const grants: Grant[] = [];
  const roleKeys = new Set<string>();
  const orgWideOrgIds = new Set<string>();

  for (const a of user.roleAssignments) {
    if (a.schoolId && !memberSchoolIds.has(a.schoolId)) continue;
    roleKeys.add(a.role.key);
    const staffRole = a.role.permissions.some((p) => p.scope !== "OWN_FAMILY" && p.scope !== "SELF");
    if (!a.schoolId && staffRole) orgWideOrgIds.add(a.organizationId);
    for (const p of a.role.permissions) {
      grants.push({
        permission: p.permissionKey as PermissionKey,
        scope: p.scope as Scope,
        roleKey: a.role.key,
        organizationId: a.organizationId,
        schoolId: a.schoolId,
      });
    }
  }

  const schools = await prisma.school.findMany({
    where: {
      OR: [
        { id: { in: [...memberSchoolIds] } },
        { organizationId: { in: [...orgWideOrgIds] } },
      ],
    },
    select: { id: true, organizationId: true, name: true, code: true, board: true },
    orderBy: { name: "asc" },
  });

  const assignedSections: Record<string, string[]> = {};
  for (const t of user.teacherAssignments) {
    if (!memberSchoolIds.has(t.schoolId)) continue;
    (assignedSections[t.schoolId] ??= []).push(t.sectionId);
  }

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    grants,
    schools,
    assignedSections,
    guardianId: user.guardian?.id ?? null,
    roleKeys: [...roleKeys],
  };
}

