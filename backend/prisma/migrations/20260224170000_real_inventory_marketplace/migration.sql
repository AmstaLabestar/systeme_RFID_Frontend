-- CreateEnum
CREATE TYPE "HardwareSystemCode" AS ENUM ('RFID_PRESENCE', 'RFID_PORTE', 'BIOMETRIE', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('IN_STOCK', 'RESERVED', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "IdentifierType" AS ENUM ('BADGE', 'EMPREINTE', 'SERRURE');

-- CreateEnum
CREATE TYPE "IdentifierStatus" AS ENUM ('IN_STOCK', 'RESERVED', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "OrderTargetType" AS ENUM ('DEVICE', 'IDENTIFIER_EXTENSION');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('RESERVED', 'ASSIGNED', 'RELEASED', 'FAILED');

-- CreateTable
CREATE TABLE "business_systems" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" "HardwareSystemCode" NOT NULL,
    "hasIdentifiers" BOOLEAN NOT NULL DEFAULT false,
    "identifiersPerDevice" INTEGER NOT NULL DEFAULT 0,
    "identifierType" "IdentifierType",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_systems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "macAddress" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'IN_STOCK',
    "ownerId" TEXT,
    "ownerTenantId" TEXT,
    "createdById" TEXT,
    "configuredName" TEXT,
    "configuredLocation" TEXT,
    "isConfigured" BOOLEAN NOT NULL DEFAULT false,
    "qrCodeToken" TEXT,
    "qrCodeDataUrl" TEXT,
    "assignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identifiers" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "deviceId" TEXT,
    "ownerId" TEXT,
    "ownerTenantId" TEXT,
    "createdById" TEXT,
    "type" "IdentifierType" NOT NULL,
    "physicalIdentifier" TEXT NOT NULL,
    "status" "IdentifierStatus" NOT NULL DEFAULT 'IN_STOCK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "targetType" "OrderTargetType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER,
    "currency" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocations" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "deviceId" TEXT,
    "identifierId" TEXT,
    "status" "AllocationStatus" NOT NULL DEFAULT 'ASSIGNED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_action_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_systems_code_key" ON "business_systems"("code");

-- CreateIndex
CREATE INDEX "business_systems_isActive_idx" ON "business_systems"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "devices_macAddress_key" ON "devices"("macAddress");

-- CreateIndex
CREATE UNIQUE INDEX "devices_qrCodeToken_key" ON "devices"("qrCodeToken");

-- CreateIndex
CREATE INDEX "devices_systemId_idx" ON "devices"("systemId");

-- CreateIndex
CREATE INDEX "devices_status_idx" ON "devices"("status");

-- CreateIndex
CREATE INDEX "devices_ownerId_idx" ON "devices"("ownerId");

-- CreateIndex
CREATE INDEX "devices_ownerTenantId_idx" ON "devices"("ownerTenantId");

-- CreateIndex
CREATE INDEX "devices_systemId_status_idx" ON "devices"("systemId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "identifiers_physicalIdentifier_key" ON "identifiers"("physicalIdentifier");

-- CreateIndex
CREATE INDEX "identifiers_systemId_idx" ON "identifiers"("systemId");

-- CreateIndex
CREATE INDEX "identifiers_status_idx" ON "identifiers"("status");

-- CreateIndex
CREATE INDEX "identifiers_ownerId_idx" ON "identifiers"("ownerId");

-- CreateIndex
CREATE INDEX "identifiers_ownerTenantId_idx" ON "identifiers"("ownerTenantId");

-- CreateIndex
CREATE INDEX "identifiers_deviceId_idx" ON "identifiers"("deviceId");

-- CreateIndex
CREATE INDEX "identifiers_systemId_status_idx" ON "identifiers"("systemId", "status");

-- CreateIndex
CREATE INDEX "identifiers_physicalIdentifier_idx" ON "identifiers"("physicalIdentifier");

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

-- CreateIndex
CREATE INDEX "orders_tenantId_idx" ON "orders"("tenantId");

-- CreateIndex
CREATE INDEX "orders_systemId_idx" ON "orders"("systemId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "allocations_orderId_idx" ON "allocations"("orderId");

-- CreateIndex
CREATE INDEX "allocations_customerId_idx" ON "allocations"("customerId");

-- CreateIndex
CREATE INDEX "allocations_deviceId_idx" ON "allocations"("deviceId");

-- CreateIndex
CREATE INDEX "allocations_identifierId_idx" ON "allocations"("identifierId");

-- CreateIndex
CREATE INDEX "allocations_status_idx" ON "allocations"("status");

-- CreateIndex
CREATE INDEX "admin_action_logs_actorId_idx" ON "admin_action_logs"("actorId");

-- CreateIndex
CREATE INDEX "admin_action_logs_targetType_targetId_idx" ON "admin_action_logs"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "business_systems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identifiers" ADD CONSTRAINT "identifiers_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "business_systems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identifiers" ADD CONSTRAINT "identifiers_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identifiers" ADD CONSTRAINT "identifiers_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identifiers" ADD CONSTRAINT "identifiers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "business_systems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_identifierId_fkey" FOREIGN KEY ("identifierId") REFERENCES "identifiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_action_logs" ADD CONSTRAINT "admin_action_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
