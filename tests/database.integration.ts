import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { processAlerts, syncIntegration } from "../src/lib/sync";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error(
      "Database integration tests require a local disposable test database.",
    );
  const user = await db.user.create({
    data: {
      name: "Database test fixture",
      email: `db-test-${randomUUID()}@example.local`,
    },
  });
  try {
    const connection = await db.solarIntegration.create({
      data: {
        userId: user.id,
        mode: "mock",
        label: "Automated test fixture",
        nextSync: new Date(Date.now() + 3600000),
        plants: {
          create: {
            externalId: "test",
            name: "Test",
            collectors: {
              create: {
                pn: "test",
                devices: {
                  create: {
                    sn: "test",
                    devcode: 8000,
                    devaddr: 1,
                    alias: "Test inverter",
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
    const device = connection.plants[0].collectors[0].devices[0];
    await test("alert acknowledgement and resolution are independent; unreadable results preserve state", async () => {
      const alarm = {
        key: "test-alarm",
        title: "Low battery",
        description: "Test alarm",
        severity: "WARNING" as const,
      };
      await processAlerts(device.id, user.id, [alarm]);
      await processAlerts(device.id, user.id, [alarm]);
      assert.equal(await db.alert.count({ where: { deviceId: device.id } }), 1);
      assert.equal(
        await db.notification.count({ where: { userId: user.id } }),
        1,
      );
      const active = await db.alert.findFirstOrThrow({
        where: { deviceId: device.id },
      });
      await db.alert.update({
        where: { id: active.id },
        data: { acknowledgedAt: new Date(), acknowledgedBy: user.name },
      });
      await processAlerts(device.id, user.id, null);
      assert.equal(
        (await db.alert.findUniqueOrThrow({ where: { id: active.id } }))
          .resolvedAt,
        null,
      );
      await processAlerts(device.id, user.id, []);
      const resolved = await db.alert.findUniqueOrThrow({
        where: { id: active.id },
      });
      assert.ok(resolved.resolvedAt);
      assert.ok(resolved.acknowledgedAt);
      await processAlerts(device.id, user.id, [alarm]);
      assert.equal(
        await db.alert.count({
          where: { deviceId: device.id, key: alarm.key },
        }),
        2,
      );
    });
    await test("vendor alarms require explicit disappearance evidence", async () => {
      const alarm = {
        key: "dess-test",
        title: "Vendor event",
        description: "Fixture",
        severity: "WARNING" as const,
        firstSeen: "2026-10-02T07:00:00Z",
        resolvedAt: null,
      };
      await processAlerts(device.id, user.id, [alarm], false);
      await processAlerts(device.id, user.id, [], false);
      assert.equal(
        (
          await db.alert.findFirstOrThrow({
            where: { deviceId: device.id, key: alarm.key },
          })
        ).resolvedAt,
        null,
      );
      await processAlerts(
        device.id,
        user.id,
        [{ ...alarm, resolvedAt: "2026-10-02T08:00:00Z" }],
        false,
      );
      await processAlerts(
        device.id,
        user.id,
        [{ ...alarm, resolvedAt: "2026-10-02T08:00:00Z" }],
        false,
      );
      assert.equal(
        await db.alert.count({
          where: { deviceId: device.id, key: alarm.key },
        }),
        1,
      );
      assert.equal(
        await db.notification.count({
          where: { userId: user.id, title: "Resolved: Vendor event" },
        }),
        1,
      );
    });
    await test("worker stores actual mock readings and respects a held synchronization lease", async () => {
      await syncIntegration(connection.id);
      assert.ok(
        await db.deviceReading.count({ where: { deviceId: device.id } }),
      );
      assert.equal(
        await db.controlField.count({ where: { deviceId: device.id } }),
        3,
      );
      const jobs = await db.syncJob.count({
        where: { integrationId: connection.id },
      });
      await db.solarIntegration.update({
        where: { id: connection.id },
        data: { leaseUntil: new Date(Date.now() + 300000) },
      });
      await syncIntegration(connection.id);
      assert.equal(
        await db.syncJob.count({ where: { integrationId: connection.id } }),
        jobs,
      );
      await db.solarIntegration.update({
        where: { id: connection.id },
        data: { leaseUntil: null },
      });
    });
    await test("offline and failed syncs preserve the device timestamp and cached telemetry", async () => {
      const before = await db.device.findUniqueOrThrow({
        where: { id: device.id },
      });
      const count = await db.deviceReading.count({
        where: { deviceId: device.id },
      });
      await db.solarIntegration.update({
        where: { id: connection.id },
        data: { scenario: "offline" },
      });
      await syncIntegration(connection.id);
      assert.equal(
        await db.deviceReading.count({ where: { deviceId: device.id } }),
        count,
      );
      assert.equal(
        (
          await db.device.findUniqueOrThrow({ where: { id: device.id } })
        ).lastSeen?.toISOString(),
        before.lastSeen?.toISOString(),
      );
      await db.solarIntegration.update({
        where: { id: connection.id },
        data: { scenario: "communication-failure" },
      });
      await syncIntegration(connection.id);
      const failed = await db.solarIntegration.findUniqueOrThrow({
        where: { id: connection.id },
      });
      assert.equal(failed.failureCount, 1);
      assert.ok(failed.lastError);
      assert.ok(failed.nextSync > new Date());
      assert.equal(
        await db.deviceReading.count({ where: { deviceId: device.id } }),
        count,
      );
    });
  } finally {
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
