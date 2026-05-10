-- Client portal chain.
-- Adds a secure client-facing link and scoped feedback without giving clients
-- access to internal TASKIT user accounts.

ALTER TABLE "Client"
  ADD COLUMN "portalToken" TEXT,
  ADD COLUMN "portalEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Client_portalToken_key" ON "Client"("portalToken");

CREATE TABLE "ClientPortalComment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "campaignId" TEXT,
  "deliverableId" TEXT,
  "authorName" TEXT NOT NULL,
  "authorEmail" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientPortalComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientPortalComment_clientId_createdAt_idx" ON "ClientPortalComment"("clientId", "createdAt");
CREATE INDEX "ClientPortalComment_campaignId_createdAt_idx" ON "ClientPortalComment"("campaignId", "createdAt");
CREATE INDEX "ClientPortalComment_deliverableId_createdAt_idx" ON "ClientPortalComment"("deliverableId", "createdAt");

ALTER TABLE "ClientPortalComment"
  ADD CONSTRAINT "ClientPortalComment_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientPortalComment"
  ADD CONSTRAINT "ClientPortalComment_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientPortalComment"
  ADD CONSTRAINT "ClientPortalComment_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientPortalComment"
  ADD CONSTRAINT "ClientPortalComment_deliverableId_fkey"
  FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
