-- ============================================================
-- TASKIT production schema repair
-- Run in Supabase SQL Editor when production was created from an older
-- supabase-migration.sql and alert/push endpoints return 500s.
-- This script is additive/idempotent; it does not drop application data.
-- ============================================================

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS "authUserId" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "User_authUserId_key" ON "User"("authUserId");

ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "companyType" TEXT NOT NULL DEFAULT 'OTHER',
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "emailDomain" TEXT,
ADD COLUMN IF NOT EXISTS "country" TEXT,
ADD COLUMN IF NOT EXISTS "industry" TEXT,
ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT,
ADD COLUMN IF NOT EXISTS "reviewNote" TEXT,
ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Company_emailDomain_key" ON "Company"("emailDomain");
CREATE UNIQUE INDEX IF NOT EXISTS "Company_registrationNumber_key" ON "Company"("registrationNumber");
CREATE INDEX IF NOT EXISTS "Company_status_createdAt_idx" ON "Company"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Company_name_registrationNumber_status_idx" ON "Company"("name", "registrationNumber", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Company_reviewedById_fkey') THEN
    ALTER TABLE "Company"
    ADD CONSTRAINT "Company_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Alert" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Alert_recipientId_idx" ON "Alert"("recipientId");
CREATE INDEX IF NOT EXISTS "Alert_senderId_idx" ON "Alert"("senderId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Alert_senderId_fkey') THEN
    ALTER TABLE "Alert"
    ADD CONSTRAINT "Alert_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Alert_recipientId_fkey') THEN
    ALTER TABLE "Alert"
    ADD CONSTRAINT "Alert_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PushToken" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userAgent" TEXT,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushToken_token_key" ON "PushToken"("token");
CREATE INDEX IF NOT EXISTS "PushToken_userId_idx" ON "PushToken"("userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PushToken_userId_fkey') THEN
    ALTER TABLE "PushToken"
    ADD CONSTRAINT "PushToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
