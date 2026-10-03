import { test, expect, request, type BrowserContext } from "@playwright/test";
// Chromium permits Secure cookies on loopback HTTP. Playwright's Node HTTP
// client does not, so forward the browser's cookie explicitly for local API checks.
async function authenticatedRequests(context: BrowserContext) {
  return request.newContext({
    baseURL: "http://127.0.0.1:3000",
    extraHTTPHeaders: {
      Cookie: (await context.cookies())
        .map((c) => `${c.name}=${c.value}`)
        .join("; "),
    },
  });
}
test("complete demo monitoring and security journey", async ({
  page,
  context,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Good to see you." }),
  ).toBeVisible();
  const setupResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/auth/demo"),
  );
  await page.getByRole("button", { name: "Explore demo system" }).click();
  expect((await setupResponse).status()).toBe(200);
  await page.waitForURL("**/dashboard", { timeout: 300000 });
  await expect(
    page.getByRole("heading", { name: "Energy overview" }),
  ).toBeVisible();
  await expect(page.getByText("DEMO SYSTEM", { exact: true })).toBeVisible();
  const api = await authenticatedRequests(context);
  const response = await api.get("/api/dashboard");
  expect(response.ok()).toBe(true);
  const initial = await response.json();
  const deviceId = initial.selectedId;
  expect(initial.latest.pvPowerW).toBeGreaterThan(0);
  expect(
    initial.alerts.filter((a: { resolvedAt: string | null }) => !a.resolvedAt),
  ).toHaveLength(2);
  const serialized = JSON.stringify(initial);
  for (const secret of [
    "encryptedCredentials",
    "passwordHash",
    "companyKey",
    "secret",
    "token",
  ])
    expect(serialized).not.toContain(`"${secret}"`);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: ".data/desktop.png", fullPage: true });
  for (const route of [
    "live",
    "energy",
    "battery",
    "grid",
    "inverter",
    "devices",
    "settings",
    "account",
  ]) {
    await page.goto(`/dashboard/${route}?device=${deviceId}`);
    await expect(page.locator("main h1")).toBeVisible();
  }
  await page.goto(`/dashboard/analytics?device=${deviceId}`);
  await expect(
    page.getByRole("heading", { name: "Energy over time" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A year of sunshine" }),
  ).toBeVisible();
  const history = await api.get(
    `/api/devices/${deviceId}/analytics?start=2026-07-01&end=2026-10-02&aggregation=day`,
  );
  expect(history.ok()).toBe(true);
  expect((await history.json()).rows.length).toBeGreaterThan(80);
  await page.goto(`/dashboard/alerts?device=${deviceId}`);
  await page.getByRole("button", { name: "Acknowledge" }).first().click();
  await expect(page.getByText(/Acknowledged by/).first()).toBeVisible();
  await page.goto(`/dashboard/controls?device=${deviceId}`);
  const card = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Maximum charge current",
      exact: true,
    }),
  });
  await card.getByRole("spinbutton").fill("50");
  await card.getByRole("button", { name: "Review change" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirm & apply" }).click();
  await expect
    .poll(
      async () => {
        const r = await api.get("/api/dashboard");
        return (await r.json()).commands[0].status;
      },
      { timeout: 60000 },
    )
    .toBe("APPLIED");
  // The open page must receive the worker result through SSE without a reload.
  await expect(page.getByText("APPLIED", { exact: true }).first()).toBeVisible({
    timeout: 15000,
  });
  const afterControl = await (await api.get("/api/dashboard")).json();
  const command = afterControl.commands[0];
  const repeated = {
    key: command.fieldKey,
    value: command.requestedValue,
    oldValue: command.oldValue,
    confirmed: true,
    idempotencyKey: command.idempotencyKey,
  };
  const repeat = await api.post(`/api/devices/${deviceId}/controls`, {
    headers: { Origin: "http://127.0.0.1:3000" },
    data: repeated,
  });
  expect(repeat.ok()).toBe(true);
  expect((await repeat.json()).id).toBe(command.id);
  expect(
    (
      await api.post(`/api/devices/${deviceId}/controls`, {
        headers: { Origin: "http://127.0.0.1:3000" },
        data: { ...repeated, value: 55 },
      })
    ).status(),
  ).toBe(409);
  const audit = await api.get("/api/audit");
  expect(
    (await audit.json()).some(
      (a: { event: string }) => a.event === "control.queued",
    ),
  ).toBe(true);
  const csrf = await api.post("/api/preferences", {
    headers: { Origin: "https://attacker.example" },
    data: { safeMode: false },
  });
  expect(csrf.status()).toBe(403);
  const stranger = await browser.newContext();
  const forbidden = await stranger.request.get(
    `/api/devices/${deviceId}/latest`,
  );
  expect(forbidden.status()).toBe(401);
  const registration = await stranger.request.post(
    "http://127.0.0.1:3000/api/auth/signup",
    {
      headers: { Origin: "http://127.0.0.1:3000" },
      data: {
        name: "Separate owner",
        email: `isolation-${Date.now()}@example.local`,
        password: "Isolation test password!",
        confirmPassword: "Isolation test password!",
        acceptTerms: true,
      },
    },
  );
  expect(registration.ok()).toBe(true);
  const strangerApi = await authenticatedRequests(stranger);
  for (const endpoint of [
    "latest",
    "history",
    "controls",
    "alerts",
    "energy-flow",
    "export",
  ])
    expect(
      (
        await strangerApi.get(
          `http://127.0.0.1:3000/api/devices/${deviceId}/${endpoint}`,
        )
      ).status(),
    ).toBe(404);
  expect(
    (
      await strangerApi.post(
        `http://127.0.0.1:3000/api/devices/${deviceId}/controls`,
        { headers: { Origin: "http://127.0.0.1:3000" }, data: repeated },
      )
    ).status(),
  ).toBe(404);
  await stranger.close();
  await page.goto("/dashboard/settings");
  await page.getByRole("button", { name: "Move metrics down" }).click();
  await expect(page.locator(".widget-order > div").first()).toContainText(
    "1. flow",
  );
  await page.goto("/dashboard");
  await expect(page.locator(".widget-flow")).toBeVisible();
  await expect(page.locator(".widget-metrics")).toBeVisible();
  const flowPosition = await page.locator(".widget-flow").boundingBox();
  const metricPosition = await page.locator(".widget-metrics").boundingBox();
  expect(flowPosition!.y).toBeLessThan(metricPosition!.y);
  await page.goto("/dashboard/settings");
  await page.getByRole("button", { name: "Reset layout", exact: true }).click();
  await expect(page.locator(".widget-order > div").first()).toContainText(
    "1. metrics",
  );
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: ".data/dark.png", fullPage: true });
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: ".data/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("registration, logout, login and tenant isolation", async ({
  page,
  context,
}) => {
  const email = `test-${Date.now()}@example.local`,
    password = "A secure test password 2026!";
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Test Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL("**/dashboard");
  await expect(
    page.getByRole("heading", { name: "No solar system connected yet." }),
  ).toBeVisible();
  const api = await authenticatedRequests(context);
  const data = await api.get("/api/dashboard");
  expect((await data.json()).devices).toHaveLength(0);
  expect((await api.get("/api/devices/nonexistent/latest")).status()).toBe(404);
  await api.post("/api/auth/logout", {
    headers: { Origin: "http://127.0.0.1:3000" },
    data: {},
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await expect(
    page.getByRole("heading", { name: "No solar system connected yet." }),
  ).toBeVisible();
});
