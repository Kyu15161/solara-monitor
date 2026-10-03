import "server-only";
import { db } from "./db";
import { providerFor, deviceRef } from "./dessmonitor/provider";
import {
  controlSchema,
  energyFlowSchema,
  readingSchema,
  type ProviderAlert,
} from "./domain";
import { dayBounds, dayKey, integrate } from "./analytics";

export async function processAlerts(
  deviceId: string,
  userId: string,
  incoming: ProviderAlert[] | null,
  resolveMissing = true,
) {
  if (incoming === null) return; // Unsupported/failing alarm reads cannot resolve existing alerts.
  const now = new Date();
  const active = await db.alert.findMany({
    where: { deviceId, resolvedAt: null },
  });
  for (const item of incoming) {
    const existing = item.firstSeen
      ? await db.alert.findFirst({ where: { deviceId, key: item.key } })
      : active.find((a) => a.key === item.key);
    if (existing)
      await db.alert.update({
        where: { id: existing.id },
        data: {
          lastSeen: item.resolvedAt ? new Date(item.resolvedAt) : now,
          description: item.description,
          ...(item.resolvedAt ? { resolvedAt: new Date(item.resolvedAt) } : {}),
        },
      });
    else if (item.resolvedAt)
      await db.alert.create({
        data: { deviceId, ...item, lastSeen: new Date(item.resolvedAt) },
      });
    else
      await db.$transaction([
        db.alert.create({ data: { deviceId, ...item } }),
        db.notification.create({
          data: {
            userId,
            title: item.title,
            message: item.description,
            href: "/dashboard/alerts",
          },
        }),
      ]);
    if (existing && !existing.resolvedAt && item.resolvedAt)
      await db.notification.create({
        data: {
          userId,
          title: `Resolved: ${item.title}`,
          message: "DESSMonitor supplied an alarm disappearance timestamp.",
          href: "/dashboard/alerts",
        },
      });
  }
  for (const alert of active)
    if (resolveMissing && !incoming.some((i) => i.key === alert.key))
      await db.$transaction([
        db.alert.update({ where: { id: alert.id }, data: { resolvedAt: now } }),
        db.notification.create({
          data: {
            userId,
            title: `Resolved: ${alert.title}`,
            message: "The condition is no longer reported.",
            href: "/dashboard/alerts",
          },
        }),
      ]);
}
export async function aggregateDay(
  deviceId: string,
  date: Date,
  timezone: string,
) {
  const { start, end } = dayBounds(dayKey(date, timezone), timezone);
  const rows = await db.deviceReading.findMany({
    where: {
      deviceId,
      deviceTimestamp: { gte: new Date(+start - 1800000), lte: end },
    },
    orderBy: { deviceTimestamp: "asc" },
  });
  const totals = integrate(rows, 1800, start, end);
  await db.energyAggregate.upsert({
    where: {
      deviceId_period_timezone_timestamp: {
        deviceId,
        period: "day",
        timezone,
        timestamp: start,
      },
    },
    create: { deviceId, period: "day", timezone, timestamp: start, ...totals },
    update: totals,
  });
  // Persist hourly buckets and monthly rollups for history and long-range queries.
  for (let t = +start; t < Math.min(+end, Date.now()); t += 3600000) {
    const hour = new Date(t);
    const hourEnd = new Date(t + 3600000);
    const subset = rows.filter(
      (r) =>
        +r.deviceTimestamp >= t - 1800000 && +r.deviceTimestamp <= t + 5400000,
    );
    const value = integrate(subset, 1800, hour, hourEnd);
    await db.energyAggregate.upsert({
      where: {
        deviceId_period_timezone_timestamp: {
          deviceId,
          period: "hour",
          timezone,
          timestamp: hour,
        },
      },
      create: { deviceId, period: "hour", timezone, timestamp: hour, ...value },
      update: value,
    });
  }
  const month = dayKey(date, timezone).slice(0, 7);
  const monthStart = dayBounds(month + "-01", timezone).start;
  const monthDate = new Date(month + "-01T12:00:00Z");
  monthDate.setUTCMonth(monthDate.getUTCMonth() + 1);
  const monthEnd = dayBounds(
    monthDate.toISOString().slice(0, 10),
    timezone,
  ).start;
  const days = await db.energyAggregate.findMany({
    where: {
      deviceId,
      period: "day",
      timezone,
      timestamp: { gte: monthStart, lt: monthEnd },
    },
  });
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
  const value = {
    solarWh: sum("solarWh"),
    loadWh: sum("loadWh"),
    importWh: sum("importWh"),
    exportWh: sum("exportWh"),
    chargeWh: sum("chargeWh"),
    dischargeWh: sum("dischargeWh"),
    peakSolarW: days.every((d) => d.peakSolarW === null)
      ? null
      : Math.max(
          ...days.flatMap((d) => (d.peakSolarW === null ? [] : [d.peakSolarW])),
        ),
    peakLoadW: days.every((d) => d.peakLoadW === null)
      ? null
      : Math.max(
          ...days.flatMap((d) => (d.peakLoadW === null ? [] : [d.peakLoadW])),
        ),
    coveredSeconds: days.reduce((n, d) => n + d.coveredSeconds, 0),
    sampleCount: days.reduce((n, d) => n + d.sampleCount, 0),
  };
  await db.energyAggregate.upsert({
    where: {
      deviceId_period_timezone_timestamp: {
        deviceId,
        period: "month",
        timezone,
        timestamp: monthStart,
      },
    },
    create: {
      deviceId,
      period: "month",
      timezone,
      timestamp: monthStart,
      ...value,
    },
    update: value,
  });
}
export async function syncIntegration(id: string) {
  const now = new Date();
  const claim = await db.solarIntegration.updateMany({
    where: {
      id,
      connected: true,
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
    },
    data: { leaseUntil: new Date(+now + 300000), lastAttempt: now },
  });
  if (!claim.count) return;
  const integration = await db.solarIntegration.findUniqueOrThrow({
    where: { id },
  });
  const job = await db.syncJob.create({
    data: { integrationId: id, status: "RUNNING" },
  });
  try {
    const provider = providerFor(integration);
    await provider.authenticate();
    let records = 0;
    const devices = await db.device.findMany({
      where: { collector: { plant: { integrationId: id } } },
      include: { collector: true },
    });
    for (const device of devices) {
      const ref = deviceRef(device);
      const raw = await provider.getLatestData(ref);
      if (raw) {
        const r = readingSchema.parse(raw);
        const timestamp = new Date(r.deviceTimestamp);
        const previous = await db.deviceReading.findFirst({
          where: { deviceId: device.id },
          orderBy: { deviceTimestamp: "desc" },
        });
        if (+timestamp > Date.now() + 60000) r.suspect = true;
        const inserted = await db.deviceReading.createMany({
          data: [
            {
              ...r,
              deviceId: device.id,
              deviceTimestamp: timestamp,
              receivedAt: new Date(r.receivedAt),
              processedAt: new Date(r.processedAt),
            },
          ],
          skipDuplicates: true,
        });
        records += inserted.count;
        if (!r.suspect && (!previous || timestamp > previous.deviceTimestamp))
          await db.device.update({
            where: { id: device.id },
            data: { lastSeen: timestamp },
          });
        if (inserted.count)
          await aggregateDay(device.id, timestamp, device.timezone);
      }
      if (provider.mode === "live") {
        try {
          const flow = await provider.getEnergyFlow(ref);
          if (flow)
            await db.device.update({
              where: { id: device.id },
              data: {
                energyFlow: energyFlowSchema.parse(flow),
                energyFlowAt: new Date(),
              },
            });
        } catch {
          console.warn(
            JSON.stringify({
              event: "energy-flow.unavailable",
              deviceId: device.id,
            }),
          );
        }
      }
      const controls = await provider.getControlFields(ref);
      await db.controlField.deleteMany({
        where: {
          deviceId: device.id,
          key: { notIn: controls.map((field) => field.key) },
        },
      });
      for (const field of controls)
        await db.controlField.upsert({
          where: { deviceId_key: { deviceId: device.id, key: field.key } },
          create: {
            deviceId: device.id,
            key: field.key,
            metadata: controlSchema.parse(field),
          },
          update: { metadata: controlSchema.parse(field) },
        });
      if (raw || provider.mode === "live")
        await processAlerts(
          device.id,
          integration.userId,
          await provider.getAlerts(ref),
          provider.mode === "mock",
        );
      if (
        provider.mode === "live" &&
        ["NOT_REQUESTED", "IMPORTING"].includes(device.historyStatus)
      ) {
        try {
          await db.device.update({
            where: { id: device.id },
            data: { historyStatus: "IMPORTING" },
          });
          const end = dayBounds(
            dayKey(new Date(), device.timezone),
            device.timezone,
          ).start;
          const history = await provider.getHistoricalData(
            ref,
            new Date(+end - 7 * 86400000),
            end,
          );
          for (let offset = 0; offset < history.length; offset += 300) {
            const batch = history.slice(offset, offset + 300).map((row) => ({
              ...readingSchema.parse(row),
              deviceId: device.id,
            }));
            const inserted = await db.deviceReading.createMany({
              data: batch,
              skipDuplicates: true,
            });
            records += inserted.count;
          }
          for (const day of new Set(
            history.map((row) =>
              dayKey(new Date(row.deviceTimestamp), device.timezone),
            ),
          ))
            await aggregateDay(
              device.id,
              dayBounds(day, device.timezone).start,
              device.timezone,
            );
          await db.device.update({
            where: { id: device.id },
            data: { historyStatus: "COMPLETE" },
          });
        } catch {
          await db.device.update({
            where: { id: device.id },
            data: { historyStatus: "UNAVAILABLE" },
          });
          console.warn(
            JSON.stringify({
              event: "history-import.unavailable",
              deviceId: device.id,
            }),
          );
        }
      }
    }
    const seconds = Math.max(
      10,
      Number(process.env.DESSMONITOR_SYNC_INTERVAL_SECONDS) || 120,
    );
    await db.$transaction([
      db.solarIntegration.update({
        where: { id },
        data: {
          lastSync: new Date(),
          nextSync: new Date(Date.now() + seconds * 1000),
          leaseUntil: null,
          lastError: null,
          failureCount: 0,
        },
      }),
      db.syncJob.update({
        where: { id: job.id },
        data: { status: "COMPLETE", finishedAt: new Date(), records },
      }),
    ]);
    console.log(
      JSON.stringify({ event: "sync.completed", integrationId: id, records }),
    );
  } catch (error) {
    const message =
      integration.mode === "mock" &&
      error instanceof Error &&
      error.message.startsWith("Simulated")
        ? error.message
        : "DESSMonitor synchronization failed. Check credentials, connectivity and supported protocol.";
    await db.$transaction([
      db.solarIntegration.update({
        where: { id },
        data: {
          leaseUntil: null,
          lastError: message,
          failureCount: { increment: 1 },
          nextSync: new Date(
            Date.now() +
              Math.min(900, 30 * 2 ** Math.min(integration.failureCount, 5)) *
                1000,
          ),
        },
      }),
      db.syncJob.update({
        where: { id: job.id },
        data: { status: "FAILED", finishedAt: new Date(), error: message },
      }),
    ]);
    if (!integration.lastError)
      await db.notification.create({
        data: {
          userId: integration.userId,
          title: "Synchronization failed",
          message,
          href: "/dashboard/settings",
        },
      });
    console.warn(JSON.stringify({ event: "sync.failed", integrationId: id }));
  }
}
export async function processCommands() {
  // A crash after submission is ambiguous. Never automatically replay physical writes.
  await db.controlAction.updateMany({
    where: {
      status: { in: ["SENDING", "SENT", "CONFIRMING"] },
      requestedAt: { lt: new Date(Date.now() - 300000) },
    },
    data: {
      status: "UNKNOWN",
      detail: "Worker interrupted. Device confirmation unavailable.",
      completedAt: new Date(),
    },
  });
  const pending = await db.controlAction.findMany({
    where: { status: "QUEUED" },
    take: 10,
    include: {
      device: {
        include: {
          collector: { include: { plant: { include: { integration: true } } } },
        },
      },
    },
  });
  for (const action of pending) {
    const claimed = await db.controlAction.updateMany({
      where: { id: action.id, status: "QUEUED" },
      data: { status: "SENDING" },
    });
    if (!claimed.count) continue;
    const transitions = [
      { status: "QUEUED", at: action.requestedAt.toISOString() },
      { status: "SENDING", at: new Date().toISOString() },
    ];
    const transition = async (status: string, detail: string) => {
      transitions.push({ status, at: new Date().toISOString() });
      await db.controlAction.update({
        where: { id: action.id },
        data: {
          status,
          detail,
          transitions,
          completedAt: ["APPLIED", "UNKNOWN", "FAILED"].includes(status)
            ? new Date()
            : null,
        },
      });
    };
    let submitted = false;
    try {
      const integration = action.device.collector.plant.integration;
      if (!integration.connected) throw new Error("Integration disconnected.");
      const user = await db.user.findUniqueOrThrow({
        where: { id: action.userId },
        include: { preference: true },
      });
      const provider = providerFor(integration);
      const ref = deviceRef(action.device);
      const field = (await provider.getControlFields(ref)).find(
        (f) => f.key === action.fieldKey,
      );
      if (!field) throw new Error("Setting no longer supported.");
      const { validateControl } = await import("./domain");
      const value = validateControl(
        field,
        action.requestedValue,
        user.role,
        user.preference?.safeMode ?? true,
      );
      if (JSON.stringify(field.value) !== JSON.stringify(action.oldValue))
        throw new Error(
          "Setting changed since confirmation. Refresh and try again.",
        );
      submitted = true;
      const response = await provider.setControlValue(ref, field, value);
      if (!response.accepted) {
        await transition("FAILED", response.detail);
        continue;
      }
      await transition("SENT", response.detail);
      if (response.state && provider.mode === "mock")
        await db.device.update({
          where: { id: action.deviceId },
          data: {
            mockState: { ...ref.state, ...response.state } as Record<
              string,
              string | number | boolean
            >,
          },
        });
      await transition("CONFIRMING", "Reading setting back from provider.");
      const updated = await db.device.findUniqueOrThrow({
        where: { id: action.deviceId },
        include: { collector: true },
      });
      const fields = await provider.getControlFields(deviceRef(updated));
      const readback = fields.find((f) => f.key === field.key);
      // Live generic descriptors do not prove physical application; that requires documented device readback.
      const verified = provider.mode === "mock" && readback?.value === value;
      await transition(
        verified ? "APPLIED" : "UNKNOWN",
        verified
          ? "Verified by a separate read of the simulated inverter state."
          : "Command accepted — device confirmation unavailable.",
      );
      for (const f of fields)
        await db.controlField.upsert({
          where: { deviceId_key: { deviceId: action.deviceId, key: f.key } },
          create: { deviceId: action.deviceId, key: f.key, metadata: f },
          update: { metadata: f },
        });
      await db.notification.create({
        data: {
          userId: action.userId,
          title: verified
            ? "Mock setting applied"
            : "Command needs verification",
          message: field.title,
          href: "/dashboard/controls",
        },
      });
      await db.solarIntegration.update({
        where: { id: integration.id },
        data: { nextSync: new Date() },
      });
    } catch {
      await transition(
        submitted ? "UNKNOWN" : "FAILED",
        submitted
          ? "Submission outcome uncertain. No automatic retry."
          : "Command could not be sent. Check connection, permissions, safe mode and current setting.",
      );
    }
    await db.auditLog.create({
      data: {
        userId: action.userId,
        event: "control.processed",
        metadata: { commandId: action.id },
      },
    });
  }
}
