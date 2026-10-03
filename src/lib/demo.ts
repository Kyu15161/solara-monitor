import "server-only";
import { db } from "./db";
import { MockDessMonitorProvider } from "./dessmonitor/mock";
import { aggregateDay, syncIntegration } from "./sync";
import { dayBounds, dayKey } from "./analytics";
import { HttpError } from "./security/http";
export async function connectDemo(userId: string) {
  const provider = new MockDessMonitorProvider();
  const [project] = await provider.getProjects();
  const [collector] = await provider.getCollectors();
  const [inverter] = await provider.getDevices();
  const integration = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${userId} FOR UPDATE`;
    const existing = await tx.solarIntegration.findFirst({
      where: { userId, mode: "mock" },
      include: {
        plants: { include: { collectors: { include: { devices: true } } } },
      },
    });
    if (existing) return existing;
    return tx.solarIntegration.create({
      data: {
        userId,
        mode: "mock",
        label: "Demo system",
        nextSync: new Date(Date.now() + 3600000),
        plants: {
          create: {
            externalId: project.id,
            name: project.name,
            timezone: project.timezone,
            collectors: {
              create: {
                pn: collector.pn,
                devices: {
                  create: {
                    ...inverter,
                    capacityW: 10400,
                    batteryWh: 15000,
                    firmware: "DEMO 1.0",
                  },
                },
              },
            },
          },
        },
      },
      include: {
        plants: { include: { collectors: { include: { devices: true } } } },
      },
    });
  });
  const device = integration.plants[0].collectors[0].devices[0];
  if (device.historyStatus === "COMPLETE") {
    await db.solarIntegration.update({
      where: { id: integration.id },
      data: { connected: true, nextSync: new Date() },
    });
    return integration.id;
  }
  const claimed = await db.solarIntegration.updateMany({
    where: {
      id: integration.id,
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    data: {
      leaseUntil: new Date(Date.now() + 300000),
      nextSync: new Date(Date.now() + 3600000),
    },
  });
  if (!claimed.count)
    throw new HttpError(
      409,
      "Demo setup is already running. Please retry shortly.",
    );
  try {
    await db.device.update({
      where: { id: device.id },
      data: { historyStatus: "IMPORTING" },
    });
    const today = dayBounds(
      dayKey(new Date(), project.timezone),
      project.timezone,
    ).start;
    const start = new Date(+today - 89 * 86400000);
    const end = new Date(Math.floor(Date.now() / 900000) * 900000);
    const readings = await provider.getHistoricalData(
      {
        sn: device.sn,
        pn: collector.pn,
        devcode: device.devcode,
        devaddr: device.devaddr,
        timezone: device.timezone,
        state: {},
      },
      start,
      end,
    );
    for (let i = 0; i < readings.length; i += 300)
      await db.deviceReading.createMany({
        data: readings
          .slice(i, i + 300)
          .map((r) => ({ ...r, deviceId: device.id })),
        skipDuplicates: true,
      });
    for (let t = +start; t <= +today; t += 86400000)
      await aggregateDay(device.id, new Date(t + 3600000), device.timezone);
    if (
      !(await db.alert.count({
        where: { deviceId: device.id, key: { in: ["past-grid", "past-temp"] } },
      }))
    )
      await db.alert.createMany({
        data: [
          {
            deviceId: device.id,
            key: "past-grid",
            title: "Grid connection restored",
            description: "Historical simulated grid interruption.",
            severity: "WARNING",
            firstSeen: new Date(Date.now() - 172800000),
            lastSeen: new Date(Date.now() - 172740000),
            resolvedAt: new Date(Date.now() - 172740000),
          },
          {
            deviceId: device.id,
            key: "past-temp",
            title: "Temperature returned to normal",
            description: "Historical simulated high-temperature event.",
            severity: "WARNING",
            firstSeen: new Date(Date.now() - 345600000),
            lastSeen: new Date(Date.now() - 345000000),
            resolvedAt: new Date(Date.now() - 345000000),
          },
        ],
      });
    await db.controlAction.upsert({
      where: { idempotencyKey: `seed-${device.id}` },
      update: {},
      create: {
        deviceId: device.id,
        userId,
        idempotencyKey: `seed-${device.id}`,
        fieldKey: "chargeCurrent",
        fieldTitle: "Maximum charge current",
        oldValue: 30,
        requestedValue: 40,
        status: "APPLIED",
        requestedAt: new Date(Date.now() - 86400000),
        completedAt: new Date(Date.now() - 86395000),
        detail: "Seeded historical simulation; no physical command was sent.",
        transitions: [
          {
            status: "APPLIED",
            at: new Date(Date.now() - 86395000).toISOString(),
          },
        ],
      },
    });
    await db.device.update({
      where: { id: device.id },
      data: { historyStatus: "COMPLETE" },
    });
  } finally {
    await db.solarIntegration.update({
      where: { id: integration.id },
      data: { leaseUntil: null },
    });
  }
  await syncIntegration(integration.id);
  return integration.id;
}
