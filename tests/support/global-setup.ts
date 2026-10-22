import { createTestDatabase } from "./db";

export default async function setup() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // CI provides variables directly.
  }
  const unitOnly = process.argv.some((a) => a.includes("tests/unit")) && !process.argv.some((a) => a.includes("integration"));
  if (unitOnly) return;
  const db = await createTestDatabase();
  // Workers inherit this environment.
  process.env.DATABASE_URL = db.url;
  process.env.EDUOS_ENV = "test";
  return () => db.drop();
}
