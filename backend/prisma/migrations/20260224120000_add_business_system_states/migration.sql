-- Persist dashboard business state in PostgreSQL per authenticated user.
CREATE TABLE "marketplace_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productStockById" JSONB NOT NULL,
    "devices" JSONB NOT NULL,
    "inventory" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "services_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employees" JSONB NOT NULL,
    "assignments" JSONB NOT NULL,
    "history" JSONB NOT NULL,
    "feedbackRecords" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketplace_states_userId_key" ON "marketplace_states"("userId");
CREATE UNIQUE INDEX "services_states_userId_key" ON "services_states"("userId");

ALTER TABLE "marketplace_states"
ADD CONSTRAINT "marketplace_states_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "services_states"
ADD CONSTRAINT "services_states_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
