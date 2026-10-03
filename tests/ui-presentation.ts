import { chromium, expect, type Page } from "@playwright/test";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";

async function hoverChart(page: Page) {
  await expect(page.locator(".chart").first()).toBeVisible();
  const box = await page.locator(".chart").first().boundingBox();
  if (!box) throw new Error("Chart is not visible");
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.35);
  await expect(page.locator(".telemetry-tooltip")).toBeVisible();
}

async function main() {
  const run = process.env.UI_CAPTURE_RUN ?? "energy-console";
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
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto("/dashboard/live");
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      /light|dark/,
    );
    if ((await page.locator("html").getAttribute("data-theme")) !== "dark")
      await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await hoverChart(page);
    await expect(page.locator(".telemetry-tooltip")).toContainText(
      /\d+\.\d{2} kW/,
    );
    await expect(page.locator(".tooltip-reading")).toHaveCount(4);
    await page.screenshot({
      path: join(directory, "after/desktop-power-tooltip.png"),
      fullPage: true,
      animations: "disabled",
      caret: "initial",
    });
    await page.goto("/dashboard/battery");
    await hoverChart(page);
    await expect(page.locator(".telemetry-tooltip")).toContainText(
      /\d+\.\d{2} %/,
    );
    await page.goto("/dashboard/analytics");
    await expect(
      page.getByRole("heading", { name: "Energy over time", exact: true }),
    ).toBeVisible();
    await hoverChart(page);
    await expect(page.locator(".telemetry-tooltip")).toContainText(
      /\d+\.\d{2} kWh/,
    );
    await expect(page.locator(".tooltip-reading")).toHaveCount(2);
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Today", exact: true }),
    ).toHaveClass("selected");
    await page.setViewportSize({ width: 390, height: 844 });
    const shortValue = await page
      .locator(".metric strong")
      .first()
      .textContent();
    await page.getByRole("button", { name: "All time", exact: true }).click();
    await expect(page.locator(".metric strong").first()).not.toHaveText(
      shortValue ?? "",
    );
    expect(
      await page
        .locator(".metric strong")
        .evaluateAll((elements) =>
          elements.every(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
        ),
    ).toBe(true);
    await page.screenshot({
      path: join(directory, "after/mobile-analytics-all-time.png"),
      fullPage: true,
      animations: "disabled",
      caret: "initial",
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/dashboard/alerts");
    await page.getByRole("button", { name: "Resolved", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Resolved", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".alert-list article").first()).toContainText(
      "RESOLVED",
    );
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("textbox", { name: "Search alerts" }).fill("battery");
    await expect(page.locator(".alert-list article")).toHaveCount(1);
    await page
      .getByRole("textbox", { name: "Search alerts" })
      .fill("no-matching-event-000");
    await expect(
      page.getByText("No alerts match these filters.", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: join(directory, "after/desktop-alerts-empty.png"),
      fullPage: true,
      animations: "disabled",
      caret: "initial",
    });

    // Delay an actual analytics request only in the test browser. The original
    // request and response are passed through unchanged after the loading capture.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/devices/*/analytics?*", async (route) => {
      await held;
      await route.continue();
    });
    await page.goto("/dashboard/history");
    await expect(
      page.getByLabel("Loading historical data", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: join(directory, "after/desktop-history-loading.png"),
      fullPage: true,
      animations: "disabled",
      caret: "initial",
    });
    release();
    await page.unrouteAll({ behavior: "wait" });
    await expect(
      page.getByRole("heading", { name: "History explorer", exact: true }),
    ).toBeVisible();
    await page.getByLabel("From", { exact: true }).fill("2000-01-01");
    await page.getByLabel("To", { exact: true }).fill("2000-01-02");
    await expect(
      page.getByText("No readings in this interval.", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: join(directory, "after/desktop-history-empty.png"),
      fullPage: true,
      animations: "disabled",
      caret: "initial",
    });
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    // Exercise actual saved layout controls on the private screenshot fixture.
    // Adjacency-based presentation must also work with instruments removed.
    await page.goto("/dashboard/settings");
    await expect(page.locator(".widget-order > div")).toHaveCount(5);
    try {
      await page.getByRole("checkbox", { name: "Health", exact: true }).click();
      await expect(page.locator(".widget-order > div")).toHaveCount(4);
      await page.goto("/dashboard");
      await expect(page.locator(".widget-flow")).toBeVisible();
      await expect(page.locator(".widget-health")).toHaveCount(0);
      const standaloneFlow = await page.locator(".widget-flow").boundingBox();
      expect(standaloneFlow?.width).toBeGreaterThan(1000);
      await page.screenshot({
        path: join(directory, "after/desktop-flow-without-health.png"),
        fullPage: true,
        animations: "disabled",
        caret: "initial",
      });
      await page.goto("/dashboard/settings");
      await page.getByRole("button", { name: "Move metrics down" }).click();
      await expect(page.locator(".widget-order > div").first()).toContainText(
        "1. flow",
      );
      await page.goto("/dashboard");
      await expect(page.locator(".widget-flow")).toBeVisible();
      await expect(page.locator(".widget-metrics")).toBeVisible();
      const firstFlow = await page.locator(".widget-flow").boundingBox();
      const movedMetrics = await page.locator(".widget-metrics").boundingBox();
      expect(firstFlow!.y).toBeLessThan(movedMetrics!.y);
      await page.goto("/dashboard/settings");
      await page
        .getByRole("button", { name: "Reset layout", exact: true })
        .click();
      await expect(page.locator(".widget-order > div")).toHaveCount(5);
      await page.getByRole("checkbox", { name: "Flow", exact: true }).click();
      await expect(page.locator(".widget-order > div")).toHaveCount(4);
      await page.goto("/dashboard");
      await expect(page.locator(".widget-health")).toBeVisible();
      await expect(page.locator(".widget-flow")).toHaveCount(0);
      const standaloneHealth = await page
        .locator(".widget-health")
        .boundingBox();
      expect(standaloneHealth?.width).toBeGreaterThan(1000);
      await page.screenshot({
        path: join(directory, "after/desktop-health-without-flow.png"),
        fullPage: true,
        animations: "disabled",
        caret: "initial",
      });
    } finally {
      await page.goto("/dashboard/settings");
      await page
        .getByRole("button", { name: "Reset layout", exact: true })
        .click();
      await expect(page.locator(".widget-order > div")).toHaveCount(5);
    }
    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/dashboard");
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator(".widget-alerts")).toBeVisible();
      const mobileEvents = await page.locator(".widget-alerts").boundingBox();
      const mobileChart = await page.locator(".widget-chart").boundingBox();
      expect(mobileEvents!.y).toBeLessThan(mobileChart!.y);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      for (const value of await page.locator(".metric strong").all())
        expect(
          await value.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
        ).toBe(true);
      await page.screenshot({
        path: join(directory, `after/mobile-overview-${width}.png`),
        fullPage: true,
        animations: "disabled",
        caret: "initial",
      });
    }
    expect(errors).toEqual([]);
    await context.close();
    const anonymous = await browser.newContext({
      baseURL: "http://127.0.0.1:3000",
      locale: "en-US",
      reducedMotion: "reduce",
      viewport: { width: 1440, height: 1000 },
    });
    const login = await anonymous.newPage();
    for (const route of ["login", "signup", "forgot-password"]) {
      await login.goto(`/${route}`);
      await expect(login.locator("form h2")).toBeVisible();
      await login.screenshot({
        path: join(directory, `after/desktop-${route}.png`),
        fullPage: true,
        animations: "disabled",
        caret: "initial",
      });
    }
    await login.setViewportSize({ width: 390, height: 844 });
    await login.goto("/login");
    await expect(
      login.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    expect(
      await login.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await login.screenshot({
      path: join(directory, "after/mobile-login.png"),
      fullPage: true,
      animations: "disabled",
      caret: "initial",
    });
    await anonymous.close();
    await writeFile(
      join(directory, "presentation-checks.json"),
      JSON.stringify(
        {
          tooltipUnits: ["kW", "%", "kWh"],
          alertFilters: "passed",
          dateFilters: "passed",
          loading: "passed",
          empty: "passed",
          authenticationLayouts: "passed",
          savedWidgetLayouts: "passed",
          narrowMobileWidths: [320, 360, 390],
          errors,
        },
        null,
        2,
      ),
    );
    console.log(
      "Presentation interactions passed: power/SOC/energy tooltips, date and alert filters, loading/empty states, and authentication layouts.",
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
