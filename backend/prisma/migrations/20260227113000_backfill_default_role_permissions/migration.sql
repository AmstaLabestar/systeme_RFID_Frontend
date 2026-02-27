UPDATE "roles"
SET "permissions" = '[
  "users.read",
  "users.manage",
  "roles.read",
  "roles.manage",
  "tenants.read",
  "tenants.manage"
]'::json
WHERE lower("name") = 'owner'
  AND (
    jsonb_typeof("permissions"::jsonb) <> 'array'
    OR jsonb_array_length("permissions"::jsonb) = 0
  );

UPDATE "roles"
SET "permissions" = '[
  "users.read",
  "users.manage",
  "roles.read",
  "roles.manage",
  "tenants.read",
  "tenants.manage",
  "admin.systems.read",
  "admin.systems.manage",
  "admin.inventory.read",
  "admin.stock.manage",
  "admin.logs.read",
  "admin.webhooks.read",
  "admin.webhooks.manage"
]'::json
WHERE lower("name") = 'admin'
  AND (
    jsonb_typeof("permissions"::jsonb) <> 'array'
    OR jsonb_array_length("permissions"::jsonb) = 0
  );

