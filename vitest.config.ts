import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: { alias: { "server-only": path.resolve(__dirname, "tests/support/empty.ts") } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    // Integration tests share one seeded database and run sequentially.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 180000,
  },
});
