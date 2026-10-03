ALTER TABLE "Device" ADD COLUMN "energyFlow" JSONB,
ADD COLUMN "energyFlowAt" TIMESTAMP(3),
ADD COLUMN "historyStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED';
UPDATE "Device" SET "historyStatus" = 'COMPLETE' WHERE "id" IN (
 SELECT d."id" FROM "Device" d JOIN "Collector" c ON c."id"=d."collectorId"
 JOIN "Plant" p ON p."id"=c."plantId" JOIN "SolarIntegration" i ON i."id"=p."integrationId" WHERE i."mode"='mock'
);
