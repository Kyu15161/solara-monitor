import { chromium, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function chartPosition(page: Page) {
  return Number(
    await page
      .getByRole("scrollbar", { name: "Scroll chart time" })
      .getAttribute("aria-valuenow"),
  );
}

async function verticalScrollPosition(page: Page) {
  return page.evaluate(() =>
    [
      document.scrollingElement,
      ...document.querySelectorAll(".app-shell, .app-content, .main-content"),
    ].reduce((total, element) => total + (element?.scrollTop ?? 0), 0),
  );
}

async function main() {
  const run = process.env.UI_CAPTURE_RUN ?? "soft-green";
  if (!/^[a-z0-9-]+$/.test(run))
    throw new Error("Invalid capture directory name");
  const directory = join(process.cwd(), ".data", run);
  await mkdir(join(directory, "after"), { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
    // Reuse the private QA account. This file is never printed or exported.
    storageState: join(process.cwd(), ".data/soft-green/session.json"),
    locale: "en-US",
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 884 },
  });
  await context.addInitScript("globalThis.__name = (fn) => fn;");
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto("/dashboard/analytics");
    await expect(
      page.getByRole("heading", { name: "Energy over time", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".chart .recharts-area-curve")).toHaveCount(2);
    await expect(page.locator(".chart .recharts-bar-rectangle")).toHaveCount(0);
    await page.locator(".chart").scrollIntoViewIfNeeded();
    const analyticsChart = await page.locator(".chart").boundingBox();
    if (!analyticsChart) throw new Error("Analytics graph is not visible");
    await page.mouse.move(
      analyticsChart.x + analyticsChart.width * 0.65,
      analyticsChart.y + analyticsChart.height * 0.35,
    );
    await expect(page.locator(".telemetry-tooltip")).toBeVisible();
    await expect(page.locator(".telemetry-tooltip")).toContainText(
      /\d+\.\d{2} kWh/,
    );
    await expect(page.locator(".tooltip-reading")).toHaveCount(2);
    await page.screenshot({
      path: join(directory, "after/analytics-line-graph.png"),
      fullPage: true,
      animations: "disabled",
    });

    await page.goto("/dashboard/energy");
    const timeline = page.getByRole("scrollbar", { name: "Scroll chart time" });
    await expect(timeline).toBeVisible();
    const maximum = Number(await timeline.getAttribute("aria-valuemax"));
    expect(maximum).toBeGreaterThan(24);
    await expect(timeline).toHaveAttribute("aria-valuenow", String(maximum));

    await page
      .getByRole("button", { name: "Earlier readings", exact: true })
      .click();
    await expect.poll(() => chartPosition(page)).toBeLessThan(maximum);
    await page
      .getByRole("button", { name: "Later readings", exact: true })
      .click();
    await expect.poll(() => chartPosition(page)).toBe(maximum);

    await timeline.press("Home");
    await expect(timeline).toHaveAttribute("aria-valuenow", "0");
    await timeline.press("ArrowRight");
    await expect(timeline).toHaveAttribute("aria-valuenow", "1");
    await timeline.press("ArrowLeft");
    await expect(timeline).toHaveAttribute("aria-valuenow", "0");
    await timeline.press("PageDown");
    await expect.poll(() => chartPosition(page)).toBe(Math.min(48, maximum));
    await timeline.press("PageUp");
    await expect(timeline).toHaveAttribute("aria-valuenow", "0");
    await timeline.press("End");
    await expect.poll(() => chartPosition(page)).toBe(maximum);

    // A native scroll changes the graph's selected time, rather than fetching
    // or fabricating any new measurements.
    await timeline.evaluate((element) => {
      element.scrollLeft = 0;
    });
    await expect(timeline).toHaveAttribute("aria-valuenow", "0");
    const oldestRange = await timeline.getAttribute("aria-valuetext");
    await page.getByRole("button", { name: "Latest", exact: true }).click();
    await expect.poll(() => chartPosition(page)).toBe(maximum);
    await expect(timeline).not.toHaveAttribute(
      "aria-valuetext",
      oldestRange ?? "",
    );

    await page
      .getByRole("button", { name: "All readings", exact: true })
      .click();
    await expect(timeline).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Time window", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Latest", exact: true }).click();
    await expect(timeline).toBeVisible();
    await expect.poll(() => chartPosition(page)).toBe(maximum);

    const plot = page.locator(".chart");
    await timeline.press("Home");
    await plot.scrollIntoViewIfNeeded();
    const box = await plot.boundingBox();
    if (!box) throw new Error("Power graph is not visible");
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
    await page.mouse.wheel(260, 0);
    await expect.poll(() => chartPosition(page)).toBeGreaterThan(0);
    await timeline.press("Home");
    await plot.scrollIntoViewIfNeeded();
    const shiftBox = await plot.boundingBox();
    if (!shiftBox) throw new Error("Power graph is not visible");
    await page.mouse.move(
      shiftBox.x + shiftBox.width * 0.5,
      shiftBox.y + shiftBox.height * 0.4,
    );
    await page.keyboard.down("Shift");
    try {
      await page.mouse.wheel(0, 260);
    } finally {
      await page.keyboard.up("Shift");
    }
    await expect.poll(() => chartPosition(page)).toBeGreaterThan(0);

    const selectedBeforeVerticalScroll = await chartPosition(page);
    const scrollBefore = await verticalScrollPosition(page);
    await page.mouse.wheel(0, 180);
    await expect
      .poll(() => verticalScrollPosition(page))
      .toBeGreaterThan(scrollBefore);
    expect(await chartPosition(page)).toBe(selectedBeforeVerticalScroll);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/energy");
    await expect(timeline).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await timeline.press("Home");
    await expect(timeline).toHaveAttribute("aria-valuenow", "0");
    await page.getByRole("button", { name: "Latest", exact: true }).click();
    await expect
      .poll(async () => ({
        now: await chartPosition(page),
        maximum: Number(await timeline.getAttribute("aria-valuemax")),
      }))
      .toEqual({
        now: Number(await timeline.getAttribute("aria-valuemax")),
        maximum: Number(await timeline.getAttribute("aria-valuemax")),
      });
    await page.locator("main h1").click();
    await page.screenshot({
      path: join(directory, "after/mobile-chart-navigation.png"),
      fullPage: true,
      animations: "disabled",
    });

    expect(errors).toEqual([]);
    await writeFile(
      join(directory, "chart-navigation-checks.json"),
      JSON.stringify(
        {
          energyLineGraph: "passed",
          tooltipUnits: "kWh",
          navigation: [
            "earlier",
            "later",
            "native scroll",
            "Home",
            "End",
            "ArrowLeft",
            "ArrowRight",
            "PageUp",
            "PageDown",
            "latest",
            "all readings",
            "horizontal wheel",
            "Shift + wheel",
          ],
          ordinaryVerticalScroll: "passed",
          mobileWidth: 390,
          horizontalPageOverflow: false,
          errors,
        },
        null,
        2,
      ),
    );
    console.log(
      "Chart checks passed: real energy line graph/tooltips, native time scrolling, keyboard and wheel navigation, latest/all readings, ordinary vertical scrolling, and mobile containment.",
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
