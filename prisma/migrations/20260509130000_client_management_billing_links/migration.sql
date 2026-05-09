CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "avatarUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientActivity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientActivity_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Project" ADD COLUMN "clientId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "clientId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "campaignId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "briefId" TEXT;

CREATE INDEX "Client_companyId_status_createdAt_idx" ON "Client"("companyId", "status", "createdAt");
CREATE INDEX "Client_companyId_companyName_idx" ON "Client"("companyId", "companyName");
CREATE INDEX "Client_companyId_email_idx" ON "Client"("companyId", "email");
CREATE INDEX "ClientActivity_companyId_createdAt_idx" ON "ClientActivity"("companyId", "createdAt");
CREATE INDEX "ClientActivity_clientId_createdAt_idx" ON "ClientActivity"("clientId", "createdAt");
CREATE INDEX "ClientActivity_actorId_createdAt_idx" ON "ClientActivity"("actorId", "createdAt");
CREATE INDEX "ClientActivity_type_createdAt_idx" ON "ClientActivity"("type", "createdAt");
CREATE INDEX "Project_companyId_clientId_idx" ON "Project"("companyId", "clientId");
CREATE INDEX "Invoice_companyId_clientId_createdAt_idx" ON "Invoice"("companyId", "clientId", "createdAt");
CREATE INDEX "Invoice_companyId_campaignId_createdAt_idx" ON "Invoice"("companyId", "campaignId", "createdAt");
CREATE INDEX "Invoice_companyId_briefId_createdAt_idx" ON "Invoice"("companyId", "briefId", "createdAt");

ALTER TABLE "Client"
ADD CONSTRAINT "Client_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientActivity"
ADD CONSTRAINT "ClientActivity_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientActivity"
ADD CONSTRAINT "ClientActivity_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientActivity"
ADD CONSTRAINT "ClientActivity_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Project"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_briefId_fkey"
FOREIGN KEY ("briefId") REFERENCES "Task"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
