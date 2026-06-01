-- Workspace-scoped pricing and Dodo billing fields.
-- TASKIT stores workspaces in the "Company" table.
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "planId" VARCHAR(50);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "billingType" VARCHAR(20);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "isolationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "isolationType" VARCHAR(20);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "subscriptionId" VARCHAR(100);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "nextBillingDate" TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS "Company_subscriptionId_key" ON "Company"("subscriptionId");
