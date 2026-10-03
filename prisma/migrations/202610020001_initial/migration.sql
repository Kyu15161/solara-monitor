-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Baghdad',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "temperatureUnit" TEXT NOT NULL DEFAULT 'C',
    "currency" TEXT NOT NULL DEFAULT 'IQD',
    "importTariff" DOUBLE PRECISION,
    "exportTariff" DOUBLE PRECISION,
    "safeMode" BOOLEAN NOT NULL DEFAULT true,
    "widgets" JSONB NOT NULL DEFAULT '["metrics","flow","chart","health","alerts"]',
    "favorites" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SolarIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "encryptedCredentials" TEXT,
    "connected" BOOLEAN NOT NULL DEFAULT true,
    "scenario" TEXT NOT NULL DEFAULT 'sunny',
    "lastSync" TIMESTAMP(3),
    "lastAttempt" TIMESTAMP(3),
    "nextSync" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolarIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Baghdad',

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collector" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "pn" TEXT NOT NULL,

    CONSTRAINT "Collector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "collectorId" TEXT NOT NULL,
    "sn" TEXT NOT NULL,
    "devcode" INTEGER NOT NULL,
    "devaddr" INTEGER NOT NULL,
    "alias" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Baghdad',
    "model" TEXT,
    "firmware" TEXT,
    "capacityW" DOUBLE PRECISION,
    "batteryWh" DOUBLE PRECISION,
    "mockState" JSONB NOT NULL DEFAULT '{"mode":"self-use","chargeCurrent":40,"gridCharge":false}',
    "lastSeen" TIMESTAMP(3),

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceReading" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceTimestamp" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pvPowerW" DOUBLE PRECISION,
    "loadPowerW" DOUBLE PRECISION,
    "batteryPowerW" DOUBLE PRECISION,
    "batterySoc" DOUBLE PRECISION,
    "gridPowerW" DOUBLE PRECISION,
    "gridVoltage" DOUBLE PRECISION,
    "gridFrequency" DOUBLE PRECISION,
    "temperatureC" DOUBLE PRECISION,
    "operatingMode" TEXT,
    "suspect" BOOLEAN NOT NULL DEFAULT false,
    "fields" JSONB NOT NULL,

    CONSTRAINT "DeviceReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnergyAggregate" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "solarWh" DOUBLE PRECISION,
    "loadWh" DOUBLE PRECISION,
    "importWh" DOUBLE PRECISION,
    "exportWh" DOUBLE PRECISION,
    "chargeWh" DOUBLE PRECISION,
    "dischargeWh" DOUBLE PRECISION,
    "peakSolarW" DOUBLE PRECISION,
    "peakLoadW" DOUBLE PRECISION,
    "coveredSeconds" DOUBLE PRECISION NOT NULL,
    "sampleCount" INTEGER NOT NULL,

    CONSTRAINT "EnergyAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'DEVICE',
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlField" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "ControlField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlAction" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldTitle" TEXT NOT NULL,
    "oldValue" JSONB NOT NULL,
    "requestedValue" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "detail" TEXT,
    "transitions" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ControlAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "records" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "SolarIntegration_connected_nextSync_idx" ON "SolarIntegration"("connected", "nextSync");

-- CreateIndex
CREATE UNIQUE INDEX "Plant_integrationId_externalId_key" ON "Plant"("integrationId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Collector_plantId_pn_key" ON "Collector"("plantId", "pn");

-- CreateIndex
CREATE UNIQUE INDEX "Device_collectorId_sn_devcode_devaddr_key" ON "Device"("collectorId", "sn", "devcode", "devaddr");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceReading_deviceId_deviceTimestamp_key" ON "DeviceReading"("deviceId", "deviceTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "EnergyAggregate_deviceId_period_timestamp_key" ON "EnergyAggregate"("deviceId", "period", "timestamp");

-- CreateIndex
CREATE INDEX "Alert_deviceId_resolvedAt_idx" ON "Alert"("deviceId", "resolvedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "ControlField_deviceId_key_key" ON "ControlField"("deviceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ControlAction_idempotencyKey_key" ON "ControlAction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ControlAction_deviceId_requestedAt_idx" ON "ControlAction"("deviceId", "requestedAt");

-- CreateIndex
CREATE INDEX "SyncJob_integrationId_startedAt_idx" ON "SyncJob"("integrationId", "startedAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResetToken" ADD CONSTRAINT "ResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarIntegration" ADD CONSTRAINT "SolarIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "SolarIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collector" ADD CONSTRAINT "Collector_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceReading" ADD CONSTRAINT "DeviceReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergyAggregate" ADD CONSTRAINT "EnergyAggregate_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlField" ADD CONSTRAINT "ControlField_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlAction" ADD CONSTRAINT "ControlAction_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "SolarIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
