import { describe, it, expect } from "vitest";
import {
  MockDessMonitorProvider,
  simulateReading,
} from "../src/lib/dessmonitor/mock";
import {
  readingSchema,
  freshness,
  validateControl,
  formatValue,
  type DeviceRef,
  type Scenario,
} from "../src/lib/domain";
import { integrate, dayBounds, csvCell } from "../src/lib/analytics";
import { normalizeLatest, numeric } from "../src/lib/dessmonitor/normalizer";
import {
  authSignature,
  queryTail,
  requestSignature,
  sha1,
} from "../src/lib/dessmonitor/signing";
import {
  encrypt,
  decrypt,
  hashPassword,
  checkPassword,
} from "../src/lib/security/crypto";
const ref: DeviceRef = {
  sn: "DEMO-INVERTER-001",
  pn: "DEMO-COLLECTOR-001",
  devcode: 8000,
  devaddr: 1,
  timezone: "Asia/Baghdad",
  state: {},
};
describe("Mock provider", () => {
  it.each<Scenario>([
    "sunny",
    "cloudy",
    "night",
    "battery-low",
    "grid-failure",
    "hot",
  ])("balances energy in %s", (scenario) => {
    const r = simulateReading(new Date("2026-10-02T09:00:00Z"), scenario);
    expect(r.pvPowerW! + r.gridPowerW!).toBeCloseTo(
      r.loadPowerW! + r.batteryPowerW!,
      5,
    );
    expect(readingSchema.safeParse(r).success).toBe(true);
  });
  it("discovers a consistent hierarchy", async () => {
    const p = new MockDessMonitorProvider();
    expect((await p.getProjects()).length).toBe(1);
    expect((await p.getCollectors())[0].pn).toBe(ref.pn);
    expect((await p.getDevices())[0].sn).toBe(ref.sn);
  });
  it("does not fabricate a new reading while offline", async () => {
    expect(
      await new MockDessMonitorProvider("offline").getLatestData(ref),
    ).toBeNull();
  });
  it("changes telemetry when grid charging is enabled", () => {
    const at = new Date("2026-10-02T20:00:00Z");
    const disabled = simulateReading(at, "night", { gridCharge: false });
    const enabled = simulateReading(at, "night", { gridCharge: true });
    expect(enabled.batteryPowerW).toBeGreaterThan(disabled.batteryPowerW!);
    expect(enabled.gridPowerW).toBeGreaterThan(disabled.gridPowerW!);
  });
  it("reports accepted separately from verification", async () => {
    const p = new MockDessMonitorProvider();
    const [field] = await p.getControlFields(ref);
    const result = await p.setControlValue(ref, field, 50);
    expect(result.accepted).toBe(true);
    expect(result.verified).toBe(false);
    expect(
      (await p.getControlFields({ ...ref, state: { ...result.state } }))[0]
        .value,
    ).toBe(50);
  });
});
describe("Gap-aware analytics", () => {
  const sample = (minutes: number, pv: number | null, grid = 0) => ({
    deviceTimestamp: new Date(Date.UTC(2026, 9, 2, 0, minutes)),
    pvPowerW: pv,
    loadPowerW: pv,
    batteryPowerW: 0,
    gridPowerW: grid,
    suspect: false,
  });
  it("integrates irregular intervals in watt-hours", () =>
    expect(
      integrate([sample(0, 1000), sample(10, 1000), sample(30, 1000)]).solarWh,
    ).toBeCloseTo(500));
  it("deduplicates samples and excludes large gaps", () => {
    const result = integrate([
      sample(0, 1000),
      sample(0, 1000),
      sample(15, 1000),
      sample(120, 1000),
    ]);
    expect(result.solarWh).toBe(250);
    expect(result.coveredSeconds).toBe(900);
  });
  it("keeps missing values distinct from zero", () => {
    expect(integrate([sample(0, null), sample(15, null)]).solarWh).toBeNull();
    expect(integrate([sample(0, 0), sample(15, 0)]).solarWh).toBe(0);
    expect(formatValue(null)).toBe("—");
  });
  it("splits an import/export zero crossing without cancellation", () => {
    const result = integrate([sample(0, 0, 1000), sample(30, 0, -1000)]);
    expect(result.importWh).toBe(125);
    expect(result.exportWh).toBe(125);
  });
  it("clips samples to a bucket boundary", () => {
    expect(
      integrate(
        [sample(0, 1000), sample(30, 1000)],
        1800,
        new Date("2026-10-02T00:10Z"),
        new Date("2026-10-02T00:20Z"),
      ).solarWh,
    ).toBeCloseTo(1000 / 6);
  });
  it("excludes suspect readings", () => {
    expect(
      integrate([sample(0, 1000), { ...sample(15, 1000), suspect: true }])
        .solarWh,
    ).toBeNull();
  });
  it("respects Baghdad midnight and daylight-saving day lengths", () => {
    expect(dayBounds("2026-10-02", "Asia/Baghdad").start.toISOString()).toBe(
      "2026-10-01T21:00:00.000Z",
    );
    const { start, end } = dayBounds("2026-03-08", "America/New_York");
    expect((+end - +start) / 3600000).toBe(23);
  });
  it("neutralizes CSV formula injection", () => {
    expect(csvCell("=1+1")).toBe('"\'=1+1"');
    expect(csvCell('a"b')).toBe('"a""b"');
  });
});
describe("Trust boundaries", () => {
  it("enforces viewer permissions, bounds, steps and safe mode", async () => {
    const [field, , high] =
      await new MockDessMonitorProvider().getControlFields(ref);
    expect(() => validateControl(field, 45, "VIEWER", false)).toThrow();
    expect(() => validateControl(field, 85, "OWNER", true)).toThrow();
    expect(() => validateControl(field, 43, "OWNER", true)).toThrow();
    expect(validateControl(field, 45, "ADMIN", true)).toBe(45);
    expect(() => validateControl(high, true, "OWNER", true)).toThrow();
    expect(() => validateControl(high, true, "ADMIN", false)).toThrow();
  });
  it("rejects NaN and impossible SOC", () => {
    const r = simulateReading(new Date());
    expect(readingSchema.safeParse({ ...r, batterySoc: 101 }).success).toBe(
      false,
    );
    expect(readingSchema.safeParse({ ...r, pvPowerW: NaN }).success).toBe(
      false,
    );
  });
  it("computes freshness from device time, not receipt time", () => {
    const now = Date.now();
    expect(freshness(new Date(now - 301000), now)).toBe("delayed");
    expect(freshness(new Date(now - 901000), now)).toBe("offline");
    expect(freshness(new Date(now + 120000), now)).toBe("suspect");
  });
  it("hashes passwords with independent salts", async () => {
    const hash = await hashPassword("A long test password!");
    expect(hash).not.toContain("A long");
    expect(await checkPassword("A long test password!", hash)).toBe(true);
    expect(await checkPassword("wrong", hash)).toBe(false);
    expect(await hashPassword("A long test password!")).not.toBe(hash);
  });
  it("encrypts credentials and detects tampering", () => {
    process.env.ENCRYPTION_KEY = "ab".repeat(32);
    const ciphertext = encrypt({ password: "private" });
    expect(ciphertext).not.toContain("private");
    expect(decrypt(ciphertext)).toEqual({ password: "private" });
    const pieces = ciphertext.split(".");
    pieces[1] = "AA" + pieces[1].slice(2);
    expect(() => decrypt(pieces.join("."))).toThrow();
  });
});
describe("Official DESSMonitor contracts", () => {
  it("implements the documented formula with a fixed independently checked digest", () => {
    const tail =
      "&action=authSource&usr=vplant&company-key=0123456789ABCDEF&source=1&_app_client_=android&_app_id_=com.demo.test&_app_version_=3.6.2.1";
    expect(authSignature("1491967716993", "vplant", tail)).toBe(
      "aebd599bd6d36ec7bebde87a661eb27bfa0a08fb",
    );
  });
  it("signs the exact serialized parameter order", () => {
    const tail = queryTail("queryDeviceLastData", {
      pn: "test",
      sn: "example",
    });
    expect(requestSignature("12345678", "secret", "token", tail)).toBe(
      sha1("12345678secrettoken&action=queryDeviceLastData&pn=test&sn=example"),
    );
  });
  it("converts base units without treating missing as zero", () => {
    expect(numeric("2.4", "kW", "W")).toBe(2400);
    expect(numeric("", "W", "W")).toBeNull();
    expect(numeric("NaN", "W", "W")).toBeNull();
    expect(numeric(12, "Ah", "W")).toBeNull();
  });
  it("preserves unknown fields and does not guess signed battery power", () => {
    const r = normalizeLatest(
      [
        { title: "id", val: "row1" },
        { title: "timestamp", val: "2026-10-02 12:00:00" },
        { title: "PV1 input power", unit: "kW", val: "2.5" },
        { title: "PV2 input power", unit: "W", val: "1000" },
        { title: "Unknown alarm", val: "X7" },
      ],
      "Asia/Baghdad",
      new Date("2026-10-02T09:01:00Z"),
    );
    expect(r.pvPowerW).toBe(3500);
    expect(r.batteryPowerW).toBeNull();
    expect(r.deviceTimestamp).toBe("2026-10-02T09:00:00.000Z");
    expect(r.fields.at(-1)?.value).toBe("X7");
  });
});
