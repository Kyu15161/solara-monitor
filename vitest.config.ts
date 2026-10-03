import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
export default defineConfig({
  resolve: {
    alias: { "server-only": resolve(process.cwd(), "tests/server-only.ts") },
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
