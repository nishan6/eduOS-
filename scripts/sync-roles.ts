/**
 * Re-syncs the permission catalog and the system role templates into every organization.
 * Run after deploying a release that adds permissions: `npm run db:sync-roles`.
 * Idempotent. Custom roles created by organizations are never touched.
 */
import { PrismaClient } from "@prisma/client";
import { syncPermissionCatalog, syncRoleTemplates } from "@/modules/identity/roles";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction((tx) => syncPermissionCatalog(tx));
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  for (const org of orgs) {
    await prisma.$transaction((tx) => syncRoleTemplates(tx, org.id), { timeout: 60000 });
    console.log(`Synced system roles for ${org.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
