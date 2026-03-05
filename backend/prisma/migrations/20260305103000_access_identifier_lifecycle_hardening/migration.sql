DO $$
BEGIN
  CREATE TYPE "IdentifierLifecycleStatus" AS ENUM ('ACTIVE', 'DISABLED_LOST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServiceHistoryEventType" AS ENUM (
    'ASSIGNED',
    'REMOVED',
    'REASSIGNED',
    'IDENTIFIER_DISABLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "identifiers"
  ADD COLUMN "lifecycleStatus" "IdentifierLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "disabledAt" TIMESTAMP(3),
  ADD COLUMN "disabledReason" TEXT,
  ADD COLUMN "disabledById" TEXT;

ALTER TABLE "service_history_events"
  ADD COLUMN "actorId" TEXT,
  ADD COLUMN "eventType" "ServiceHistoryEventType" NOT NULL DEFAULT 'ASSIGNED',
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "metadata" JSONB;

UPDATE "service_history_events"
SET "eventType" = CASE
  WHEN lower("action") LIKE '%reattribution%' THEN 'REASSIGNED'::"ServiceHistoryEventType"
  WHEN lower("action") LIKE '%retrait%' THEN 'REMOVED'::"ServiceHistoryEventType"
  ELSE 'ASSIGNED'::"ServiceHistoryEventType"
END
WHERE "eventType" = 'ASSIGNED';

CREATE INDEX "identifiers_lifecycleStatus_idx" ON "identifiers"("lifecycleStatus");
CREATE INDEX "identifiers_disabledById_idx" ON "identifiers"("disabledById");
CREATE INDEX "service_history_events_ownerId_eventType_occurredAt_idx"
  ON "service_history_events"("ownerId", "eventType", "occurredAt");
CREATE INDEX "service_history_events_actorId_occurredAt_idx"
  ON "service_history_events"("actorId", "occurredAt");

ALTER TABLE "identifiers"
  ADD CONSTRAINT "identifiers_disabledById_fkey"
  FOREIGN KEY ("disabledById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_history_events"
  ADD CONSTRAINT "service_history_events_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
