import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Test databases are never reset in place. Each run creates a brand-new database
 * (<TEST_DATABASE_URL name>_<timestamp>), applies migrations, seeds it, and drops only
 * that database afterwards. Existing databases are never touched.
 */
function adminUrl(url: URL) {
  const u = new URL(url);
  u.pathname = "/postgres";
  return u.toString();
}

export async function createTestDatabase(): Promise<{ url: string; drop: () => Promise<void> }> {
  const base = process.env.TEST_DATABASE_URL;
  if (!base) throw new Error("TEST_DATABASE_URL is not set (see .env.example).");
  const baseUrl = new URL(base);
  const baseName = baseUrl.pathname.slice(1);
  if (!baseName.endsWith("_test")) throw new Error(`TEST_DATABASE_URL must name a database ending in _test (got "${baseName}").`);
  const name = `${baseName}_${Date.now()}`;
  const runUrl = new URL(baseUrl);
  runUrl.pathname = `/${name}`;

  const admin = new PrismaClient({ datasourceUrl: adminUrl(baseUrl) });
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  await admin.$disconnect();

  const env = { ...process.env, DATABASE_URL: runUrl.toString(), EDUOS_ENV: "test" };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx tsx --conditions=react-server prisma/seed.ts", { env, stdio: "pipe" });

  return {
    url: runUrl.toString(),
    async drop() {
      if (process.env.KEEP_TEST_DB) return;
      const a = new PrismaClient({ datasourceUrl: adminUrl(baseUrl) });
      // Only ever drops the database this run created.
      await a.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await a.$disconnect();
    },
  };
}
