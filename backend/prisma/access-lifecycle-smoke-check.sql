/*
  Access Identifier Lifecycle - Post-Smoke SQL Verification

  How to use:
  1) Replace the values in the "params" CTE below.
  2) Run each query block in order.

  Expected smoke sequence:
  - assign identifier
  - remove assignment
  - reassign identifier
  - disable identifier (lost) with reason
*/

-- =========================================================
-- 0) Parameters (edit values)
-- =========================================================
WITH params AS (
  SELECT
    'REPLACE_OWNER_ID'::text AS owner_id,
    'REPLACE_IDENTIFIER_CODE'::text AS identifier_code,
    'RFID_PRESENCE'::"HardwareSystemCode" AS module_code
)
SELECT * FROM params;

-- =========================================================
-- 1) Current identifier state + active assignment snapshot
-- =========================================================
WITH params AS (
  SELECT
    'REPLACE_OWNER_ID'::text AS owner_id,
    'REPLACE_IDENTIFIER_CODE'::text AS identifier_code
)
SELECT
  i.id AS identifier_id,
  i."physicalIdentifier" AS identifier_code,
  i."lifecycleStatus" AS lifecycle_status,
  i."disabledAt" AS disabled_at,
  i."disabledById" AS disabled_by_id,
  i."disabledReason" AS disabled_reason,
  sa.id AS active_assignment_id,
  sa.module AS active_assignment_module,
  sa."employeeId" AS active_employee_id,
  sa."deviceId" AS active_device_id
FROM identifiers i
LEFT JOIN service_assignments sa
  ON sa."identifierId" = i.id
  AND sa."ownerId" = i."ownerId"
JOIN params p
  ON p.owner_id = i."ownerId"
WHERE i."physicalIdentifier" = p.identifier_code;

-- =========================================================
-- 2) PASS/FAIL invariants after "disable as lost"
-- =========================================================
WITH params AS (
  SELECT
    'REPLACE_OWNER_ID'::text AS owner_id,
    'REPLACE_IDENTIFIER_CODE'::text AS identifier_code
),
target AS (
  SELECT
    i.id,
    i."lifecycleStatus",
    i."disabledAt",
    i."disabledById",
    i."disabledReason",
    sa.id AS assignment_id
  FROM identifiers i
  LEFT JOIN service_assignments sa
    ON sa."identifierId" = i.id
    AND sa."ownerId" = i."ownerId"
  JOIN params p
    ON p.owner_id = i."ownerId"
  WHERE i."physicalIdentifier" = p.identifier_code
)
SELECT
  CASE
    WHEN COUNT(*) = 1 THEN 'PASS'
    ELSE 'FAIL'
  END AS identifier_found_check,
  CASE
    WHEN BOOL_AND("lifecycleStatus" = 'DISABLED_LOST') THEN 'PASS'
    ELSE 'FAIL'
  END AS lifecycle_status_check,
  CASE
    WHEN BOOL_AND(assignment_id IS NULL) THEN 'PASS'
    ELSE 'FAIL'
  END AS no_active_assignment_check,
  CASE
    WHEN BOOL_AND("disabledAt" IS NOT NULL)
      AND BOOL_AND("disabledById" IS NOT NULL)
      AND BOOL_AND(COALESCE("disabledReason", '') <> '')
    THEN 'PASS'
    ELSE 'FAIL'
  END AS disable_traceability_check
FROM target;

-- =========================================================
-- 3) Event counters for this identifier
-- =========================================================
WITH params AS (
  SELECT
    'REPLACE_OWNER_ID'::text AS owner_id,
    'REPLACE_IDENTIFIER_CODE'::text AS identifier_code
)
SELECT
  SUM(CASE WHEN h."eventType" = 'ASSIGNED' THEN 1 ELSE 0 END) AS assigned_events,
  SUM(CASE WHEN h."eventType" = 'REMOVED' THEN 1 ELSE 0 END) AS removed_events,
  SUM(CASE WHEN h."eventType" = 'REASSIGNED' THEN 1 ELSE 0 END) AS reassigned_events,
  SUM(CASE WHEN h."eventType" = 'IDENTIFIER_DISABLED' THEN 1 ELSE 0 END) AS disabled_events
FROM service_history_events h
JOIN identifiers i
  ON i.id = h."identifierId"
JOIN params p
  ON p.owner_id = h."ownerId"
WHERE i."physicalIdentifier" = p.identifier_code;

-- =========================================================
-- 4) Event timeline (chronological) for audit trail review
-- =========================================================
WITH params AS (
  SELECT
    'REPLACE_OWNER_ID'::text AS owner_id,
    'REPLACE_IDENTIFIER_CODE'::text AS identifier_code
)
SELECT
  h.id,
  h."occurredAt",
  h."eventType",
  h.action,
  h."employeeName",
  h."deviceName",
  h.reason,
  h."actorId",
  h.metadata
FROM service_history_events h
JOIN identifiers i
  ON i.id = h."identifierId"
JOIN params p
  ON p.owner_id = h."ownerId"
WHERE i."physicalIdentifier" = p.identifier_code
ORDER BY h."occurredAt" ASC, h.id ASC;

-- =========================================================
-- 5) Guardrail check: no employee should have >1 active assignment per module
-- =========================================================
WITH params AS (
  SELECT
    'REPLACE_OWNER_ID'::text AS owner_id,
    'RFID_PRESENCE'::"HardwareSystemCode" AS module_code
)
SELECT
  sa.module,
  sa."employeeId",
  e."firstName",
  e."lastName",
  COUNT(*) AS active_assignments
FROM service_assignments sa
JOIN employees e
  ON e.id = sa."employeeId"
JOIN params p
  ON p.owner_id = sa."ownerId"
  AND p.module_code = sa.module
GROUP BY sa.module, sa."employeeId", e."firstName", e."lastName"
HAVING COUNT(*) > 1;
