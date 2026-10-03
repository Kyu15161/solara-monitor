import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { connectDemo } from "../src/lib/demo";
async function main() {
  if (
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.DATABASE_URL ?? "").hostname,
    )
  )
    throw new Error("Local test database required");
  for (let attempt = 0; attempt < 3; attempt++) {
    const user = await db.user.create({
      data: {
        name: "Demo test fixture",
        email: `seed-test-${randomUUID()}@example.local`,
      },
    });
    try {
      await connectDemo(user.id);
      const device = await db.device.findFirstOrThrow({
        where: { collector: { plant: { integration: { userId: user.id } } } },
      });
      assert.ok(
        (await db.deviceReading.count({ where: { deviceId: device.id } })) >
          8000,
        "Demo must seed all 90 days",
      );
      assert.equal(device.historyStatus, "COMPLETE");
      console.log(`Demo initialization ${attempt + 1}: complete`);
      if (attempt === 0) {
        const oldest = await db.deviceReading.findFirstOrThrow({
          where: { deviceId: device.id },
          orderBy: { deviceTimestamp: "asc" },
        });
        await db.deviceReading.delete({ where: { id: oldest.id } });
        await db.device.update({
          where: { id: device.id },
          data: { historyStatus: "IMPORTING" },
        });
        await connectDemo(user.id);
        assert.ok(
          await db.deviceReading.findUnique({
            where: {
              deviceId_deviceTimestamp: {
                deviceId: device.id,
                deviceTimestamp: oldest.deviceTimestamp,
              },
            },
          }),
          "Interrupted demo setup must restore missing history",
        );
        assert.equal(
          (await db.device.findUniqueOrThrow({ where: { id: device.id } }))
            .historyStatus,
          "COMPLETE",
        );
      }
    } catch (error) {
      if (typeof error === "object" && error && "code" in error)
        console.error(
          JSON.stringify({
            code: error.code,
            meta: "meta" in error ? error.meta : undefined,
          }),
        );
      throw new Error("Demo initialization failed");
    } finally {
      await db.user.delete({ where: { id: user.id } });
    }
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
