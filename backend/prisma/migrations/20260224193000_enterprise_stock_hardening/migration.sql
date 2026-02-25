-- CreateEnum
CREATE TYPE "StockResourceType" AS ENUM ('DEVICE', 'IDENTIFIER');

-- CreateEnum
CREATE TYPE "StockMovementAction" AS ENUM ('STOCK_CREATED', 'EXTENSION_STOCK_CREATED', 'RESERVED', 'ASSIGNED', 'RELEASED', 'CONFIGURED');

-- CreateEnum
CREATE TYPE "OutboxEventType" AS ENUM ('ORDER_ALLOCATED', 'STOCK_LOW', 'DEVICE_ACTIVATED', 'RESERVATION_RELEASED');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');

-- AlterTable
ALTER TABLE "business_systems" ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "reservationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "reservedAt" TIMESTAMP(3),
ADD COLUMN     "warehouseCode" TEXT NOT NULL DEFAULT 'MAIN';

-- AlterTable
ALTER TABLE "identifiers" ADD COLUMN     "reservationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "reservedAt" TIMESTAMP(3),
ADD COLUMN     "warehouseCode" TEXT NOT NULL DEFAULT 'MAIN';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "resourceType" "StockResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "deviceId" TEXT,
    "identifierId" TEXT,
    "orderId" TEXT,
    "action" "StockMovementAction" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "warehouseCode" TEXT,
    "actorId" TEXT,
    "ownerId" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "eventType" "OutboxEventType" NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "tenantId" TEXT,
    "systemId" TEXT,
    "orderId" TEXT,
    "deviceId" TEXT,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_endpoints" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "events" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastDeliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movements_resourceType_resourceId_idx" ON "stock_movements"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "stock_movements_systemId_action_idx" ON "stock_movements"("systemId", "action");

-- CreateIndex
CREATE INDEX "stock_movements_deviceId_idx" ON "stock_movements"("deviceId");

-- CreateIndex
CREATE INDEX "stock_movements_identifierId_idx" ON "stock_movements"("identifierId");

-- CreateIndex
CREATE INDEX "stock_movements_orderId_idx" ON "stock_movements"("orderId");

-- CreateIndex
CREATE INDEX "stock_movements_actorId_idx" ON "stock_movements"("actorId");

-- CreateIndex
CREATE INDEX "stock_movements_ownerId_idx" ON "stock_movements"("ownerId");

-- CreateIndex
CREATE INDEX "stock_movements_warehouseCode_idx" ON "stock_movements"("warehouseCode");

-- CreateIndex
CREATE INDEX "stock_movements_createdAt_idx" ON "stock_movements"("createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_eventType_status_idx" ON "outbox_events"("eventType", "status");

-- CreateIndex
CREATE INDEX "outbox_events_status_availableAt_idx" ON "outbox_events"("status", "availableAt");

-- CreateIndex
CREATE INDEX "outbox_events_aggregateType_aggregateId_idx" ON "outbox_events"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "outbox_events_tenantId_idx" ON "outbox_events"("tenantId");

-- CreateIndex
CREATE INDEX "outbox_events_systemId_idx" ON "outbox_events"("systemId");

-- CreateIndex
CREATE INDEX "outbox_events_orderId_idx" ON "outbox_events"("orderId");

-- CreateIndex
CREATE INDEX "outbox_events_deviceId_idx" ON "outbox_events"("deviceId");

-- CreateIndex
CREATE INDEX "webhook_endpoints_isActive_idx" ON "webhook_endpoints"("isActive");

-- CreateIndex
CREATE INDEX "webhook_endpoints_tenantId_idx" ON "webhook_endpoints"("tenantId");

-- CreateIndex
CREATE INDEX "devices_warehouseCode_idx" ON "devices"("warehouseCode");

-- CreateIndex
CREATE INDEX "devices_reservationExpiresAt_idx" ON "devices"("reservationExpiresAt");

-- CreateIndex
CREATE INDEX "devices_status_reservationExpiresAt_idx" ON "devices"("status", "reservationExpiresAt");

-- CreateIndex
CREATE INDEX "devices_systemId_warehouseCode_status_idx" ON "devices"("systemId", "warehouseCode", "status");

-- CreateIndex
CREATE INDEX "identifiers_warehouseCode_idx" ON "identifiers"("warehouseCode");

-- CreateIndex
CREATE INDEX "identifiers_reservationExpiresAt_idx" ON "identifiers"("reservationExpiresAt");

-- CreateIndex
CREATE INDEX "identifiers_status_reservationExpiresAt_idx" ON "identifiers"("status", "reservationExpiresAt");

-- CreateIndex
CREATE INDEX "identifiers_systemId_warehouseCode_status_idx" ON "identifiers"("systemId", "warehouseCode", "status");

-- CreateIndex
CREATE INDEX "orders_idempotencyKey_idx" ON "orders"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "orders_customerId_idempotencyKey_key" ON "orders"("customerId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "business_systems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_identifierId_fkey" FOREIGN KEY ("identifierId") REFERENCES "identifiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "business_systems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

