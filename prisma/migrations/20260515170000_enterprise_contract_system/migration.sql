-- TASKIT enterprise client contract system.
-- Additive-only contract infrastructure for versioned AI-assisted contracts,
-- multilingual clauses, signature readiness, audit history, and generation jobs.

CREATE TABLE "Contract" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "clientId" TEXT,
  "projectId" TEXT,
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "contractNumber" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'SERVICE_AGREEMENT',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "language" TEXT NOT NULL DEFAULT 'en',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "jurisdiction" TEXT,
  "governingLaw" TEXT,
  "confidentialityLevel" TEXT NOT NULL DEFAULT 'standard',
  "riskProfile" TEXT NOT NULL DEFAULT 'standard',
  "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
  "effectiveDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "renewalDate" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "viewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "signedAt" TIMESTAMP(3),
  "terminatedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractVersion" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "createdById" TEXT,
  "versionNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "locale" TEXT NOT NULL DEFAULT 'en',
  "title" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "renderedSnapshot" JSONB,
  "dataSnapshot" JSONB,
  "clauseSnapshot" JSONB,
  "pdfStorageKey" TEXT,
  "pdfChecksum" TEXT,
  "pdfByteLength" INTEGER,
  "model" TEXT NOT NULL DEFAULT 'taskit-contract-intelligence',
  "promptVersion" TEXT NOT NULL DEFAULT 'contract-v1',
  "legalDisclaimer" TEXT,
  "watermark" TEXT,
  "immutable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractTemplate" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "createdById" TEXT,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'SERVICE_AGREEMENT',
  "locale" TEXT NOT NULL DEFAULT 'en',
  "jurisdiction" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "version" INTEGER NOT NULL DEFAULT 1,
  "description" TEXT,
  "variables" JSONB,
  "clauseSet" JSONB,
  "branding" JSONB,
  "approvalRules" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractClause" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "templateId" TEXT,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "category" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL DEFAULT 'standard',
  "jurisdiction" TEXT,
  "serviceType" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "conditions" JSONB,
  "variables" JSONB,
  "status" TEXT NOT NULL DEFAULT 'active',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractClause_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractSignature" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "versionId" TEXT,
  "clientId" TEXT,
  "signerUserId" TEXT,
  "signerType" TEXT NOT NULL DEFAULT 'client',
  "signerName" TEXT NOT NULL,
  "signerEmail" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "method" TEXT NOT NULL DEFAULT 'prepared',
  "signingOrder" INTEGER NOT NULL DEFAULT 1,
  "signingUrlHash" TEXT,
  "provider" TEXT,
  "providerEnvelopeId" TEXT,
  "signatureData" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "requestedAt" TIMESTAMP(3),
  "viewedAt" TIMESTAMP(3),
  "signedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractSignature_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractAuditLog" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "versionId" TEXT,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "requestId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractGenerationJob" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "contractId" TEXT,
  "clientId" TEXT,
  "actorId" TEXT,
  "jobRunId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "contractType" TEXT NOT NULL DEFAULT 'SERVICE_AGREEMENT',
  "language" TEXT NOT NULL DEFAULT 'en',
  "riskProfile" TEXT NOT NULL DEFAULT 'standard',
  "input" JSONB,
  "missingFields" JSONB,
  "result" JSONB,
  "error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractGenerationJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Contract_companyId_contractNumber_key" ON "Contract"("companyId", "contractNumber");
CREATE INDEX "Contract_companyId_clientId_status_createdAt_idx" ON "Contract"("companyId", "clientId", "status", "createdAt");
CREATE INDEX "Contract_companyId_projectId_createdAt_idx" ON "Contract"("companyId", "projectId", "createdAt");
CREATE INDEX "Contract_companyId_status_expiryDate_idx" ON "Contract"("companyId", "status", "expiryDate");
CREATE INDEX "Contract_createdById_createdAt_idx" ON "Contract"("createdById", "createdAt");

CREATE UNIQUE INDEX "ContractVersion_contractId_versionNumber_key" ON "ContractVersion"("contractId", "versionNumber");
CREATE INDEX "ContractVersion_companyId_status_createdAt_idx" ON "ContractVersion"("companyId", "status", "createdAt");
CREATE INDEX "ContractVersion_companyId_contractId_versionNumber_idx" ON "ContractVersion"("companyId", "contractId", "versionNumber");

CREATE INDEX "ContractTemplate_companyId_status_type_locale_idx" ON "ContractTemplate"("companyId", "status", "type", "locale");
CREATE INDEX "ContractTemplate_companyId_name_idx" ON "ContractTemplate"("companyId", "name");

CREATE UNIQUE INDEX "ContractClause_companyId_key_locale_version_key" ON "ContractClause"("companyId", "key", "locale", "version");
CREATE INDEX "ContractClause_companyId_category_locale_status_idx" ON "ContractClause"("companyId", "category", "locale", "status");
CREATE INDEX "ContractClause_templateId_sortOrder_idx" ON "ContractClause"("templateId", "sortOrder");

CREATE INDEX "ContractSignature_companyId_status_createdAt_idx" ON "ContractSignature"("companyId", "status", "createdAt");
CREATE INDEX "ContractSignature_contractId_signingOrder_idx" ON "ContractSignature"("contractId", "signingOrder");
CREATE INDEX "ContractSignature_versionId_status_idx" ON "ContractSignature"("versionId", "status");
CREATE INDEX "ContractSignature_clientId_status_createdAt_idx" ON "ContractSignature"("clientId", "status", "createdAt");
CREATE INDEX "ContractSignature_signingUrlHash_idx" ON "ContractSignature"("signingUrlHash");

CREATE INDEX "ContractAuditLog_companyId_createdAt_idx" ON "ContractAuditLog"("companyId", "createdAt");
CREATE INDEX "ContractAuditLog_companyId_contractId_createdAt_idx" ON "ContractAuditLog"("companyId", "contractId", "createdAt");
CREATE INDEX "ContractAuditLog_versionId_createdAt_idx" ON "ContractAuditLog"("versionId", "createdAt");
CREATE INDEX "ContractAuditLog_actorId_createdAt_idx" ON "ContractAuditLog"("actorId", "createdAt");
CREATE INDEX "ContractAuditLog_action_createdAt_idx" ON "ContractAuditLog"("action", "createdAt");

CREATE INDEX "ContractGenerationJob_companyId_status_createdAt_idx" ON "ContractGenerationJob"("companyId", "status", "createdAt");
CREATE INDEX "ContractGenerationJob_companyId_clientId_createdAt_idx" ON "ContractGenerationJob"("companyId", "clientId", "createdAt");
CREATE INDEX "ContractGenerationJob_contractId_createdAt_idx" ON "ContractGenerationJob"("contractId", "createdAt");
CREATE INDEX "ContractGenerationJob_jobRunId_idx" ON "ContractGenerationJob"("jobRunId");

ALTER TABLE "Contract"
  ADD CONSTRAINT "Contract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Contract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Contract_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContractVersion"
  ADD CONSTRAINT "ContractVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractVersion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContractTemplate"
  ADD CONSTRAINT "ContractTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContractClause"
  ADD CONSTRAINT "ContractClause_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractClause_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractSignature"
  ADD CONSTRAINT "ContractSignature_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractSignature_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractSignature_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ContractVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractSignature_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractSignature_signerUserId_fkey" FOREIGN KEY ("signerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContractAuditLog"
  ADD CONSTRAINT "ContractAuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractAuditLog_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractAuditLog_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ContractVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContractGenerationJob"
  ADD CONSTRAINT "ContractGenerationJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractGenerationJob_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractGenerationJob_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractGenerationJob_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
