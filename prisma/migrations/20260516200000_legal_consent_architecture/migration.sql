CREATE TYPE "LegalConsentType" AS ENUM (
  'TERMS_OF_SERVICE',
  'PRIVACY_POLICY',
  'COOKIE_POLICY',
  'MARKETING_EMAILS',
  'AI_USAGE_DISCLOSURE'
);

CREATE TABLE "LegalConsent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyId" TEXT,
  "consentType" "LegalConsentType" NOT NULL,
  "documentVersion" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "locale" TEXT,
  "consentHash" TEXT NOT NULL,
  "requestId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'SIGNUP',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalDocumentVersion" (
  "id" TEXT NOT NULL,
  "documentType" "LegalConsentType" NOT NULL,
  "version" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "contentHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "requiresReacceptance" BOOLEAN NOT NULL DEFAULT false,
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "publishedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalConsent_consentHash_key" ON "LegalConsent"("consentHash");
CREATE UNIQUE INDEX "LegalConsent_userId_consentType_documentVersion_key" ON "LegalConsent"("userId", "consentType", "documentVersion");
CREATE INDEX "LegalConsent_companyId_consentType_acceptedAt_idx" ON "LegalConsent"("companyId", "consentType", "acceptedAt");
CREATE INDEX "LegalConsent_userId_acceptedAt_idx" ON "LegalConsent"("userId", "acceptedAt");
CREATE INDEX "LegalConsent_consentType_documentVersion_acceptedAt_idx" ON "LegalConsent"("consentType", "documentVersion", "acceptedAt");

CREATE UNIQUE INDEX "LegalDocumentVersion_documentType_version_key" ON "LegalDocumentVersion"("documentType", "version");
CREATE INDEX "LegalDocumentVersion_documentType_isActive_idx" ON "LegalDocumentVersion"("documentType", "isActive");
CREATE INDEX "LegalDocumentVersion_requiresReacceptance_effectiveAt_idx" ON "LegalDocumentVersion"("requiresReacceptance", "effectiveAt");

ALTER TABLE "LegalConsent" ADD CONSTRAINT "LegalConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalConsent" ADD CONSTRAINT "LegalConsent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalDocumentVersion" ADD CONSTRAINT "LegalDocumentVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_legal_consent_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'LegalConsent records are immutable audit evidence and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LegalConsent_prevent_update"
BEFORE UPDATE ON "LegalConsent"
FOR EACH ROW EXECUTE FUNCTION prevent_legal_consent_mutation();

CREATE TRIGGER "LegalConsent_prevent_delete"
BEFORE DELETE ON "LegalConsent"
FOR EACH ROW EXECUTE FUNCTION prevent_legal_consent_mutation();

