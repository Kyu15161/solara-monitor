import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveDessMonitorProvider } from "../src/lib/dessmonitor/live";
import {
  authSignature,
  requestSignature,
} from "../src/lib/dessmonitor/signing";
import type { DeviceRef } from "../src/lib/domain";

const ref: DeviceRef = {
  pn: "COLLECTOR0001",
  sn: "INVERTER1",
  devcode: 512,
  devaddr: 1,
  timezone: "Asia/Baghdad",
  state: {},
};
const credentials = {
  username: "test user",
  password: "test-only password",
  companyKey: "test-only key",
};
const provider = () => new LiveDessMonitorProvider(credentials);
function fixture(handler: (url: URL) => unknown) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.searchParams.get("action") === "authSource")
      return Response.json({
        err: 0,
        dat: { secret: "fixture-secret", token: "fixture-token", expire: 3600 },
      });
    return Response.json(handler(url));
  });
}
beforeEach(() => {
  vi.stubEnv("DESSMONITOR_APP_ID", "test.application");
  vi.stubEnv("DESSMONITOR_ALLOWED_CONTROL_IDS", "mode");
  vi.stubEnv("DESSMONITOR_BASE_URL", "https://api.dessmonitor.com/public/");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("live provider contracts with explicitly mocked transport", () => {
  it("signs the exact encoded query and never sends the password", async () => {
    const transport = fixture(() => ({ err: 0, dat: { total: 0, plant: [] } }));
    await provider().getProjects();
    expect(transport).toHaveBeenCalledTimes(2);
    for (const [input, init] of transport.mock.calls) {
      const url = new URL(String(input));
      const tail = url.search.slice(url.search.indexOf("&action="));
      const salt = url.searchParams.get("salt")!;
      const sign =
        url.searchParams.get("action") === "authSource"
          ? authSignature(salt, credentials.password, tail)
          : requestSignature(salt, "fixture-secret", "fixture-token", tail);
      expect(url.searchParams.get("sign")).toBe(sign);
      expect(String(input)).not.toContain(credentials.password);
      expect(init?.redirect).toBe("error");
      expect(url.protocol).toBe("https:");
    }
  });
  it("refuses an untrusted endpoint before sending credentials", async () => {
    vi.stubEnv("DESSMONITOR_BASE_URL", "https://attacker.example/public/");
    const transport = fixture(() => ({}));
    await expect(provider().authenticate()).rejects.toThrow("official HTTPS");
    expect(transport).not.toHaveBeenCalled();
  });
  it("rejects malformed external project data", async () => {
    fixture(() => ({
      err: 0,
      dat: { total: 1, plant: [{ pid: 1, name: 123 }] },
    }));
    await expect(provider().getProjects()).rejects.toThrow();
  });
  it("reauthenticates an expired read once", async () => {
    let attempts = 0;
    const transport = fixture(() =>
      ++attempts === 1 ? { err: 10 } : { err: 0, dat: { total: 0, plant: [] } },
    );
    expect(await provider().getProjects()).toEqual([]);
    expect(transport).toHaveBeenCalledTimes(4);
  });
  it("preserves sign semantics and leaves non-power units unavailable", async () => {
    fixture(() => ({
      err: 0,
      dat: {
        pv_status: [{ par: "pv", val: "2.5", unit: "kW", status: 1 }],
        bt_status: [{ par: "capacity", val: "100", unit: "Ah", status: 1 }],
        gd_status: [{ par: "grid", val: "300", unit: "W", status: -1 }],
        bc_status: [{ par: "load", val: "1200", unit: "W", status: -1 }],
      },
    }));
    expect(await provider().getEnergyFlow(ref)).toEqual({
      pvPowerW: 2500,
      batteryPowerW: null,
      gridPowerW: -300,
      loadPowerW: 1200,
    });
  });
  it("uses occurrence and disappearance timestamps, not handled status", async () => {
    fixture((url) => {
      expect(url.searchParams.get("pn")).toBe(ref.pn);
      expect(url.searchParams.has("handle")).toBe(false);
      return {
        err: 0,
        dat: {
          total: 2,
          warning: [
            {
              ...ref,
              state: undefined,
              id: "a",
              desc: "Alarm A",
              level: 0,
              handle: true,
              gts: "2026-10-02 10:00:00",
            },
            {
              ...ref,
              state: undefined,
              id: "b",
              desc: "Alarm B",
              level: 2,
              gts: "2026-10-02 10:00:00",
              cts: "2026-10-02 11:00:00",
            },
          ],
        },
      };
    });
    const alerts = await provider().getAlerts(ref);
    expect(alerts?.[0].resolvedAt).toBeNull();
    expect(alerts?.[0].firstSeen).toBe("2026-10-02T07:00:00.000Z");
    expect(alerts?.[1].resolvedAt).toBe("2026-10-02T08:00:00.000Z");
  });
  it("returns unknown alarm support instead of a false empty set", async () => {
    fixture(() => ({ err: 264 }));
    expect(await provider().getAlerts(ref)).toBeNull();
  });
  it("leaves unsupported numeric controls disabled", async () => {
    fixture(() => ({
      err: 0,
      dat: { field: [{ id: "current", name: "Charge current", unit: "A" }] },
    }));
    expect((await provider().getControlFields(ref))[0].writable).toBe(false);
  });
  it.each([0, 10])(
    "never claims physical verification or replays a control (err %s)",
    async (err) => {
      let writes = 0;
      fixture((url) => {
        switch (url.searchParams.get("action")) {
          case "queryDeviceCtrlField":
            return {
              err: 0,
              dat: {
                field: [
                  {
                    id: "mode",
                    name: "Mode",
                    item: [
                      { key: "1", val: "Solar" },
                      { key: "2", val: "Grid" },
                    ],
                  },
                ],
              },
            };
          case "queryDeviceCtrlValue":
            return { err: 0, dat: { id: "mode", val: "1" } };
          case "ctrlDevice":
            writes++;
            return { err, dat: { dat: null } };
          default:
            throw new Error("Unexpected action");
        }
      });
      const p = provider(),
        field = (await p.getControlFields(ref))[0];
      if (err)
        await expect(p.setControlValue(ref, field, "2")).rejects.toThrow();
      else
        expect(await p.setControlValue(ref, field, "2")).toMatchObject({
          accepted: true,
          verified: false,
        });
      expect(writes).toBe(1);
    },
  );
});
