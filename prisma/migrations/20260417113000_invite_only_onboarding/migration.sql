-- Add auth-linked user id for Supabase-side guardrails and future RLS support
ALTER TABLE "User"
ADD COLUMN "authUserId" UUID;

CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");

-- Invite-only onboarding for company-managed access
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "usedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invite_code_key" ON "Invite"("code");
CREATE INDEX "Invite_companyId_invitedEmail_idx" ON "Invite"("companyId", "invitedEmail");
CREATE INDEX "Invite_companyId_usedAt_expiresAt_idx" ON "Invite"("companyId", "usedAt", "expiresAt");

ALTER TABLE "Invite"
ADD CONSTRAINT "Invite_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invite"
ADD CONSTRAINT "Invite_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invite"
ADD CONSTRAINT "Invite_usedById_fkey"
FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
