import "server-only";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type {
  Control,
  DessMonitorProvider,
  DeviceRef,
  Reading,
  ProviderAlert,
} from "../domain";
import { authSignature, queryTail, requestSignature } from "./signing";
import { normalizeLatest, numeric } from "./normalizer";
export class DessError extends Error {
  constructor(public code: number) {
    super(
      code === 8 || code === 11
        ? "This setting cannot be changed with the connected DESSMonitor account."
        : `DESSMonitor request failed (code ${code}).`,
    );
  }
}
const envelope = z.object({
  err: z.number().int(),
  desc: z.string().optional(),
  dat: z.unknown().optional(),
});
const id = z.union([z.string(), z.number()]).transform(String);
function offsetTimezone(seconds: number) {
  const minutes = Math.abs(Math.round(seconds / 60));
  return `${seconds < 0 ? "-" : "+"}${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export class LiveDessMonitorProvider implements DessMonitorProvider {
  readonly mode = "live" as const;
  private session: { secret: string; token: string; until: number } | null =
    null;
  constructor(
    private credentials: {
      username: string;
      password: string;
      companyKey: string;
    },
  ) {}
  private common() {
    if (!process.env.DESSMONITOR_APP_ID)
      throw new Error(
        "DESSMonitor application identifier must be configured by the server operator.",
      );
    return {
      source: process.env.DESSMONITOR_DEFAULT_SOURCE ?? "1",
      _app_client_: "web",
      _app_id_: process.env.DESSMONITOR_APP_ID,
      _app_version_: process.env.DESSMONITOR_APP_VERSION ?? "1.0.0",
    };
  }
  private async fetch(query: string) {
    const endpoint = new URL(
      process.env.DESSMONITOR_BASE_URL ?? "https://api.dessmonitor.com/public/",
    );
    if (
      endpoint.protocol !== "https:" ||
      endpoint.hostname !== "api.dessmonitor.com" ||
      endpoint.pathname !== "/public/" ||
      endpoint.username ||
      endpoint.password
    )
      throw new Error(
        "Only the official HTTPS DESSMonitor endpoint is permitted.",
      );
    let response: Response;
    try {
      response = await fetch(endpoint.toString() + "?" + query, {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error("DESSMonitor connection timed out or failed.");
    }
    if (!response.ok) throw new Error("DESSMonitor returned an HTTP error.");
    const raw = await response.text();
    if (raw.length > 5_000_000)
      throw new Error("DESSMonitor response exceeds the limit.");
    const data = envelope.parse(JSON.parse(raw));
    if (data.err !== 0) throw new DessError(data.err);
    return data.dat;
  }
  async authenticate() {
    if (this.session && this.session.until > Date.now() + 60000) return;
    const salt = randomBytes(12).toString("hex");
    const tail = queryTail("authSource", {
      usr: this.credentials.username,
      "company-key": this.credentials.companyKey,
      ...this.common(),
    });
    const dat = z
      .object({
        secret: z.string().min(1),
        token: z.string().min(1),
        expire: z.number().positive(),
      })
      .parse(
        await this.fetch(
          `sign=${authSignature(salt, this.credentials.password, tail)}&salt=${salt}${tail}`,
        ),
      );
    this.session = {
      secret: dat.secret,
      token: dat.token,
      until: Date.now() + dat.expire * 1000,
    };
  }
  private async call(
    action: string,
    params: Record<string, string>,
    retry = true,
  ): Promise<unknown> {
    await this.authenticate();
    const session = this.session!;
    const salt = randomBytes(12).toString("hex");
    const tail = queryTail(action, { ...params, ...this.common() });
    try {
      return await this.fetch(
        `sign=${requestSignature(salt, session.secret, session.token, tail)}&salt=${salt}&token=${encodeURIComponent(session.token)}${tail}`,
      );
    } catch (error) {
      if (
        error instanceof DessError &&
        error.code === 10 &&
        retry &&
        action !== "ctrlDevice"
      ) {
        this.session = null;
        return this.call(action, params, false);
      }
      throw error;
    }
  }
  private ref(d: DeviceRef) {
    return {
      pn: d.pn,
      devcode: String(d.devcode),
      devaddr: String(d.devaddr),
      sn: d.sn,
    };
  }
  async getProjects() {
    const result: Array<{ id: string; name: string; timezone: string }> = [];
    for (let page = 0; page < 100; page++) {
      const data = z
        .object({
          total: z.number(),
          plant: z
            .array(
              z.object({
                pid: id,
                name: z.string(),
                address: z.object({ timezone: z.number() }).optional(),
              }),
            )
            .default([]),
        })
        .parse(
          await this.call("queryPlants", {
            page: String(page),
            pagesize: "50",
          }),
        );
      result.push(
        ...data.plant.map((p) => ({
          id: p.pid,
          name: p.name,
          timezone: p.address ? offsetTimezone(p.address.timezone) : "UTC",
        })),
      );
      if (result.length >= data.total) return result;
    }
    throw new Error("Project discovery exceeds the supported page limit.");
  }
  async getCollectors(projectId: string) {
    const result: Array<{ pn: string }> = [];
    for (let page = 0; page < 100; page++) {
      const data = z
        .object({
          total: z.number(),
          collector: z.array(z.object({ pn: z.string() })).default([]),
        })
        .parse(
          await this.call("webQueryCollectorsEs", {
            page: String(page),
            pagesize: "50",
          }),
        );
      for (const c of data.collector) {
        const info = z
          .object({
            collector: z.array(
              z.object({ pn: z.string(), pid: id.optional() }),
            ),
          })
          .parse(await this.call("queryCollectorInfoEs", { pn: c.pn }));
        if (info.collector.some((i) => i.pid === projectId)) result.push(c);
      }
      if ((page + 1) * 50 >= data.total) return result;
    }
    throw new Error("Collector discovery exceeds the supported page limit.");
  }
  async getDevices(pn: string) {
    const data = z
      .object({
        dev: z
          .array(
            z.object({
              sn: z.string(),
              alias: z.string().optional(),
              devcode: z.number().int(),
              devaddr: z.number().int(),
            }),
          )
          .default([]),
      })
      .parse(await this.call("queryCollectorDevices", { pn }));
    const result: Array<{
      sn: string;
      alias: string;
      devcode: number;
      devaddr: number;
      timezone: string;
    }> = [];
    for (const device of data.dev) {
      const info = z
        .object({
          device: z.array(
            z.object({
              sn: z.string(),
              devcode: z.number(),
              devaddr: z.number(),
              timezone: z.number(),
            }),
          ),
        })
        .parse(
          await this.call("queryDeviceInfo", {
            device: `${pn},${device.devcode},${device.devaddr},${device.sn}`,
          }),
        );
      const matched = info.device.find(
        (d) =>
          d.sn === device.sn &&
          d.devcode === device.devcode &&
          d.devaddr === device.devaddr,
      );
      if (!matched) throw new Error("Device information mismatch.");
      result.push({
        ...device,
        alias: device.alias ?? device.sn,
        timezone: offsetTimezone(matched.timezone),
      });
    }
    return result;
  }
  async getLatestData(device: DeviceRef) {
    try {
      return normalizeLatest(
        await this.call("queryDeviceLastData", {
          i18n: "en_US",
          ...this.ref(device),
        }),
        device.timezone,
      );
    } catch (e) {
      if (e instanceof DessError && e.code === 12) return null;
      throw e;
    }
  }
  async getHistoricalData(
    device: DeviceRef,
    start: Date,
    end: Date,
  ): Promise<Reading[]> {
    if (+end - +start > 31 * 86400000)
      throw new Error("Backfill is limited to 31 days per request.");
    const results: Reading[] = [];
    const seen = new Set<string>();
    for (let t = +start; t <= +end; t += 86400000) {
      const date = formatInTimeZone(new Date(t), device.timezone, "yyyy-MM-dd");
      if (seen.has(date)) continue;
      seen.add(date);
      try {
        const data = z
          .object({
            title: z.array(
              z.object({ title: z.string(), unit: z.string().optional() }),
            ),
            row: z
              .array(
                z.object({
                  field: z.array(z.union([z.string(), z.number(), z.null()])),
                }),
              )
              .default([]),
          })
          .parse(
            await this.call("queryDeviceDataOneDay", {
              i18n: "en_US",
              ...this.ref(device),
              date,
            }),
          );
        for (const row of data.row) {
          if (row.field.length !== data.title.length)
            throw new Error("Historical field count mismatch.");
          const reading = normalizeLatest(
            data.title.map((f, i) => ({ ...f, val: row.field[i] })),
            device.timezone,
          );
          if (
            +new Date(reading.deviceTimestamp) >= +start &&
            +new Date(reading.deviceTimestamp) <= +end
          )
            results.push(reading);
        }
      } catch (e) {
        if (!(e instanceof DessError && e.code === 12)) throw e;
      }
    }
    return results;
  }
  async getEnergyFlow(device: DeviceRef) {
    const item = z.object({
      par: z.string(),
      val: z.union([z.string(), z.number()]),
      unit: z.string().optional(),
      status: z.number(),
    });
    const data = z
      .object({
        pv_status: z.array(item).optional(),
        bt_status: z.array(item).optional(),
        gd_status: z.array(item).optional(),
        bc_status: z.array(item).optional(),
      })
      .parse(await this.call("webQueryDeviceEnergyFlowEs", this.ref(device)));
    const power = (
      items: z.infer<typeof item>[] | undefined,
      polarity: number,
    ) => {
      const entry = items?.find((i) => i.unit === "W" || i.unit === "kW");
      if (!entry) return null;
      const watts = numeric(entry.val, entry.unit ?? "", "W");
      return watts === null ? null : Math.abs(watts) * entry.status * polarity;
    };
    return {
      pvPowerW: power(data.pv_status, 1),
      loadPowerW: power(data.bc_status, -1),
      gridPowerW: power(data.gd_status, 1),
      batteryPowerW: power(data.bt_status, -1),
    };
  }
  async getControlFields(device: DeviceRef): Promise<Control[]> {
    try {
      const data = z
        .object({
          field: z
            .array(
              z.object({
                id: z.string(),
                name: z.string(),
                unit: z.string().optional(),
                hint: z.string().optional(),
                item: z
                  .array(z.object({ key: z.string(), val: z.string() }))
                  .optional(),
              }),
            )
            .default([]),
        })
        .parse(
          await this.call("queryDeviceCtrlField", {
            ...this.ref(device),
            i18n: "en_US",
          }),
        );
      const fields: Control[] = [];
      for (const f of data.field) {
        let value = "";
        const enabled = (process.env.DESSMONITOR_ALLOWED_CONTROL_IDS ?? "")
          .split(",")
          .map((id) => id.trim())
          .slice(0, 16)
          .includes(f.id);
        if (enabled && f.item)
          try {
            const current = z.object({ id: z.string(), val: z.string() }).parse(
              await this.call("queryDeviceCtrlValue", {
                ...this.ref(device),
                id: f.id,
                i18n: "en_US",
              }),
            );
            if (current.id === f.id) value = current.val;
          } catch {
            /* Unreadable settings remain visibly disabled. */
          }
        fields.push({
          key: f.id,
          title: f.name,
          description: enabled
            ? "Device-supported setting. Physical application requires independent confirmation."
            : "Live control disabled until this field has been reviewed and enabled by the server operator.",
          kind: f.item ? "select" : "number",
          unit: f.unit ?? "",
          value,
          options: f.item?.map((i) => ({ label: i.val, value: i.key })),
          highImpact: true,
          writable: enabled && !!f.item?.some((i) => i.key === value),
        });
      }
      return fields;
    } catch (e) {
      if (e instanceof DessError && [1, 8, 9, 11, 12].includes(e.code))
        return [];
      throw e;
    }
  }
  async setControlValue(
    device: DeviceRef,
    field: Control,
    value: string | number | boolean,
  ) {
    const fresh = (await this.getControlFields(device)).find(
      (f) => f.key === field.key,
    );
    if (!fresh?.writable || !fresh.options?.some((o) => o.value === value))
      throw new Error("Unsupported or unauthorized live setting.");
    z.object({ dat: z.string().nullable() }).parse(
      await this.call(
        "ctrlDevice",
        { ...this.ref(device), id: field.key, val: String(value) },
        false,
      ),
    );
    return {
      accepted: true,
      verified: false,
      detail: "Command accepted — device confirmation unavailable.",
    };
  }
  async getAlerts(device: DeviceRef): Promise<ProviderAlert[] | null> {
    const result: ProviderAlert[] = [];
    const timestamp = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    for (let page = 0; page < 20; page++) {
      try {
        const data = z
          .object({
            total: z.number().int().nonnegative(),
            warning: z
              .array(
                z.object({
                  id: z.string(),
                  pn: z.string(),
                  sn: z.string(),
                  devcode: z.number().int(),
                  devaddr: z.number().int(),
                  level: z.number().int().min(0).max(3),
                  desc: z.string(),
                  gts: timestamp,
                  cts: timestamp.optional(),
                }),
              )
              .default([]),
          })
          .parse(
            await this.call("queryDeviceWarning", {
              ...this.ref(device),
              i18n: "en_US",
              page: String(page),
              pagesize: "50",
            }),
          );
        for (const warning of data.warning) {
          if (
            warning.pn !== device.pn ||
            warning.sn !== device.sn ||
            warning.devcode !== device.devcode ||
            warning.devaddr !== device.devaddr
          )
            throw new Error("Alarm device identifiers do not match.");
          result.push({
            key: `dess-${warning.id}`,
            title: warning.desc,
            description: `DESSMonitor ${warning.level === 3 ? "offline" : warning.level === 2 ? "fault" : warning.level === 1 ? "error" : "warning"} event`,
            severity:
              warning.level === 1 || warning.level === 2
                ? "CRITICAL"
                : "WARNING",
            firstSeen: fromZonedTime(
              warning.gts,
              device.timezone,
            ).toISOString(),
            resolvedAt: warning.cts
              ? fromZonedTime(warning.cts, device.timezone).toISOString()
              : null,
          });
        }
        if ((page + 1) * 50 >= data.total) return result;
      } catch (error) {
        if (
          error instanceof DessError &&
          [8, 9, 11, 12, 264].includes(error.code)
        )
          return null;
        throw error;
      }
    }
    // An incomplete result must never clear or partially replace the active alarm set.
    return null;
  }
}
