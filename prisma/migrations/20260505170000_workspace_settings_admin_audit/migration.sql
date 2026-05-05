CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#0369a1',
    "backgroundColor" TEXT NOT NULL DEFAULT '#f7f8fa',
    "sidebarColor" TEXT NOT NULL DEFAULT '#ffffff',
    "themeMode" TEXT NOT NULL DEFAULT 'light',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminActionLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanySettings_companyId_key" ON "CompanySettings"("companyId");
CREATE INDEX "AdminActionLog_companyId_createdAt_idx" ON "AdminActionLog"("companyId", "createdAt");
CREATE INDEX "AdminActionLog_actorId_createdAt_idx" ON "AdminActionLog"("actorId", "createdAt");
CREATE INDEX "AdminActionLog_targetUserId_createdAt_idx" ON "AdminActionLog"("targetUserId", "createdAt");
CREATE INDEX "AdminActionLog_action_createdAt_idx" ON "AdminActionLog"("action", "createdAt");

ALTER TABLE "CompanySettings"
ADD CONSTRAINT "CompanySettings_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminActionLog"
ADD CONSTRAINT "AdminActionLog_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminActionLog"
ADD CONSTRAINT "AdminActionLog_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminActionLog"
ADD CONSTRAINT "AdminActionLog_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
