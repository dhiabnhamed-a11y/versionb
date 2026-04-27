-- Repair onboarding schema drift on databases that missed the role-based onboarding migration.
-- This keeps public-email companies unbound to a shared emailDomain so the unique index can be restored safely.

ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "emailDomain" TEXT;

WITH owner_domains AS (
  SELECT
    c."id" AS company_id,
    CASE
      WHEN POSITION('@' IN u."email") > 0 THEN LOWER(SPLIT_PART(u."email", '@', 2))
      ELSE NULL
    END AS domain
  FROM "Company" AS c
  INNER JOIN "User" AS u ON u."id" = c."ownerId"
),
domain_counts AS (
  SELECT
    domain,
    COUNT(*)::INT AS domain_count
  FROM owner_domains
  WHERE domain IS NOT NULL
  GROUP BY domain
),
resolved_domains AS (
  SELECT
    od.company_id,
    CASE
      WHEN od.domain IS NULL THEN NULL
      WHEN od.domain = ANY (
        ARRAY[
          'gmail.com',
          'yahoo.com',
          'hotmail.com',
          'outlook.com',
          'live.com',
          'icloud.com',
          'me.com',
          'msn.com',
          'aol.com',
          'proton.me',
          'protonmail.com'
        ]::TEXT[]
      ) THEN NULL
      WHEN COALESCE(dc.domain_count, 0) > 1 THEN NULL
      ELSE od.domain
    END AS email_domain
  FROM owner_domains AS od
  LEFT JOIN domain_counts AS dc ON dc.domain = od.domain
)
UPDATE "Company" AS c
SET "emailDomain" = rd.email_domain
FROM resolved_domains AS rd
WHERE c."id" = rd.company_id
  AND c."emailDomain" IS DISTINCT FROM rd.email_domain;

CREATE UNIQUE INDEX IF NOT EXISTS "Company_emailDomain_key" ON "Company"("emailDomain");

ALTER TABLE "Invite"
ADD COLUMN IF NOT EXISTS "used" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Invite"
SET "used" = true
WHERE "usedAt" IS NOT NULL
  AND "used" = false;

DROP INDEX IF EXISTS "Invite_companyId_usedAt_expiresAt_idx";
CREATE INDEX IF NOT EXISTS "Invite_companyId_used_expiresAt_idx" ON "Invite"("companyId", "used", "expiresAt");

CREATE TABLE IF NOT EXISTS "AccessRequest" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "inviteId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccessRequest_inviteId_key" ON "AccessRequest"("inviteId");
CREATE INDEX IF NOT EXISTS "AccessRequest_companyId_status_createdAt_idx" ON "AccessRequest"("companyId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "AccessRequest_companyId_email_status_idx" ON "AccessRequest"("companyId", "email", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AccessRequest_companyId_fkey'
  ) THEN
    ALTER TABLE "AccessRequest"
    ADD CONSTRAINT "AccessRequest_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AccessRequest_reviewedById_fkey'
  ) THEN
    ALTER TABLE "AccessRequest"
    ADD CONSTRAINT "AccessRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AccessRequest_inviteId_fkey'
  ) THEN
    ALTER TABLE "AccessRequest"
    ADD CONSTRAINT "AccessRequest_inviteId_fkey"
    FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
