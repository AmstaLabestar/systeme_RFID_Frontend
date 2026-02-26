DO $$
BEGIN
  CREATE TYPE "FeedbackSentiment" AS ENUM ('NEGATIVE', 'NEUTRAL', 'POSITIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "FeedbackSource" AS ENUM ('BUTTON', 'QR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "employees" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "normalizedFullName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_assignments" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "module" "HardwareSystemCode" NOT NULL,
  "deviceId" TEXT NOT NULL,
  "identifierId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_history_events" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "module" "HardwareSystemCode" NOT NULL,
  "deviceId" TEXT NOT NULL,
  "identifierId" TEXT,
  "employeeId" TEXT,
  "employeeName" TEXT NOT NULL,
  "identifierCode" TEXT NOT NULL,
  "deviceName" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "service_history_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feedback_events" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "sentiment" "FeedbackSentiment" NOT NULL,
  "source" "FeedbackSource" NOT NULL DEFAULT 'BUTTON',
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "feedback_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employees_ownerId_idx" ON "employees"("ownerId");
CREATE UNIQUE INDEX "employees_ownerId_normalizedFullName_key" ON "employees"("ownerId", "normalizedFullName");

CREATE UNIQUE INDEX "service_assignments_identifierId_key" ON "service_assignments"("identifierId");
CREATE INDEX "service_assignments_ownerId_module_idx" ON "service_assignments"("ownerId", "module");
CREATE INDEX "service_assignments_ownerId_employeeId_idx" ON "service_assignments"("ownerId", "employeeId");
CREATE INDEX "service_assignments_deviceId_idx" ON "service_assignments"("deviceId");
CREATE INDEX "service_assignments_employeeId_idx" ON "service_assignments"("employeeId");

CREATE INDEX "service_history_events_ownerId_module_occurredAt_idx" ON "service_history_events"("ownerId", "module", "occurredAt");
CREATE INDEX "service_history_events_deviceId_occurredAt_idx" ON "service_history_events"("deviceId", "occurredAt");
CREATE INDEX "service_history_events_ownerId_occurredAt_idx" ON "service_history_events"("ownerId", "occurredAt");

CREATE INDEX "feedback_events_ownerId_deviceId_createdAt_idx" ON "feedback_events"("ownerId", "deviceId", "createdAt");
CREATE INDEX "feedback_events_deviceId_createdAt_idx" ON "feedback_events"("deviceId", "createdAt");
CREATE INDEX "feedback_events_ownerId_createdAt_idx" ON "feedback_events"("ownerId", "createdAt");

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_assignments"
  ADD CONSTRAINT "service_assignments_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_assignments"
  ADD CONSTRAINT "service_assignments_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "devices"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_assignments"
  ADD CONSTRAINT "service_assignments_identifierId_fkey"
  FOREIGN KEY ("identifierId") REFERENCES "identifiers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_assignments"
  ADD CONSTRAINT "service_assignments_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_history_events"
  ADD CONSTRAINT "service_history_events_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_history_events"
  ADD CONSTRAINT "service_history_events_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "devices"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_history_events"
  ADD CONSTRAINT "service_history_events_identifierId_fkey"
  FOREIGN KEY ("identifierId") REFERENCES "identifiers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_history_events"
  ADD CONSTRAINT "service_history_events_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "feedback_events"
  ADD CONSTRAINT "feedback_events_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "feedback_events"
  ADD CONSTRAINT "feedback_events_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "devices"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "webhook_endpoints"
  ADD COLUMN "secretEncrypted" TEXT,
  ADD COLUMN "secretIv" TEXT,
  ADD COLUMN "secretTag" TEXT,
  ADD COLUMN "secretHash" TEXT;

ALTER TABLE "webhook_endpoints"
  DROP COLUMN "secret";

DROP TABLE IF EXISTS "services_states" CASCADE;
DROP TABLE IF EXISTS "marketplace_states" CASCADE;
