import "server-only";
import type { Tx } from "@/lib/db";
import { PERMISSIONS, ROLE_TEMPLATES, type PermissionKey } from "@/lib/permissions/catalog";

/** Upserts the permission catalog. Safe to run repeatedly. */
export async function syncPermissionCatalog(tx: Tx) {
  for (const [key, p] of Object.entries(PERMISSIONS)) {
    await tx.permission.upsert({ where: { key }, create: { key, module: p.module, description: p.description }, update: { module: p.module, description: p.description } });
  }
}

/**
 * Copies EduOS role templates into an organization. System roles are re-synced to the template;
 * custom roles created by the organization are never touched.
 */
export async function syncRoleTemplates(tx: Tx, organizationId: string) {
  for (const t of ROLE_TEMPLATES) {
    const role = await tx.role.upsert({
      where: { organizationId_key: { organizationId, key: t.key } },
      create: { organizationId, key: t.key, name: t.name, description: t.description, isSystem: true },
      update: { name: t.name, description: t.description },
    });
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    await tx.rolePermission.createMany({
      data: Object.entries(t.permissions).map(([permissionKey, scope]) => ({ roleId: role.id, permissionKey: permissionKey as PermissionKey, scope: scope! })),
    });
  }
}
