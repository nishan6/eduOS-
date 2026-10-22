import "server-only";
import { prisma } from "@/lib/db";
import type { PermissionKey } from "@/lib/permissions/catalog";
import { hasFamilyPermission, type Actor } from "@/lib/permissions/evaluate";

/**
 * True only when the actor holds the family-scoped permission AND an explicit
 * StudentGuardianRelationship links their guardian record to the student.
 */
export async function isLinkedGuardian(actor: Actor, studentId: string, permission: PermissionKey): Promise<boolean> {
  if (!hasFamilyPermission(actor, permission) || !actor.guardianId) return false;
  const link = await prisma.studentGuardianRelationship.findUnique({
    where: { studentId_guardianId: { studentId, guardianId: actor.guardianId } },
    select: { canViewFees: true },
  });
  if (!link) return false;
  if (permission === "fees.read") return link.canViewFees;
  return true;
}
