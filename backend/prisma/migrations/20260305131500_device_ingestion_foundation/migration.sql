-- CreateTable
CREATE TABLE "device_ingestion_keys" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdById" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_ingestion_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_event_inbox" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "ingestionKeyId" TEXT,
    "systemCode" "HardwareSystemCode" NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_event_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_event_store" (
    "id" TEXT NOT NULL,
    "inboxId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "systemCode" "HardwareSystemCode" NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "sourceDeviceMac" TEXT,
    "sourceSequence" BIGINT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "rawEvent" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_event_store_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_ingestion_keys_deviceId_key" ON "device_ingestion_keys"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "device_ingestion_keys_keyHash_key" ON "device_ingestion_keys"("keyHash");

-- CreateIndex
CREATE INDEX "device_ingestion_keys_createdById_idx" ON "device_ingestion_keys"("createdById");

-- CreateIndex
CREATE INDEX "device_ingestion_keys_revokedAt_idx" ON "device_ingestion_keys"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "device_event_inbox_ownerId_deviceId_eventId_key"
  ON "device_event_inbox"("ownerId", "deviceId", "eventId");

-- CreateIndex
CREATE INDEX "device_event_inbox_ownerId_deviceId_receivedAt_idx"
  ON "device_event_inbox"("ownerId", "deviceId", "receivedAt");

-- CreateIndex
CREATE INDEX "device_event_inbox_ownerId_systemCode_receivedAt_idx"
  ON "device_event_inbox"("ownerId", "systemCode", "receivedAt");

-- CreateIndex
CREATE INDEX "device_event_inbox_eventType_occurredAt_idx"
  ON "device_event_inbox"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "device_event_inbox_ingestionKeyId_receivedAt_idx"
  ON "device_event_inbox"("ingestionKeyId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "device_event_store_inboxId_key" ON "device_event_store"("inboxId");

-- CreateIndex
CREATE INDEX "device_event_store_ownerId_systemCode_occurredAt_idx"
  ON "device_event_store"("ownerId", "systemCode", "occurredAt");

-- CreateIndex
CREATE INDEX "device_event_store_ownerId_eventType_occurredAt_idx"
  ON "device_event_store"("ownerId", "eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "device_event_store_deviceId_occurredAt_idx"
  ON "device_event_store"("deviceId", "occurredAt");

-- CreateIndex
CREATE INDEX "device_event_store_eventType_occurredAt_idx"
  ON "device_event_store"("eventType", "occurredAt");

-- AddForeignKey
ALTER TABLE "device_ingestion_keys"
  ADD CONSTRAINT "device_ingestion_keys_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "devices"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_ingestion_keys"
  ADD CONSTRAINT "device_ingestion_keys_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_event_inbox"
  ADD CONSTRAINT "device_event_inbox_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_event_inbox"
  ADD CONSTRAINT "device_event_inbox_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "devices"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_event_inbox"
  ADD CONSTRAINT "device_event_inbox_ingestionKeyId_fkey"
  FOREIGN KEY ("ingestionKeyId") REFERENCES "device_ingestion_keys"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_event_store"
  ADD CONSTRAINT "device_event_store_inboxId_fkey"
  FOREIGN KEY ("inboxId") REFERENCES "device_event_inbox"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_event_store"
  ADD CONSTRAINT "device_event_store_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_event_store"
  ADD CONSTRAINT "device_event_store_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "devices"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
