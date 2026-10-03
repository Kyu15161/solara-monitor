import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function main() {
  const directory = join(process.cwd(), ".data", "ui-feedback");
  await mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
    storageState: join(process.cwd(), ".data/soft-green/session.json"),
    viewport: { width: 1864, height: 884 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.addInitScript("window.__name = (value) => value");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto("/dashboard");
    await expect(page.locator("main h1")).toHaveText("Energy overview");
    await expect(page.locator(".profile")).toBeVisible();
    if (process.env.UI_FEEDBACK_DIAGNOSE === "1") {
      const geometry = await page.evaluate(() => {
        const dimension = (selector: string) => {
          const e = [...document.querySelectorAll<HTMLElement>(selector)].find(
            (item) => item.getBoundingClientRect().width > 0,
          )!;
          const rect = e.getBoundingClientRect();
          return {
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
            scrollHeight: e.scrollHeight,
            clientHeight: e.clientHeight,
            overflow: getComputedStyle(e).overflowY,
          };
        };
        return {
          viewport: innerHeight,
          documentHeight: document.documentElement.scrollHeight,
          shell: dimension(".app-shell"),
          sidebar: dimension(".sidebar"),
          main: dimension("main"),
          profile: dimension(".profile"),
        };
      });
      await page.locator(".profile").click();
      const accountMenuWorks = await page
        .getByRole("button", { name: "Sign out", exact: true })
        .isVisible();
      console.log(
        JSON.stringify(
          {
            geometry,
            accountMenuWorks,
            workspaceIsInteractive:
              (await page.locator("button.workspace-chip").count()) > 0,
          },
          null,
          2,
        ),
      );
      // The same UI seam goes red before the fix and green afterwards.
      expect(
        accountMenuWorks,
        "Profile should disclose Account, Settings and Sign out",
      ).toBe(true);
      return;
    }
    const device = new URL(
      (await page
        .locator('a.nav-item[aria-label="Battery"]')
        .getAttribute("href")) ?? "",
      "http://localhost",
    ).searchParams.get("device");
    for (const [title, route] of [
      ["Solar production", "energy"],
      ["Home consumption", "live"],
      ["Battery level", "battery"],
      ["Grid power", "grid"],
    ]) {
      const metric = page.locator("a.metric").filter({ hasText: title });
      await expect(metric).toHaveAttribute(
        "href",
        `/dashboard/${route}?device=${device}`,
      );
      await metric.click();
      await expect(page).toHaveURL(new RegExp(`/dashboard/${route}\\?device=`));
      await page.goto("/dashboard");
    }
    await page.getByRole("button", { name: "Choose energy system" }).click();
    await expect(
      page.getByRole("region", { name: "Energy systems" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Energy systems" })
        .getByRole("link", { name: /Manage devices/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("region", { name: "Energy systems" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Choose energy system" }).click();
    await page
      .getByRole("region", { name: "Energy systems" })
      .getByRole("link", { name: /Manage devices/ })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/devices\?device=/);
    await page.goto("/dashboard");
    await page.locator(".profile").click();
    const menu = page.getByRole("region", { name: "Account options" });
    await expect(
      menu.getByRole("link", { name: "Account", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("link", { name: "Settings", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".sidebar-note")).toHaveCount(0);
    await expect(page.locator(".sidebar-bottom > a.nav-item")).toHaveCount(0);
    await menu.getByRole("link", { name: "Settings", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/settings\?device=/);
    await page.locator(".profile").click();
    await page
      .getByRole("region", { name: "Account options" })
      .getByRole("link", { name: "Account", exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/account\?device=/);
    await page.goto("/dashboard");
    for (const viewport of [
      { width: 1864, height: 884 },
      { width: 1280, height: 600 },
      { width: 768, height: 600 },
      { width: 390, height: 844 },
      { width: 320, height: 568 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(page.locator("#main-content")).toBeVisible();
      // Wait for responsive chart measurements after the viewport changes.
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      const layout = await page.evaluate(() => {
        const main = [
          ...document.querySelectorAll<HTMLElement>("#main-content"),
        ].find((e) => e.getBoundingClientRect().width > 0)!;
        const shell = [
          ...document.querySelectorAll<HTMLElement>(".app-shell"),
        ].find((e) => e.getBoundingClientRect().width > 0)!;
        return {
          overflowX: document.documentElement.scrollWidth > innerWidth,
          shellBottom: shell.getBoundingClientRect().bottom,
          mainScroll: main.scrollHeight > main.clientHeight,
          mainOverflow: getComputedStyle(main).overflowY,
        };
      });
      if (layout.overflowX) {
        await page.screenshot({
          path: join(directory, "overflow-320.png"),
          fullPage: true,
        });
        console.log(
          await page.evaluate(() => ({
            width: innerWidth,
            scroll: document.documentElement.scrollWidth,
            elements: [...document.querySelectorAll<HTMLElement>("body *")]
              .filter((e) => {
                const r = e.getBoundingClientRect();
                return r.width > 0 && (r.right > innerWidth || r.left < 0);
              })
              .slice(0, 12)
              .map((e) => ({
                class: e.className,
                text: e.innerText?.slice(0, 40),
                right: e.getBoundingClientRect().right,
                left: e.getBoundingClientRect().left,
              })),
          })),
        );
      }
      expect(layout.overflowX, `Horizontal overflow at ${viewport.width}`).toBe(
        false,
      );
      if (viewport.width > 600) {
        expect(layout.shellBottom).toBeLessThanOrEqual(viewport.height);
        expect(layout.mainScroll).toBe(true);
        expect(layout.mainOverflow).toBe("auto");
        await expect(page.locator(".profile")).toBeInViewport();
        await page.locator("#main-content").evaluate((e) => {
          e.scrollTop = e.scrollHeight;
        });
        await expect(
          page.getByText("Recent alerts", { exact: true }),
        ).toBeInViewport();
      }
      await page.screenshot({
        path: join(directory, `overview-${viewport.width}.png`),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const flowPanel = page.locator(".widget-flow .panel");
    await flowPanel.scrollIntoViewIfNeeded();
    await flowPanel.screenshot({ path: join(directory, "energy-flow.png") });
    expect(errors).toEqual([]);
    const logoutContext = await browser.newContext({
      baseURL: "http://127.0.0.1:3000",
    });
    const logoutPage = await logoutContext.newPage();
    await logoutPage.goto("/login");
    await logoutPage
      .getByRole("button", { name: "Explore demo system" })
      .click();
    await logoutPage.waitForURL("**/dashboard", { timeout: 300000 });
    await logoutPage
      .getByRole("button", { name: "Account", exact: true })
      .click();
    await logoutPage
      .getByRole("region", { name: "Account options" })
      .getByRole("button", { name: "Sign out", exact: true })
      .click();
    await expect(logoutPage).toHaveURL(/\/login$/);
    await logoutPage.goto("/dashboard");
    await expect(logoutPage).toHaveURL(/\/login$/);
    await logoutContext.close();
    await writeFile(
      join(directory, "checks.json"),
      JSON.stringify(
        { errors, navigation: "passed", responsive: "passed" },
        null,
        2,
      ),
    );
    console.log(
      "Sidebar menus, metric navigation and viewport containment passed.",
    );
  } finally {
    await browser.close();
  }
}
void main();
