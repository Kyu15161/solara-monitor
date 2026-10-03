import { chromium, expect } from "@playwright/test";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";

async function main() {
  const run = process.env.UI_CAPTURE_RUN ?? "ui-modernization";
  if (!/^[a-z0-9-]+$/.test(run))
    throw new Error("Invalid capture directory name");
  const directory = join(process.cwd(), ".data", run);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
    storageState: join(directory, "session.json"),
    locale: "en-US",
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 1000 },
  });
  // tsx preserves nested function names with this helper; browser evaluation
  // runs outside its module scope. Supply it only in this test context.
  await context.addInitScript("globalThis.__name = (fn) => fn;");
  const page = await context.newPage();
  const contrast: Array<{ theme: string; route: string; minimum: number }> = [];
  try {
    for (const theme of ["light", "dark"]) {
      await page.goto("/dashboard");
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        /light|dark/,
      );
      if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
        await page
          .getByRole("button", { name: `Switch to ${theme} theme` })
          .click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      }
      for (const route of ["", "/alerts", "/settings", "/controls"]) {
        await page.goto(`/dashboard${route}`);
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const ratios = await page.evaluate(() => {
          const rgb = (value: string) =>
            (value.match(/[\d.]+/g) ?? []).slice(0, 4).map(Number);
          // Resolve translucent surfaces over their real ancestor backgrounds.
          const composite = (front: number[], back: number[]) => {
            const alpha = front[3] ?? 1;
            return front
              .slice(0, 3)
              .map(
                (value, index) =>
                  value * alpha + (back[index] ?? 255) * (1 - alpha),
              );
          };
          const luminance = (values: number[]) =>
            values
              .map((value) => {
                const v = value / 255;
                return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
              })
              .reduce(
                (sum, value, index) =>
                  sum + value * [0.2126, 0.7152, 0.0722][index],
                0,
              );
          const selector =
            ".metric-top, .metric p, .panel-heading p, .status-badge, .small-badge, .demo-pill, .alert-list small, .control-footer small, .button-primary, .button-danger, .nav-item, .flow-node small, .chart-caption";
          return [...document.querySelectorAll<HTMLElement>(selector)]
            .filter(
              (element) =>
                element.getBoundingClientRect().width > 0 &&
                !element.matches(":disabled"),
            )
            .map((element) => {
              const style = getComputedStyle(element);
              const layers: number[][] = [];
              for (
                let surface: Element | null = element;
                surface;
                surface = surface.parentElement
              )
                layers.push(rgb(getComputedStyle(surface).backgroundColor));
              const backdrop = layers
                .reverse()
                .reduce(
                  (back, front) => composite(front, back),
                  [255, 255, 255],
                );
              const foreground = luminance(
                composite(rgb(style.color), backdrop),
              );
              const behind = luminance(backdrop);
              return {
                text: element.textContent?.trim().slice(0, 50),
                ratio:
                  (Math.max(foreground, behind) + 0.05) /
                  (Math.min(foreground, behind) + 0.05),
              };
            });
        });
        for (const result of ratios)
          expect(
            result.ratio,
            `${theme} ${route} contrast: ${result.text}`,
          ).toBeGreaterThanOrEqual(4.5);
        contrast.push({
          theme,
          route: route || "/",
          minimum: Math.min(...ratios.map((result) => result.ratio)),
        });
      }
    }
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(page.locator("main h1")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
    const focus = await page
      .getByRole("link", { name: "Skip to content" })
      .evaluate((element) => ({
        style: getComputedStyle(element).outlineStyle,
        width: getComputedStyle(element).outlineWidth,
      }));
    expect(focus.style).not.toBe("none");
    expect(parseFloat(focus.width)).toBeGreaterThanOrEqual(2);
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(
      page.getByRole("link", { name: "Overview", exact: true }),
    ).toBeVisible();
    const profile = page.locator("aside button.profile");
    await expect(profile).toBeVisible();
    await profile.focus();
    await page.keyboard.press("Enter");
    const accountMenu = page.getByRole("region", { name: "Account options" });
    await expect(
      accountMenu.getByRole("link", { name: "Account", exact: true }),
    ).toBeVisible();
    await expect(
      accountMenu.getByRole("link", { name: "Settings", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(accountMenu).toHaveCount(0);
    await expect(profile).toBeFocused();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open navigation" }).focus();
    await page.keyboard.press("Enter");
    const navigation = page.getByRole("navigation", {
      name: "Main navigation",
    });
    await expect(navigation).toBeVisible();
    await navigation
      .getByRole("link", { name: "Controls", exact: true })
      .click();
    await expect(page).toHaveURL(/dashboard\/controls/);
    await expect(navigation).not.toBeVisible();
    const card = page.locator("section").filter({
      has: page.getByRole("heading", {
        name: "Maximum charge current",
        exact: true,
      }),
    });
    await card.getByRole("spinbutton").fill("45");
    await card.getByRole("button", { name: "Review change" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Confirm & apply" }),
    ).toBeVisible();
    await page.screenshot({
      path: join(directory, "after/mobile-confirmation.png"),
      fullPage: true,
      animations: "disabled",
      caret: "initial",
    });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    // The existing controlled Radix dialog has no Trigger. Record its existing
    // focus-return limitation without adding a behavior-changing close handler.
    const dialogFocusReturned = await card
      .getByRole("button", { name: "Review change" })
      .evaluate((element) => element === document.activeElement);
    await writeFile(
      join(directory, "accessibility-checks.json"),
      JSON.stringify(
        {
          contrast,
          focus,
          keyboard:
            "Skip link, rail labels, drawer navigation and dialog Escape passed",
          dialogFocusReturned,
          knownLimitation:
            "Existing controlled dialog does not restore focus to Review change; dialog code is unchanged.",
        },
        null,
        2,
      ),
    );
    console.log(
      "Presentation QA passed: sampled text contrast in both themes, visible keyboard focus, rail labels, mobile navigation, and dialog Escape. Existing dialog focus-return limitation recorded.",
    );
  } finally {
    await context.close();
    await browser.close();
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
