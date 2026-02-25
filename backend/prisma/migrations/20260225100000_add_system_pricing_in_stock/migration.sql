ALTER TABLE "business_systems"
ADD COLUMN "deviceUnitPriceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "extensionUnitPriceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'XOF';

UPDATE "business_systems"
SET
  "deviceUnitPriceCents" = CASE "code"
    WHEN 'RFID_PRESENCE' THEN 21000
    WHEN 'RFID_PORTE' THEN 20000
    WHEN 'BIOMETRIE' THEN 20000
    WHEN 'FEEDBACK' THEN 15000
    ELSE "deviceUnitPriceCents"
  END,
  "extensionUnitPriceCents" = CASE "code"
    WHEN 'RFID_PRESENCE' THEN 1000
    WHEN 'RFID_PORTE' THEN 1000
    WHEN 'BIOMETRIE' THEN 1000
    WHEN 'FEEDBACK' THEN 0
    ELSE "extensionUnitPriceCents"
  END,
  "currency" = 'XOF';
