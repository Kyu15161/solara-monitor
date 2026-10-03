import "dotenv/config";
import { db } from "../src/lib/db";
import { syncIntegration, processCommands } from "../src/lib/sync";
let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});
async function main() {
  console.log("Solara synchronization worker started.");
  while (!stopped) {
    try {
      await processCommands();
      const due = await db.solarIntegration.findMany({
        where: {
          connected: true,
          nextSync: { lte: new Date() },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
        },
        take: 10,
      });
      for (const item of due) await syncIntegration(item.id);
    } catch {
      console.error(JSON.stringify({ event: "worker.cycle.failed" }));
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  await db.$disconnect();
}
main().catch(() => process.exit(1));
