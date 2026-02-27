CREATE INDEX IF NOT EXISTS "roles_tenantId_createdAt_idx"
  ON "roles"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "users_tenantId_createdAt_idx"
  ON "users"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "devices_status_createdAt_idx"
  ON "devices"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "stock_movements_systemId_createdAt_idx"
  ON "stock_movements"("systemId", "createdAt");

CREATE INDEX IF NOT EXISTS "stock_movements_warehouseCode_createdAt_idx"
  ON "stock_movements"("warehouseCode", "createdAt");

CREATE INDEX IF NOT EXISTS "outbox_events_status_availableAt_createdAt_idx"
  ON "outbox_events"("status", "availableAt", "createdAt");

CREATE INDEX IF NOT EXISTS "webhook_endpoints_tenantId_createdAt_idx"
  ON "webhook_endpoints"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "webhook_endpoints_tenantId_isActive_createdAt_idx"
  ON "webhook_endpoints"("tenantId", "isActive", "createdAt");

CREATE INDEX IF NOT EXISTS "admin_action_logs_actorId_createdAt_idx"
  ON "admin_action_logs"("actorId", "createdAt");

CREATE INDEX IF NOT EXISTS "admin_action_logs_targetType_targetId_createdAt_idx"
  ON "admin_action_logs"("targetType", "targetId", "createdAt");
