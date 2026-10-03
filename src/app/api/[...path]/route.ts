import { z } from "zod";
import { db } from "@/lib/db";
import { audit, ownedDevice, requireUser } from "@/lib/auth";
import {
  apiError,
  body,
  HttpError,
  rateLimit,
  requireOrigin,
} from "@/lib/security/http";
import { dashboardData } from "@/lib/data";
import { csvCell, dayBounds, dayKey, integrate } from "@/lib/analytics";
import {
  controlSchema,
  energyFlowSchema,
  scenarioSchema,
  validateControl,
} from "@/lib/domain";
import {
  providerFor,
  deviceRef,
  credentialsSchema,
} from "@/lib/dessmonitor/provider";
import { encrypt, checkPassword } from "@/lib/security/crypto";
import { connectDemo } from "@/lib/demo";
import { syncIntegration } from "@/lib/sync";
import { cookies } from "next/headers";
import { queryAggregates } from "@/lib/aggregate-query";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
function dateRange(url: URL, timezone: string) {
  const startText =
    url.searchParams.get("start") ??
    dayKey(new Date(Date.now() - 6 * 86400000), timezone);
  const endText = url.searchParams.get("end") ?? dayKey(new Date(), timezone);
  const schema = z.iso.date();
  const start = dayBounds(schema.parse(startText), timezone).start,
    end = dayBounds(schema.parse(endText), timezone).end;
  if (+end <= +start || +end - +start > 3660 * 86400000)
    throw new HttpError(400, "Choose a range up to ten years.");
  return { start, end };
}
export async function GET(req: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const path = (await params).path;
    const route = path.join("/");
    const url = new URL(req.url);
    if (route === "dashboard")
      return Response.json(
        await dashboardData(
          user.id,
          url.searchParams.get("device") ?? undefined,
        ),
        { headers: { "Cache-Control": "no-store" } },
      );
    if (route === "notifications")
      return Response.json(
        await db.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      );
    if (route === "audit")
      return Response.json(
        await db.auditLog.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      );
    if (route === "devices")
      return Response.json((await dashboardData(user.id)).devices);
    if (path[0] === "devices" && path[1]) {
      const device = await ownedDevice(user.id, path[1]);
      const action = path[2];
      if (
        action === "energy-flow" &&
        device.collector.plant.integration.mode === "live"
      )
        return Response.json({
          values: device.energyFlow
            ? energyFlowSchema.parse(device.energyFlow)
            : null,
          receivedAt: device.energyFlowAt,
          deviceTimestamp: null,
        });
      if (action === "latest" || action === "energy-flow")
        return Response.json(
          await db.deviceReading.findFirst({
            where: { deviceId: device.id },
            orderBy: { deviceTimestamp: "desc" },
          }),
        );
      if (action === "controls")
        return Response.json(
          (
            await db.controlField.findMany({ where: { deviceId: device.id } })
          ).map((f) => controlSchema.parse(f.metadata)),
        );
      if (action === "alerts")
        return Response.json(
          await db.alert.findMany({
            where: { deviceId: device.id },
            orderBy: { firstSeen: "desc" },
            take: 500,
          }),
        );
      if (
        action === "history" ||
        action === "analytics" ||
        action === "export"
      ) {
        const timezone = user.preference?.timezone || device.timezone;
        const { start, end } = dateRange(url, timezone);
        const period = z
          .enum(["raw", "5min", "15min", "hour", "day", "month"])
          .parse(url.searchParams.get("aggregation") ?? "day");
        await rateLimit(`history:${user.id}`, 60, 60);
        let rows: unknown[];
        if (["hour", "day", "month"].includes(period))
          rows = await queryAggregates(device.id, start, end, period, timezone);
        else {
          const readings = await db.deviceReading.findMany({
            where: {
              deviceId: device.id,
              deviceTimestamp: { gte: start, lt: end },
            },
            orderBy: { deviceTimestamp: "asc" },
            take: 20001,
          });
          if (readings.length > 20000)
            throw new HttpError(
              400,
              "Raw range exceeds 20,000 readings. Choose a shorter range or aggregation.",
            );
          rows = readings;
          if (["5min", "15min"].includes(period)) {
            const step = period === "5min" ? 300000 : 900000;
            if ((+end - +start) / step > 20000)
              throw new HttpError(
                400,
                "Choose a shorter range or a larger aggregation interval.",
              );
            const bins = [];
            for (let t = +start; t < Math.min(+end, Date.now()); t += step) {
              const subset = readings.filter(
                (r) =>
                  +r.deviceTimestamp >= t - 1800000 &&
                  +r.deviceTimestamp <= t + step + 1800000,
              );
              bins.push({
                timestamp: new Date(t),
                ...integrate(subset, 1800, new Date(t), new Date(t + step)),
              });
            }
            rows = bins;
          }
        }
        if (action === "export") {
          await rateLimit(`export:${user.id}`, 10, 60);
          await audit(user.id, "data.exported", {
            deviceId: device.id,
            period,
            start: start.toISOString(),
            end: end.toISOString(),
          });
          if (url.searchParams.get("format") === "json")
            return Response.json(rows, {
              headers: {
                "Content-Disposition":
                  'attachment; filename="solara-data.json"',
              },
            });
          const safeRows = rows.map((row) =>
            z.record(z.string(), z.unknown()).parse(row),
          );
          const columns = (
            safeRows[0] ? Object.keys(safeRows[0]) : ["timestamp"]
          ).filter((k) => !["id", "deviceId", "fields"].includes(k));
          const csv = [
            columns.map(csvCell).join(","),
            ...safeRows.map((r) =>
              columns
                .map((c) =>
                  csvCell(r[c] instanceof Date ? r[c].toISOString() : r[c]),
                )
                .join(","),
            ),
          ].join("\r\n");
          return new Response(csv, {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": 'attachment; filename="solara-data.csv"',
              "Cache-Control": "no-store",
            },
          });
        }
        const previousStart = new Date(+start - (+end - +start));
        const previous = await queryAggregates(
          device.id,
          previousStart,
          start,
          ["hour", "day", "month"].includes(period) ? period : "day",
          timezone,
        );
        return Response.json({ rows, previous, start, end });
      }
    }
    if (route === "backup") {
      await rateLimit(`backup:${user.id}`, 2, 60);
      const snapshot = await dashboardData(user.id);
      const audits = await db.auditLog.findMany({ where: { userId: user.id } });
      await audit(user.id, "account.exported");
      return Response.json(
        { version: 1, exportedAt: new Date(), ...snapshot, audits },
        {
          headers: {
            "Content-Disposition": 'attachment; filename="solara-account.json"',
          },
        },
      );
    }
    throw new HttpError(404, "Not found.");
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(req: Request, { params }: Context) {
  try {
    requireOrigin(req);
    const user = await requireUser();
    const path = (await params).path;
    const route = path.join("/");
    await rateLimit(`mutate:${user.id}`, 60, 60);
    if (route === "demo") {
      await connectDemo(user.id);
      await audit(user.id, "demo.connected");
      return Response.json({ ok: true });
    }
    if (route === "notifications/read") {
      const input = await body(req, z.object({ id: z.string().optional() }));
      await db.notification.updateMany({
        where: { userId: user.id, ...(input.id ? { id: input.id } : {}) },
        data: { readAt: new Date() },
      });
      return Response.json({ ok: true });
    }
    if (route === "alerts/acknowledge") {
      const input = await body(req, z.object({ id: z.string() }));
      const alert = await db.alert.findUnique({ where: { id: input.id } });
      if (!alert) throw new HttpError(404, "Alert not found.");
      await ownedDevice(user.id, alert.deviceId);
      if (user.role === "VIEWER")
        throw new HttpError(403, "Read-only account.");
      await db.alert.update({
        where: { id: alert.id },
        data: { acknowledgedAt: new Date(), acknowledgedBy: user.name },
      });
      await audit(user.id, "alert.acknowledged", { alertId: alert.id });
      return Response.json({ ok: true });
    }
    if (route === "preferences") {
      const input = await body(
        req,
        z.object({
          timezone: z
            .string()
            .max(80)
            .refine((v) => {
              try {
                new Intl.DateTimeFormat("en", { timeZone: v });
                return true;
              } catch {
                return false;
              }
            })
            .optional(),
          theme: z.enum(["light", "dark"]).optional(),
          temperatureUnit: z.enum(["C", "F"]).optional(),
          currency: z.enum(["IQD", "USD", "EUR", "GBP"]).optional(),
          importTariff: z.number().min(0).max(100000).nullable().optional(),
          exportTariff: z.number().min(0).max(100000).nullable().optional(),
          safeMode: z.boolean().optional(),
          widgets: z
            .array(z.enum(["metrics", "flow", "chart", "health", "alerts"]))
            .max(5)
            .refine(
              (values) => new Set(values).size === values.length,
              "Widgets must be unique",
            )
            .optional(),
          favorites: z.array(z.string().max(100)).max(20).optional(),
        }),
      );
      if (input.safeMode !== undefined && user.role !== "OWNER")
        throw new HttpError(
          403,
          "Only the owner can change Safe Control Mode.",
        );
      await db.userPreference.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...input },
        update: input,
      });
      if (input.safeMode !== undefined)
        await audit(user.id, "safe-mode.changed", { enabled: input.safeMode });
      return Response.json({ ok: true });
    }
    if (route === "account/profile") {
      const input = await body(
        req,
        z.object({ name: z.string().trim().min(2).max(80) }),
      );
      await db.user.update({ where: { id: user.id }, data: input });
      return Response.json({ ok: true });
    }
    if (route === "account/delete") {
      const input = await body(
        req,
        z.object({
          confirmation: z.literal("DELETE MY ACCOUNT"),
          password: z.string().optional(),
        }),
      );
      if (
        !user.isDemo &&
        (!user.passwordHash ||
          !(await checkPassword(input.password ?? "", user.passwordHash)))
      )
        throw new HttpError(403, "Password is incorrect.");
      await db.user.delete({ where: { id: user.id } });
      (await cookies()).delete("solara_session");
      return Response.json({ ok: true });
    }
    if (
      route === "sync" ||
      route === "simulation" ||
      route === "integrations/disconnect" ||
      route === "integrations/reconnect"
    ) {
      const input = await body(
        req,
        z.object({
          integrationId: z.string(),
          scenario: scenarioSchema.optional(),
          confirmed: z.boolean().optional(),
        }),
      );
      const integration = await db.solarIntegration.findFirst({
        where: { id: input.integrationId, userId: user.id },
      });
      if (!integration) throw new HttpError(404, "Integration not found.");
      if (user.role === "VIEWER")
        throw new HttpError(403, "Read-only account.");
      if (route === "simulation") {
        if (
          process.env.NODE_ENV === "production" ||
          integration.mode !== "mock" ||
          !input.scenario
        )
          throw new HttpError(
            403,
            "Simulation controls are only available for development demo systems.",
          );
        await db.solarIntegration.update({
          where: { id: integration.id },
          data: { scenario: input.scenario, nextSync: new Date() },
        });
        await syncIntegration(integration.id);
      }
      if (route === "sync") {
        await rateLimit(`sync:${integration.id}`, 1, 30);
        await db.solarIntegration.update({
          where: { id: integration.id },
          data: { nextSync: new Date() },
        });
      }
      if (
        route === "integrations/disconnect" ||
        route === "integrations/reconnect"
      ) {
        if (user.role !== "OWNER" || !input.confirmed)
          throw new HttpError(403, "Owner confirmation required.");
        await db.solarIntegration.update({
          where: { id: integration.id },
          data: {
            connected: route.endsWith("reconnect"),
            nextSync: new Date(),
          },
        });
        await audit(user.id, route, { integrationId: integration.id });
      }
      return Response.json({ ok: true });
    }
    if (route === "integrations/connect") {
      if (user.role !== "OWNER")
        throw new HttpError(
          403,
          "Only account owners can connect integrations.",
        );
      if (process.env.DESSMONITOR_MODE !== "live")
        throw new HttpError(
          409,
          "This installation is in mock mode. The server operator must enable live mode before connecting real credentials.",
        );
      const input = await body(req, credentialsSchema);
      await rateLimit(`connect:${user.id}`, 3, 3600);
      const encryptedCredentials = encrypt(input);
      const provider = providerFor({
        mode: "live",
        scenario: "sunny",
        encryptedCredentials,
      });
      await provider.authenticate();
      const projects = await provider.getProjects();
      const discovery = [];
      for (const project of projects) {
        const collectors = [];
        for (const collector of await provider.getCollectors(project.id))
          collectors.push({
            ...collector,
            devices: await provider.getDevices(collector.pn),
          });
        discovery.push({ ...project, collectors });
      }
      const integration = await db.solarIntegration.create({
        data: {
          userId: user.id,
          mode: "live",
          label: "DESSMonitor connection",
          encryptedCredentials,
          plants: {
            create: discovery.map((p) => ({
              externalId: p.id,
              name: p.name,
              timezone: p.timezone,
              collectors: {
                create: p.collectors.map((c) => ({
                  pn: c.pn,
                  devices: { create: c.devices },
                })),
              },
            })),
          },
        },
      });
      await audit(user.id, "dessmonitor.connected", {
        integrationId: integration.id,
      });
      return Response.json({ ok: true });
    }
    if (path[0] === "devices" && path[1]) {
      const device = await ownedDevice(user.id, path[1]);
      if (user.role === "VIEWER")
        throw new HttpError(403, "Read-only account.");
      if (path[2] === "alias") {
        const input = await body(
          req,
          z.object({ alias: z.string().trim().min(1).max(80) }),
        );
        await db.device.update({ where: { id: device.id }, data: input });
        return Response.json({ ok: true });
      }
      if (path[2] === "controls") {
        const input = await body(
          req,
          z.object({
            key: z.string(),
            value: z.union([z.string(), z.number(), z.boolean()]),
            oldValue: z.union([z.string(), z.number(), z.boolean()]),
            confirmed: z.literal(true),
            highImpactConfirmed: z.boolean().optional(),
            idempotencyKey: z.uuid(),
          }),
        );
        await rateLimit(`control:${user.id}`, 10, 60);
        if (!device.collector.plant.integration.connected)
          throw new HttpError(409, "Integration is disconnected.");
        const existing = await db.controlAction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          if (existing.userId !== user.id || existing.deviceId !== device.id)
            throw new HttpError(409, "Request already exists.");
          if (
            existing.fieldKey !== input.key ||
            existing.requestedValue !== input.value ||
            existing.oldValue !== input.oldValue
          )
            throw new HttpError(
              409,
              "This request identifier belongs to a different change.",
            );
          return Response.json(existing);
        }
        const field = (
          await providerFor(
            device.collector.plant.integration,
          ).getControlFields(deviceRef(device))
        ).find((f) => f.key === input.key);
        if (!field)
          throw new HttpError(
            400,
            "This setting is not supported by this inverter.",
          );
        let value: string | number | boolean;
        try {
          value = validateControl(
            field,
            input.value,
            user.role,
            user.preference?.safeMode ?? true,
          );
        } catch (e) {
          throw new HttpError(
            403,
            e instanceof Error ? e.message : "Invalid control.",
          );
        }
        if (field.highImpact && !input.highImpactConfirmed)
          throw new HttpError(
            400,
            "A second confirmation is required for this setting.",
          );
        if (field.value !== input.oldValue)
          throw new HttpError(
            409,
            "The current setting changed. Refresh before confirming.",
          );
        const action = await db.$transaction(async (tx) => {
          // Serialize submissions per inverter; never overlap physical writes.
          await tx.$queryRaw`SELECT "id" FROM "Device" WHERE "id" = ${device.id} FOR UPDATE`;
          const duplicate = await tx.controlAction.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
          });
          if (duplicate) {
            if (
              duplicate.userId !== user.id ||
              duplicate.deviceId !== device.id ||
              duplicate.fieldKey !== input.key ||
              duplicate.requestedValue !== input.value ||
              duplicate.oldValue !== input.oldValue
            )
              throw new HttpError(
                409,
                "This request identifier belongs to a different change.",
              );
            return duplicate;
          }
          if (
            await tx.controlAction.findFirst({
              where: {
                deviceId: device.id,
                status: { in: ["QUEUED", "SENDING", "SENT", "CONFIRMING"] },
              },
            })
          )
            throw new HttpError(
              409,
              "Wait for the current device command to finish before submitting another change.",
            );
          const command = await tx.controlAction.create({
            data: {
              deviceId: device.id,
              userId: user.id,
              idempotencyKey: input.idempotencyKey,
              fieldKey: field.key,
              fieldTitle: field.title,
              oldValue: field.value,
              requestedValue: value,
              transitions: [{ status: "QUEUED", at: new Date().toISOString() }],
            },
          });
          await tx.auditLog.create({
            data: {
              userId: user.id,
              event: "control.queued",
              metadata: {
                commandId: command.id,
                deviceId: device.id,
                setting: field.key,
                oldValue: field.value,
                requestedValue: value,
              },
            },
          });
          return command;
        });
        return Response.json(action, { status: 202 });
      }
    }
    throw new HttpError(404, "Not found.");
  } catch (error) {
    return apiError(error);
  }
}
