import { chromium, expect } from "@playwright/test";
import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  copyFile,
  access,
} from "node:fs/promises";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const run = process.env.UI_CAPTURE_RUN ?? "ui-modernization";
if (!/^[a-z0-9-]+$/.test(run))
  throw new Error("Invalid capture directory name");
const directory = join(root, ".data", run);
const phase = process.env.UI_CAPTURE_PHASE ?? "before";
if (!["before", "after"].includes(phase))
  throw new Error("Choose before or after capture phase");
const allowed = [
  "src/app/globals.css",
  "src/app/dashboard/loading.tsx",
  "src/app/error.tsx",
  "src/components/dashboard/dashboard.tsx",
  "src/components/dashboard/analytics-page.tsx",
  "src/components/dashboard/controls-page.tsx",
  "src/components/dashboard/settings-page.tsx",
  "src/components/energy-flow.tsx",
  "src/components/charts/power-chart.tsx",
  "src/components/ui/button.tsx",
  "src/components/ui/dialog.tsx",
  "src/components/dashboard/overview.module.css",
  "src/components/dashboard/workspace.module.css",
];
async function files(path: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const item = join(path, entry.name);
    if (entry.isDirectory()) result.push(...(await files(item)));
    else result.push(item);
  }
  return result;
}
async function baseline() {
  await mkdir(directory, { recursive: true });
  const protectedFiles = [
    ...(await files(join(root, "src"))).filter(
      (file) => !allowed.includes(relative(root, file).replaceAll("\\", "/")),
    ),
    ...(await files(join(root, "prisma"))),
    ...(await files(join(root, "workers"))),
    ".env",
    ".env.example",
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "tsconfig.json",
    "scripts/local-db.ts",
    "scripts/setup.ts",
    "scripts/migrate-local-data.ts",
  ];
  const hashes: Record<string, string> = {};
  for (const file of protectedFiles) {
    const key = relative(root, file).replaceAll("\\", "/") || file;
    hashes[key] = createHash("sha256")
      .update(await readFile(file))
      .digest("hex");
  }
  if (phase === "before") {
    await writeFile(
      join(directory, "protected-hashes.json"),
      JSON.stringify(hashes, null, 2),
    );
    for (const file of allowed) {
      // A newly introduced presentation module has no before file to copy.
      if (
        file.endsWith(".module.css") &&
        !(await access(file).then(
          () => true,
          () => false,
        ))
      )
        continue;
      const target = join(directory, "source", file);
      await mkdir(join(target, ".."), { recursive: true });
      await copyFile(file, target);
    }
  } else {
    const old = JSON.parse(
      await readFile(join(directory, "protected-hashes.json"), "utf8"),
    ) as Record<string, string>;
    for (const [file, hash] of Object.entries(old))
      expect(hashes[file], `Protected file changed: ${file}`).toBe(hash);
    console.log(
      `Protected source boundary verified (${Object.keys(old).length} files).`,
    );
  }
}
async function main() {
  await baseline();
  await mkdir(join(directory, phase), { recursive: true });
  const stateFile = join(directory, "session.json");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const hasState = await access(stateFile).then(
    () => true,
    () => false,
  );
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
    storageState: hasState ? stateFile : undefined,
    reducedMotion: "reduce",
    locale: "en-US",
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    if (!hasState) {
      await page.goto("/login");
      await page.getByRole("button", { name: "Explore demo system" }).click();
      await page.waitForURL("**/dashboard", { timeout: 300000 });
      await context.storageState({ path: stateFile });
    }
    await page.goto("/dashboard");
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      /light|dark/,
    );
    if ((await page.locator("html").getAttribute("data-theme")) !== "light") {
      await page.getByRole("button", { name: "Switch to light theme" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    }
    const snapshot = await page.evaluate(async () => {
      const response = await fetch("/api/dashboard");
      return response.json();
    });
    const deviceId = snapshot.selectedId;
    const routes = [
      "overview",
      "live",
      "analytics",
      "energy",
      "battery",
      "grid",
      "inverter",
      "alerts",
      "controls",
      "history",
      "devices",
      "settings",
      "account",
      "integrations",
      "monitor",
    ];
    const widths = [
      { name: "desktop", width: 1440, height: 1000 },
      { name: "laptop", width: 1280, height: 900 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "mobile", width: 390, height: 844 },
    ];
    const checks: Array<{
      route: string;
      viewport: string;
      overflow: boolean;
    }> = [];
    for (const viewport of widths) {
      await page.setViewportSize(viewport);
      for (const route of routes) {
        await page.goto(
          `/dashboard${route === "overview" ? "" : "/" + route}?device=${deviceId}`,
        );
        await expect(page.locator("main h1").first()).toBeVisible();
        if (route === "analytics" || route === "history")
          await expect(
            page.getByRole("heading", {
              name:
                route === "history" ? "History explorer" : "Energy over time",
              exact: true,
            }),
          ).toBeVisible({ timeout: 60000 });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        checks.push({ route, viewport: viewport.name, overflow });
        if (phase === "after")
          expect(overflow, `${route} overflows at ${viewport.width}px`).toBe(
            false,
          );
        await page.screenshot({
          path: join(directory, phase, `${viewport.name}-${route}.png`),
          fullPage: true,
          animations: "disabled",
          caret: "initial",
        });
      }
    }
    await page.setViewportSize(widths[0]);
    await page.goto(`/dashboard?device=${deviceId}`);
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.screenshot({
      path: join(directory, phase, "desktop-overview-dark.png"),
      fullPage: true,
      animations: "disabled",
      caret: "initial",
    });
    await page.goto(`/dashboard/controls?device=${deviceId}`);
    await expect(
      page.getByRole("heading", {
        name: "Maximum charge current",
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: join(directory, phase, "desktop-controls-dark.png"),
      fullPage: true,
      animations: "disabled",
      caret: "initial",
    });
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await writeFile(
      join(directory, `${phase}-checks.json`),
      JSON.stringify({ checks, errors }, null, 2),
    );
    console.log(
      `${phase}: captured ${checks.length + 2} screenshots; browser errors: ${errors.length}; overflow findings: ${checks.filter((c) => c.overflow).length}.`,
    );
    if (errors.length)
      throw new Error(
        `${errors.length} browser errors; see ${phase}-checks.json for details.`,
      );
  } finally {
    await context.close();
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
