/**
 * E2E runner: fresh database -> production server on :3100 -> Playwright -> cleanup.
 * Requires `npm run build` first.
 */
import { spawn, spawnSync } from "node:child_process";
import { createTestDatabase } from "../support/db";

async function waitFor(url: string, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if ((await fetch(url, { redirect: "manual" })).status < 500) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not start at ${url}`);
}

async function main() {
  try { process.loadEnvFile(".env"); } catch {}
  const port = process.env.E2E_PORT ?? "3100";
  const baseUrl = `http://localhost:${port}`;
  const db = await createTestDatabase();
  const env = { ...process.env, DATABASE_URL: db.url, EDUOS_ENV: "test", BETTER_AUTH_URL: baseUrl, EDUOS_SIGNIN_RATE_MAX: "1000", PORT: port };
  const server = spawn("node_modules/.bin/next", ["start", "-p", port], { env, stdio: ["ignore", "inherit", "inherit"] });
  let code = 1;
  try {
    await waitFor(`${baseUrl}/login`);
    const r = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], { env: { ...env, E2E_BASE_URL: baseUrl }, stdio: "inherit" });
    code = r.status ?? 1;
  } finally {
    server.kill("SIGTERM");
    await db.drop();
  }
  process.exit(code);
}

main().catch((e) => { console.error(e); process.exit(1); });
