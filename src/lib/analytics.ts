import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { Reading } from "./domain";
export type Sample = Pick<
  Reading,
  "pvPowerW" | "loadPowerW" | "batteryPowerW" | "gridPowerW" | "suspect"
> & { deviceTimestamp: Date | string };
export type Totals = {
  solarWh: number | null;
  loadWh: number | null;
  importWh: number | null;
  exportWh: number | null;
  chargeWh: number | null;
  dischargeWh: number | null;
  peakSolarW: number | null;
  peakLoadW: number | null;
  coveredSeconds: number;
  sampleCount: number;
};
export function integrate(
  samples: Sample[],
  maxGapSeconds = 1800,
  start?: Date,
  end?: Date,
): Totals {
  const rows = [
    ...new Map(
      samples.map((r) => [new Date(r.deviceTimestamp).getTime(), r]),
    ).values(),
  ].sort((a, b) => +new Date(a.deviceTimestamp) - +new Date(b.deviceTimestamp));
  const totals: Totals = {
    solarWh: null,
    loadWh: null,
    importWh: null,
    exportWh: null,
    chargeWh: null,
    dischargeWh: null,
    peakSolarW: null,
    peakLoadW: null,
    coveredSeconds: 0,
    sampleCount: rows.filter(
      (r) =>
        (!start || +new Date(r.deviceTimestamp) >= +start) &&
        (!end || +new Date(r.deviceTimestamp) < +end),
    ).length,
  };
  for (const r of rows)
    if (
      !r.suspect &&
      (!start || +new Date(r.deviceTimestamp) >= +start) &&
      (!end || +new Date(r.deviceTimestamp) < +end)
    ) {
      if (r.pvPowerW !== null)
        totals.peakSolarW = Math.max(totals.peakSolarW ?? 0, r.pvPowerW);
      if (r.loadPowerW !== null)
        totals.peakLoadW = Math.max(totals.peakLoadW ?? 0, r.loadPowerW);
    }
  // Split signed trapezoids at zero so imports/exports and charge/discharge cannot cancel each other.
  function area(a: number, b: number, h: number, positive: boolean) {
    if (!positive) {
      a = -a;
      b = -b;
    }
    if (a >= 0 && b >= 0) return ((a + b) * h) / 2;
    if (a <= 0 && b <= 0) return 0;
    const p = Math.max(a, b);
    return (p * h * (p / (Math.abs(a) + Math.abs(b)))) / 2;
  }
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1],
      b = rows[i],
      ta = +new Date(a.deviceTimestamp),
      tb = +new Date(b.deviceTimestamp),
      seconds = (tb - ta) / 1000;
    if (a.suspect || b.suspect || seconds <= 0 || seconds > maxGapSeconds)
      continue;
    const left = Math.max(ta, start?.getTime() ?? ta),
      right = Math.min(tb, end?.getTime() ?? tb);
    if (right <= left) continue;
    const h = (right - left) / 3600000;
    const metrics: [
      keyof Pick<
        Totals,
        | "solarWh"
        | "loadWh"
        | "importWh"
        | "exportWh"
        | "chargeWh"
        | "dischargeWh"
      >,
      keyof Pick<
        Sample,
        "pvPowerW" | "loadPowerW" | "gridPowerW" | "batteryPowerW"
      >,
      boolean,
    ][] = [
      ["solarWh", "pvPowerW", true],
      ["loadWh", "loadPowerW", true],
      ["importWh", "gridPowerW", true],
      ["exportWh", "gridPowerW", false],
      ["chargeWh", "batteryPowerW", true],
      ["dischargeWh", "batteryPowerW", false],
    ];
    for (const [key, field, positive] of metrics) {
      const av = a[field],
        bv = b[field];
      if (av === null || bv === null) continue;
      const vl = av + ((bv - av) * (left - ta)) / (tb - ta),
        vr = av + ((bv - av) * (right - ta)) / (tb - ta);
      totals[key] = (totals[key] ?? 0) + area(vl, vr, h, positive);
    }
    if (a.pvPowerW !== null && b.pvPowerW !== null)
      totals.coveredSeconds += (right - left) / 1000;
  }
  return totals;
}
export function dayBounds(day: string, timezone: string) {
  const start = fromZonedTime(`${day}T00:00:00`, timezone);
  const next = new Date(`${day}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    start,
    end: fromZonedTime(`${next.toISOString().slice(0, 10)}T00:00:00`, timezone),
  };
}
export function dayKey(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}
export function csvCell(value: unknown) {
  const raw = String(value ?? "");
  const safe =
    typeof value !== "number" && /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
