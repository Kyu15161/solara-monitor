-- DropIndex
DROP INDEX "EnergyAggregate_deviceId_period_timestamp_key";

-- AlterTable
ALTER TABLE "EnergyAggregate" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Baghdad';

-- CreateIndex
CREATE UNIQUE INDEX "EnergyAggregate_deviceId_period_timezone_timestamp_key" ON "EnergyAggregate"("deviceId", "period", "timezone", "timestamp");
