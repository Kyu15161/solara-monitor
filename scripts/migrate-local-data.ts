// One-time, read-only source transfer from the previous local PGlite service.
import "dotenv/config";
import { Client } from "pg";
import { z } from "zod";
const tables = [
  "User",
  "UserPreference",
  "Session",
  "ResetToken",
  "SolarIntegration",
  "Plant",
  "Collector",
  "Device",
  "DeviceReading",
  "EnergyAggregate",
  "Alert",
  "Notification",
  "ControlField",
  "ControlAction",
  "SyncJob",
  "AuditLog",
  "RateLimit",
];
async function main() {
  const sourceUrl = process.env.LOCAL_SOURCE_DATABASE_URL;
  const targetUrl = process.env.DATABASE_URL;
  if (!sourceUrl || !targetUrl || sourceUrl === targetUrl)
    throw new Error("Distinct source and destination URLs required.");
  for (const value of [sourceUrl, targetUrl])
    if (new URL(value).hostname !== "127.0.0.1")
      throw new Error("Only loopback development databases are permitted.");
  const source = new Client({ connectionString: sourceUrl }),
    target = new Client({ connectionString: targetUrl });
  await source.connect();
  await target.connect();
  try {
    await target.query("BEGIN");
    for (const table of tables) {
      if (
        Number(
          (await target.query(`SELECT count(*) AS n FROM "${table}"`)).rows[0]
            .n,
        ) !== 0
      )
        throw new Error(
          "Destination must be empty; no existing data is overwritten.",
        );
      const result = await source.query(
        `SELECT row_to_json(t) AS row FROM "${table}" t`,
      );
      for (let offset = 0; offset < result.rows.length; offset += 300) {
        const rows = result.rows
          .slice(offset, offset + 300)
          .map((r) => z.record(z.string(), z.unknown()).parse(r.row));
        if (!rows.length) continue;
        await target.query(
          `INSERT INTO "${table}" SELECT * FROM json_populate_recordset(NULL::"${table}", $1::json)`,
          [JSON.stringify(rows)],
        );
      }
      console.log(`${table}: ${result.rows.length} records copied`);
    }
    await target.query("COMMIT");
  } catch (error) {
    await target.query("ROLLBACK");
    throw error;
  } finally {
    await source.end();
    await target.end();
  }
}
main().catch(() => {
  console.error(
    "Transfer failed; destination changes were rolled back. Source was not modified.",
  );
  process.exitCode = 1;
});
