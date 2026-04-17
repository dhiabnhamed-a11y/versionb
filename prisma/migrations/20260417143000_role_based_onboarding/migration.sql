-- Add company email domains for owner onboarding and same-domain access requests
ALTER TABLE "Company"
ADD COLUMN "emailDomain" TEXT;

UPDATE "Company" AS c
SET "emailDomain" = LOWER(SPLIT_PART(u."email", '@', 2))
FROM "User" AS u
WHERE c."ownerId" = u."id"
  AND c."emailDomain" IS NULL
  AND POSITION('@' IN u."email") > 0;

CREATE UNIQUE INDEX "Company_emailDomain_key" ON "Company"("emailDomain");

-- Track invite consumption explicitly while keeping the usedAt audit timestamp
ALTER TABLE "Invite"
ADD COLUMN "used" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Invite"
SET "used" = true
WHERE "usedAt" IS NOT NULL;

DROP INDEX IF EXISTS "Invite_companyId_usedAt_expiresAt_idx";
CREATE INDEX "Invite_companyId_used_expiresAt_idx" ON "Invite"("companyId", "used", "expiresAt");

-- Allow same-domain users to request admin approval before they receive an invite
CREATE TABLE "AccessRequest" (
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

CREATE UNIQUE INDEX "AccessRequest_inviteId_key" ON "AccessRequest"("inviteId");
CREATE INDEX "AccessRequest_companyId_status_createdAt_idx" ON "AccessRequest"("companyId", "status", "createdAt");
CREATE INDEX "AccessRequest_companyId_email_status_idx" ON "AccessRequest"("companyId", "email", "status");

ALTER TABLE "AccessRequest"
ADD CONSTRAINT "AccessRequest_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccessRequest"
ADD CONSTRAINT "AccessRequest_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccessRequest"
ADD CONSTRAINT "AccessRequest_inviteId_fkey"
FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
