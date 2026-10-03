import "server-only";
import { db } from "./db";
import { dayBounds, dayKey } from "./analytics";
import { aggregateDay } from "./sync";

/** Daily/hourly caches are scoped to a timezone, never relabeled across day boundaries. */
export async function queryAggregates(
  deviceId: string,
  start: Date,
  end: Date,
  period: string,
  timezone: string,
) {
  const [first, last, cached] = await Promise.all([
    db.deviceReading.findFirst({
      where: { deviceId },
      orderBy: { deviceTimestamp: "asc" },
      select: { deviceTimestamp: true },
    }),
    db.deviceReading.findFirst({
      where: { deviceId },
      orderBy: { deviceTimestamp: "desc" },
      select: { deviceTimestamp: true },
    }),
    db.energyAggregate.findMany({
      where: {
        deviceId,
        period: "day",
        timezone,
        timestamp: { gte: start, lt: end },
      },
      select: { timestamp: true },
    }),
  ]);
  if (!first || !last) return [];
  const existing = new Set(cached.map((r) => r.timestamp.toISOString()));
  let cursor = dayBounds(
    dayKey(new Date(Math.max(+start, +first.deviceTimestamp)), timezone),
    timezone,
  ).start;
  const limit = Math.min(+end, +last.deviceTimestamp + 1);
  const latestDay = dayBounds(
    dayKey(last.deviceTimestamp, timezone),
    timezone,
  ).start;
  const device = await db.device.findUniqueOrThrow({
    where: { id: deviceId },
    select: { timezone: true },
  });
  while (+cursor < limit) {
    if (
      !existing.has(cursor.toISOString()) ||
      (device.timezone !== timezone && +cursor === +latestDay)
    )
      await aggregateDay(deviceId, new Date(+cursor + 1), timezone);
    cursor = dayBounds(dayKey(cursor, timezone), timezone).end;
  }
  const rows = await db.energyAggregate.findMany({
    where: {
      deviceId,
      period: period === "hour" ? "hour" : "day",
      timezone,
      timestamp: { gte: start, lt: end },
    },
    orderBy: { timestamp: "asc" },
  });
  if (period !== "month") return rows;
  // Roll up selected days so custom ranges do not include an entire boundary month.
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const month = dayKey(row.timestamp, timezone).slice(0, 7);
    grouped.set(month, [...(grouped.get(month) ?? []), row]);
  }
  return [...grouped.entries()].map(([month, days]) => {
    const sum = (
      key:
        | "solarWh"
        | "loadWh"
        | "importWh"
        | "exportWh"
        | "chargeWh"
        | "dischargeWh",
    ) =>
      days.every((d) => d[key] === null)
        ? null
        : days.reduce((n, d) => n + (d[key] ?? 0), 0);
    const peak = (key: "peakSolarW" | "peakLoadW") =>
      days.every((d) => d[key] === null)
        ? null
        : Math.max(...days.flatMap((d) => (d[key] === null ? [] : [d[key]])));
    return {
      ...days[0],
      period: "month",
      timestamp: dayBounds(month + "-01", timezone).start,
      solarWh: sum("solarWh"),
      loadWh: sum("loadWh"),
      importWh: sum("importWh"),
      exportWh: sum("exportWh"),
      chargeWh: sum("chargeWh"),
      dischargeWh: sum("dischargeWh"),
      peakSolarW: peak("peakSolarW"),
      peakLoadW: peak("peakLoadW"),
      sampleCount: days.reduce((n, d) => n + d.sampleCount, 0),
      coveredSeconds: days.reduce((n, d) => n + d.coveredSeconds, 0),
    };
  });
}
