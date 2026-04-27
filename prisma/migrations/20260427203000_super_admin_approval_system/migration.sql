ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "country" TEXT,
ADD COLUMN IF NOT EXISTS "industry" TEXT,
ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "reviewNote" TEXT,
ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reviewedById" TEXT,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Company"
SET
  "status" = 'ACTIVE',
  "updatedAt" = COALESCE("updatedAt", "createdAt")
WHERE "status" = 'PENDING';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Company_reviewedById_fkey'
  ) THEN
    ALTER TABLE "Company"
    ADD CONSTRAINT "Company_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Company_registrationNumber_key" ON "Company"("registrationNumber");
CREATE INDEX IF NOT EXISTS "Company_status_createdAt_idx" ON "Company"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Company_name_registrationNumber_status_idx" ON "Company"("name", "registrationNumber", "status");
