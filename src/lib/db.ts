import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const globalDb = globalThis as unknown as { solarDb?: PrismaClient };
export const db =
  globalDb.solarDb ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 8,
    }),
  });
if (process.env.NODE_ENV !== "production") globalDb.solarDb = db;
