import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 360000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3000", channel: "chrome", headless: true },
  reporter: "list",
});
