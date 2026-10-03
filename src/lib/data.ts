import "server-only";
import { db } from "./db";
import { dayBounds, dayKey, integrate } from "./analytics";
import { controlSchema, energyFlowSchema, parameterSchema } from "./domain";
import { z } from "zod";
export async function dashboardData(userId: string, requestedId?: string) {
  const devices = await db.device.findMany({
    where: { collector: { plant: { integration: { userId } } } },
    include: {
      collector: { include: { plant: { include: { integration: true } } } },
    },
    orderBy: { alias: "asc" },
  });
  const selected = devices.find((d) => d.id === requestedId) ?? devices[0];
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: { preference: true },
  });
  const notifications = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const integrations = await db.solarIntegration.findMany({
    where: { userId },
    select: {
      id: true,
      mode: true,
      label: true,
      connected: true,
      scenario: true,
      lastSync: true,
      nextSync: true,
      lastError: true,
      lastAttempt: true,
      failureCount: true,
    },
  });
  const base = {
    serverNow: Date.now(),
    energyFlow: selected?.energyFlow
      ? energyFlowSchema.parse(selected.energyFlow)
      : null,
    energyFlowAt: selected?.energyFlowAt ?? null,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isDemo: user.isDemo,
    },
    preference: user.preference,
    notifications,
    integrations,
    devices: devices.map((d) => ({
      id: d.id,
      alias: d.alias,
      sn: d.sn,
      devcode: d.devcode,
      devaddr: d.devaddr,
      timezone: d.timezone,
      model: d.model,
      firmware: d.firmware,
      capacityW: d.capacityW,
      batteryWh: d.batteryWh,
      historyStatus: d.historyStatus,
      pn: d.collector.pn,
      plant: d.collector.plant.name,
      mode: d.collector.plant.integration.mode,
      integrationId: d.collector.plant.integrationId,
      connected: d.collector.plant.integration.connected,
    })),
    freshness: {
      delayed: Math.max(
        30,
        Number(process.env.FRESHNESS_DELAYED_SECONDS) || 300,
      ),
      offline: Math.max(
        60,
        Number(process.env.FRESHNESS_OFFLINE_SECONDS) || 900,
      ),
    },
    development: process.env.NODE_ENV !== "production",
  };
  if (!selected)
    return {
      ...base,
      selectedId: null,
      latest: null,
      alerts: [],
      commands: [],
      controls: [],
      timeline: [],
      liveTimeline: [],
      today: null,
      jobs: [],
    };
  const timezone = user.preference?.timezone || selected.timezone;
  const { start } = dayBounds(dayKey(new Date(), timezone), timezone);
  const [
    latest,
    alerts,
    commands,
    fields,
    timeline,
    storedToday,
    jobs,
    liveTimeline,
  ] = await Promise.all([
    db.deviceReading.findFirst({
      where: { deviceId: selected.id },
      orderBy: { deviceTimestamp: "desc" },
    }),
    db.alert.findMany({
      where: { deviceId: selected.id },
      orderBy: { firstSeen: "desc" },
      take: 200,
    }),
    db.controlAction.findMany({
      where: { deviceId: selected.id },
      orderBy: { requestedAt: "desc" },
      take: 50,
    }),
    db.controlField.findMany({ where: { deviceId: selected.id } }),
    db.deviceReading.findMany({
      where: { deviceId: selected.id, deviceTimestamp: { gte: start } },
      orderBy: { deviceTimestamp: "asc" },
      select: {
        deviceTimestamp: true,
        pvPowerW: true,
        loadPowerW: true,
        batteryPowerW: true,
        gridPowerW: true,
        batterySoc: true,
        suspect: true,
      },
    }),
    db.energyAggregate.findUnique({
      where: {
        deviceId_period_timezone_timestamp: {
          deviceId: selected.id,
          period: "day",
          timezone,
          timestamp: start,
        },
      },
    }),
    db.syncJob.findMany({
      where: { integrationId: selected.collector.plant.integrationId },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    db.deviceReading.findMany({
      where: {
        deviceId: selected.id,
        deviceTimestamp: { gte: new Date(Date.now() - 86400000) },
      },
      orderBy: { deviceTimestamp: "asc" },
      select: {
        deviceTimestamp: true,
        pvPowerW: true,
        loadPowerW: true,
        batteryPowerW: true,
        gridPowerW: true,
        batterySoc: true,
        suspect: true,
      },
    }),
  ]);
  const today =
    timezone === selected.timezone
      ? storedToday
      : integrate(timeline, 1800, start, new Date());
  return {
    ...base,
    selectedId: selected.id,
    latest: latest
      ? { ...latest, fields: z.array(parameterSchema).parse(latest.fields) }
      : null,
    alerts,
    commands,
    controls: fields.map((f) => controlSchema.parse(f.metadata)),
    timeline,
    liveTimeline,
    today,
    jobs,
  };
}
type Serialized<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;
export type DashboardData = Serialized<
  Awaited<ReturnType<typeof dashboardData>>
>;
