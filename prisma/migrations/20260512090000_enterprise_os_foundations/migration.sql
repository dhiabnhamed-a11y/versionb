-- Enterprise operating-system foundations:
-- unified activities, audit trails, notification preferences, queue observability,
-- search indexing, and cached analytics metrics.

ALTER TABLE "Activity"
  ADD COLUMN "companyId" TEXT,
  ADD COLUMN "entityType" TEXT NOT NULL DEFAULT 'task',
  ADD COLUMN "entityId" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "source" TEXT;

ALTER TABLE "Activity" ALTER COLUMN "taskId" DROP NOT NULL;
ALTER TABLE "Activity" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Activity" DROP CONSTRAINT IF EXISTS "Activity_taskId_fkey";
ALTER TABLE "Activity" DROP CONSTRAINT IF EXISTS "Activity_userId_fkey";

ALTER TABLE "Activity"
  ADD CONSTRAINT "Activity_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Activity"
  ADD CONSTRAINT "Activity_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Activity"
  ADD CONSTRAINT "Activity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Activity"
SET "companyId" = "Project"."companyId",
    "entityId" = "Activity"."taskId",
    "entityType" = 'task'
FROM "Task"
JOIN "Project" ON "Project"."id" = "Task"."projectId"
WHERE "Activity"."taskId" = "Task"."id";

CREATE INDEX "Activity_companyId_createdAt_idx" ON "Activity"("companyId", "createdAt");
CREATE INDEX "Activity_companyId_entityType_entityId_createdAt_idx" ON "Activity"("companyId", "entityType", "entityId", "createdAt");
CREATE INDEX "Activity_taskId_createdAt_idx" ON "Activity"("taskId", "createdAt");
CREATE INDEX "Activity_userId_createdAt_idx" ON "Activity"("userId", "createdAt");
CREATE INDEX "Activity_action_createdAt_idx" ON "Activity"("action", "createdAt");

ALTER TABLE "Alert"
  ADD COLUMN "companyId" TEXT,
  ADD COLUMN "readAt" TIMESTAMP(3),
  ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'in_app',
  ADD COLUMN "deliveryState" TEXT NOT NULL DEFAULT 'READY',
  ADD COLUMN "entityType" TEXT,
  ADD COLUMN "entityId" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "scheduledFor" TIMESTAMP(3);

ALTER TABLE "Alert"
  ADD CONSTRAINT "Alert_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Alert_recipientId_read_createdAt_idx" ON "Alert"("recipientId", "read", "createdAt");
CREATE INDEX "Alert_companyId_createdAt_idx" ON "Alert"("companyId", "createdAt");
CREATE INDEX "Alert_companyId_entityType_entityId_idx" ON "Alert"("companyId", "entityType", "entityId");
CREATE INDEX "Alert_priority_deliveryState_scheduledFor_idx" ON "Alert"("priority", "deliveryState", "scheduledFor");

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "digestMode" TEXT NOT NULL DEFAULT 'realtime',
  "quietHours" JSONB,
  "channels" JSONB,
  "mutedEntities" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

ALTER TABLE "NotificationPreference"
  ADD CONSTRAINT "NotificationPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "requestId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");
CREATE INDEX "AuditLog_companyId_entityType_entityId_createdAt_idx" ON "AuditLog"("companyId", "entityType", "entityId", "createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "JobRun" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "queue" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "externalId" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "payload" JSONB,
  "result" JSONB,
  "error" TEXT,
  "runAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobRun_queue_status_runAt_idx" ON "JobRun"("queue", "status", "runAt");
CREATE INDEX "JobRun_companyId_status_createdAt_idx" ON "JobRun"("companyId", "status", "createdAt");
CREATE INDEX "JobRun_entityType_entityId_idx" ON "JobRun"("entityType", "entityId");
CREATE INDEX "JobRun_externalId_idx" ON "JobRun"("externalId");

ALTER TABLE "JobRun"
  ADD CONSTRAINT "JobRun_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SearchIndex" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "content" TEXT,
  "href" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SearchIndex_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SearchIndex_companyId_entityType_entityId_key" ON "SearchIndex"("companyId", "entityType", "entityId");
CREATE INDEX "SearchIndex_companyId_entityType_idx" ON "SearchIndex"("companyId", "entityType");
CREATE INDEX "SearchIndex_companyId_updatedAt_idx" ON "SearchIndex"("companyId", "updatedAt");
CREATE INDEX "SearchIndex_companyId_title_idx" ON "SearchIndex"("companyId", "title");

ALTER TABLE "SearchIndex"
  ADD CONSTRAINT "SearchIndex_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AnalyticsMetric" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'workspace',
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "value" JSONB NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalyticsMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsMetric_companyId_key_scope_periodStart_periodEnd_key"
  ON "AnalyticsMetric"("companyId", "key", "scope", "periodStart", "periodEnd");
CREATE INDEX "AnalyticsMetric_companyId_key_computedAt_idx" ON "AnalyticsMetric"("companyId", "key", "computedAt");
CREATE INDEX "AnalyticsMetric_expiresAt_idx" ON "AnalyticsMetric"("expiresAt");

ALTER TABLE "AnalyticsMetric"
  ADD CONSTRAINT "AnalyticsMetric_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Task_projectId_assigneeId_stage_deadline_idx" ON "Task"("projectId", "assigneeId", "stage", "deadline");
CREATE INDEX "Task_assigneeId_stage_deadline_idx" ON "Task"("assigneeId", "stage", "deadline");
CREATE INDEX "Task_projectId_deadline_idx" ON "Task"("projectId", "deadline");
CREATE INDEX "Task_deliverableId_updatedAt_idx" ON "Task"("deliverableId", "updatedAt");
CREATE INDEX "Project_companyId_updatedAt_idx" ON "Project"("companyId", "updatedAt");
CREATE INDEX "Project_companyId_createdAt_idx" ON "Project"("companyId", "createdAt");
CREATE INDEX "Deliverable_companyId_approvalState_dueAt_idx" ON "Deliverable"("companyId", "approvalState", "dueAt");
CREATE INDEX "Deliverable_campaignId_dueAt_idx" ON "Deliverable"("campaignId", "dueAt");
