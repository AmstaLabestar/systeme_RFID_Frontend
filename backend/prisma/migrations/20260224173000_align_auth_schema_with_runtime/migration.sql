-- Align auth runtime tables/columns with Prisma schema.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'AuthProvider'
  ) THEN
    CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE', 'MAGIC_LINK');
  END IF;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN IF NOT EXISTS "isTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "twoFactorSecretEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "twoFactorSecretIv" TEXT,
  ADD COLUMN IF NOT EXISTS "twoFactorSecretTag" TEXT,
  ADD COLUMN IF NOT EXISTS "twoFactorSecretHash" TEXT;

CREATE TABLE IF NOT EXISTS "magic_link_tokens" (
  "id" TEXT NOT NULL,
  "jti" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "magic_link_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "magic_link_tokens_jti_key" ON "magic_link_tokens"("jti");
CREATE INDEX IF NOT EXISTS "magic_link_tokens_userId_expiresAt_idx" ON "magic_link_tokens"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "magic_link_tokens_expiresAt_idx" ON "magic_link_tokens"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'magic_link_tokens_userId_fkey'
  ) THEN
    ALTER TABLE "magic_link_tokens"
      ADD CONSTRAINT "magic_link_tokens_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;
