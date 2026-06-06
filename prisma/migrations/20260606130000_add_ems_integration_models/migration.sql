DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmsIntegrationType') THEN
    CREATE TYPE "EmsIntegrationType" AS ENUM (
      'CAD_MOTOROLA',
      'CAD_HEXAGON',
      'CAD_TYLER',
      'CAD_CENTRAL_SQUARE',
      'CAD_ZOLL',
      'CAD_RAPID_SOS',
      'CAD_CUSTOM',
      'EHR_EPIC',
      'EHR_CERNER',
      'EHR_ALLSCRIPTS',
      'EHR_MEDITECH',
      'EHR_CUSTOM',
      'FHIR',
      'HL7',
      'AVL_GPS',
      'CUSTOM_API',
      'CUSTOM_WEBHOOK'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmsIntegrationStatus') THEN
    CREATE TYPE "EmsIntegrationStatus" AS ENUM (
      'CONNECTED',
      'DISCONNECTED',
      'ERROR',
      'PENDING',
      'CONFIGURING'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmsWebhookEventType') THEN
    CREATE TYPE "EmsWebhookEventType" AS ENUM (
      'INCIDENT_CREATED',
      'INCIDENT_UPDATED',
      'DISPATCH_CREATED',
      'UNIT_STATUS_CHANGED',
      'PATIENT_UPDATED',
      'HOSPITAL_STATUS_CHANGED',
      'CUSTOM'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmsAuditAction') THEN
    CREATE TYPE "EmsAuditAction" AS ENUM (
      'EMS_INTEGRATION_CONFIGURED',
      'EMS_INTEGRATION_ENABLED',
      'EMS_INTEGRATION_DISABLED',
      'EMS_INTEGRATION_ERROR',
      'EMS_WEBHOOK_RECEIVED',
      'EMS_WEBHOOK_FORWARDED',
      'EMS_WEBHOOK_FAILED',
      'EMS_DATA_IMPORTED',
      'EMS_DATA_EXPORTED',
      'EMS_FIELD_MAPPING_CREATED',
      'EMS_FIELD_MAPPING_UPDATED',
      'EMS_FIELD_MAPPING_DELETED',
      'EMS_PATIENT_ACCESSED',
      'EMS_PATIENT_EXPORTED',
      'EMS_PATIENT_LINKED',
      'EMS_INCIDENT_ACCESSED',
      'EMS_API_KEY_ROTATED',
      'EMS_SYNC_STARTED',
      'EMS_SYNC_COMPLETED',
      'EMS_SYNC_FAILED',
      'EMS_SYNC_REPLAYED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "EmsIntegration" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "EmsIntegrationType" NOT NULL,
  "status" "EmsIntegrationStatus" NOT NULL DEFAULT 'PENDING',
  "version" INTEGER NOT NULL DEFAULT 1,
  "endpointUrl" TEXT,
  "authType" TEXT,
  "authConfig" JSONB,
  "apiKey" TEXT,
  "oauthConfig" JSONB,
  "webhookSecret" TEXT,
  "pollingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "pollingInterval" INTEGER,
  "retryCount" INTEGER NOT NULL DEFAULT 3,
  "retryDelayMs" INTEGER NOT NULL DEFAULT 5000,
  "rateLimit" INTEGER,
  "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
  "lastConnectedAt" TIMESTAMP(3),
  "lastErrorAt" TIMESTAMP(3),
  "lastErrorMessage" TEXT,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmsIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmsWebhookConfig" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "path" TEXT,
  "method" TEXT NOT NULL DEFAULT 'POST',
  "contentType" TEXT,
  "sourceSystem" TEXT,
  "sourceType" TEXT,
  "eventTypes" "EmsWebhookEventType"[] NOT NULL,
  "secretToken" TEXT,
  "allowedIps" TEXT,
  "requireAuth" BOOLEAN NOT NULL DEFAULT true,
  "ackMode" TEXT NOT NULL DEFAULT '200_OK',
  "ackBody" TEXT,
  "maxRetries" INTEGER NOT NULL DEFAULT 3,
  "deadLetterQueue" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmsWebhookConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmsFieldMapping" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "entityType" TEXT NOT NULL,
  "mappings" JSONB NOT NULL,
  "enumMappings" JSONB,
  "validationRules" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmsFieldMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmsAuditLog" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "integrationId" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "action" "EmsAuditAction" NOT NULL,
  "actorId" TEXT,
  "actorType" TEXT,
  "resourceType" TEXT,
  "resourceId" TEXT,
  "containsPhi" BOOLEAN NOT NULL DEFAULT false,
  "phiFields" TEXT,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "checksum" TEXT,
  "previousLogId" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "errorMessage" TEXT,
  CONSTRAINT "EmsAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmsIntegrationEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "webhookConfigId" TEXT,
  "eventType" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "rawPayload" JSONB,
  "transformedPayload" JSONB,
  "headers" JSONB,
  "signature" TEXT,
  "status" TEXT NOT NULL,
  "statusCode" INTEGER,
  "errorMessage" TEXT,
  "processingTimeMs" INTEGER,
  "idempotencyKey" TEXT,
  "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "lastRetryAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "EmsIntegrationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmsIntegration_companyId_type_key" ON "EmsIntegration"("companyId", "type");
CREATE INDEX IF NOT EXISTS "EmsIntegration_companyId_status_idx" ON "EmsIntegration"("companyId", "status");
CREATE INDEX IF NOT EXISTS "EmsIntegration_type_status_idx" ON "EmsIntegration"("type", "status");
CREATE INDEX IF NOT EXISTS "EmsWebhookConfig_integrationId_idx" ON "EmsWebhookConfig"("integrationId");
CREATE INDEX IF NOT EXISTS "EmsWebhookConfig_companyId_isEnabled_idx" ON "EmsWebhookConfig"("companyId", "isEnabled");
CREATE INDEX IF NOT EXISTS "EmsFieldMapping_integrationId_idx" ON "EmsFieldMapping"("integrationId");
CREATE INDEX IF NOT EXISTS "EmsFieldMapping_companyId_entityType_isActive_idx" ON "EmsFieldMapping"("companyId", "entityType", "isActive");
CREATE INDEX IF NOT EXISTS "EmsAuditLog_companyId_timestamp_idx" ON "EmsAuditLog"("companyId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "EmsAuditLog_companyId_action_idx" ON "EmsAuditLog"("companyId", "action");
CREATE INDEX IF NOT EXISTS "EmsAuditLog_companyId_resourceType_resourceId_idx" ON "EmsAuditLog"("companyId", "resourceType", "resourceId");
CREATE INDEX IF NOT EXISTS "EmsAuditLog_timestamp_idx" ON "EmsAuditLog"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "EmsAuditLog_containsPhi_idx" ON "EmsAuditLog"("containsPhi");
CREATE INDEX IF NOT EXISTS "EmsIntegrationEvent_integrationId_receivedAt_idx" ON "EmsIntegrationEvent"("integrationId", "receivedAt" DESC);
CREATE INDEX IF NOT EXISTS "EmsIntegrationEvent_companyId_status_idx" ON "EmsIntegrationEvent"("companyId", "status");
CREATE INDEX IF NOT EXISTS "EmsIntegrationEvent_idempotencyKey_idx" ON "EmsIntegrationEvent"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "EmsIntegrationEvent_receivedAt_idx" ON "EmsIntegrationEvent"("receivedAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmsIntegration_companyId_fkey') THEN
    ALTER TABLE "EmsIntegration"
      ADD CONSTRAINT "EmsIntegration_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "EmsCompany"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmsWebhookConfig_integrationId_fkey') THEN
    ALTER TABLE "EmsWebhookConfig"
      ADD CONSTRAINT "EmsWebhookConfig_integrationId_fkey"
      FOREIGN KEY ("integrationId") REFERENCES "EmsIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmsWebhookConfig_companyId_fkey') THEN
    ALTER TABLE "EmsWebhookConfig"
      ADD CONSTRAINT "EmsWebhookConfig_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "EmsCompany"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmsFieldMapping_integrationId_fkey') THEN
    ALTER TABLE "EmsFieldMapping"
      ADD CONSTRAINT "EmsFieldMapping_integrationId_fkey"
      FOREIGN KEY ("integrationId") REFERENCES "EmsIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmsFieldMapping_companyId_fkey') THEN
    ALTER TABLE "EmsFieldMapping"
      ADD CONSTRAINT "EmsFieldMapping_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "EmsCompany"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmsAuditLog_integrationId_fkey') THEN
    ALTER TABLE "EmsAuditLog"
      ADD CONSTRAINT "EmsAuditLog_integrationId_fkey"
      FOREIGN KEY ("integrationId") REFERENCES "EmsIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmsAuditLog_companyId_fkey') THEN
    ALTER TABLE "EmsAuditLog"
      ADD CONSTRAINT "EmsAuditLog_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "EmsCompany"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmsIntegrationEvent_integrationId_fkey') THEN
    ALTER TABLE "EmsIntegrationEvent"
      ADD CONSTRAINT "EmsIntegrationEvent_integrationId_fkey"
      FOREIGN KEY ("integrationId") REFERENCES "EmsIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmsIntegrationEvent_webhookConfigId_fkey') THEN
    ALTER TABLE "EmsIntegrationEvent"
      ADD CONSTRAINT "EmsIntegrationEvent_webhookConfigId_fkey"
      FOREIGN KEY ("webhookConfigId") REFERENCES "EmsWebhookConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmsIntegrationEvent_companyId_fkey') THEN
    ALTER TABLE "EmsIntegrationEvent"
      ADD CONSTRAINT "EmsIntegrationEvent_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "EmsCompany"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
