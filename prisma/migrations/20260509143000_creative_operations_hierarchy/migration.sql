-- Canonical creative-operations hierarchy:
-- Workspace(Company) -> Client -> Campaign(Project legacy table) -> Brief -> Deliverable -> Task -> Subtask.
--
-- This migration is intentionally additive around the legacy "Project" table so existing
-- production data and old API clients survive the migration window.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "Brief" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "clientId" TEXT,
  "createdById" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "objectives" JSONB,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Brief_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Deliverable" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL DEFAULT 'GENERAL',
  "status" TEXT NOT NULL DEFAULT 'INTERNAL_REVIEW',
  "revisionCount" INTEGER NOT NULL DEFAULT 0,
  "approvalState" TEXT NOT NULL DEFAULT 'PENDING',
  "outputSpecifications" JSONB,
  "dueAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliverableFile" (
  "id" TEXT NOT NULL,
  "deliverableId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "playbackUrl" TEXT,
  "thumbnailUrl" TEXT,
  "cloudinaryPublicId" TEXT,
  "type" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "duration" DOUBLE PRECISION,
  "width" INTEGER,
  "height" INTEGER,
  "format" TEXT,
  "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliverableFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliverableRevision" (
  "id" TEXT NOT NULL,
  "deliverableId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'INTERNAL_REVIEW',
  "changeNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliverableRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalDecision" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "deliverableId" TEXT NOT NULL,
  "clientId" TEXT,
  "decidedById" TEXT,
  "status" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliverableActivity" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "briefId" TEXT,
  "deliverableId" TEXT,
  "actorId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliverableActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowTemplate" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "deliverableType" TEXT NOT NULL DEFAULT 'GENERAL',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowTemplateStep" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL,
  "defaultPriority" TEXT NOT NULL DEFAULT 'MEDIUM',
  CONSTRAINT "WorkflowTemplateStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subtask" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'TODO',
  "assigneeId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Subtask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskDependency" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "dependsOnTaskId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Task" ADD COLUMN "deliverableId" TEXT;
ALTER TABLE "InvoiceItem" ADD COLUMN "deliverableId" TEXT;
ALTER TABLE "Comment" ADD COLUMN "deliverableFileId" TEXT;
ALTER TABLE "Comment" ADD COLUMN "timestampStart" DOUBLE PRECISION;
ALTER TABLE "Comment" ADD COLUMN "timestampEnd" DOUBLE PRECISION;
ALTER TABLE "Comment" ADD COLUMN "frame" INTEGER;
ALTER TABLE "Comment" ADD COLUMN "x" DOUBLE PRECISION;
ALTER TABLE "Comment" ADD COLUMN "y" DOUBLE PRECISION;
ALTER TABLE "Comment" ADD COLUMN "width" DOUBLE PRECISION;
ALTER TABLE "Comment" ADD COLUMN "height" DOUBLE PRECISION;
ALTER TABLE "Comment" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "Comment" ADD COLUMN "resolvedById" TEXT;

-- Campaign migration: every existing Project receives one imported Brief.
INSERT INTO "Brief" (
  "id",
  "companyId",
  "campaignId",
  "clientId",
  "title",
  "description",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('brief_', md5(p."id")),
  p."companyId",
  p."id",
  p."clientId",
  concat(p."title", ' brief'),
  p."description",
  'APPROVED',
  p."createdAt",
  p."updatedAt"
FROM "Project" p
WHERE NOT EXISTS (
  SELECT 1 FROM "Brief" b WHERE b."campaignId" = p."id"
);

-- Existing tasks are preserved as deliverable-scoped work. Each task receives a
-- deliverable under its campaign's imported brief so no historical task is orphaned.
INSERT INTO "Deliverable" (
  "id",
  "companyId",
  "campaignId",
  "briefId",
  "title",
  "description",
  "type",
  "status",
  "revisionCount",
  "approvalState",
  "dueAt",
  "deliveredAt",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('deliverable_', md5(t."id")),
  p."companyId",
  p."id",
  b."id",
  t."title",
  t."description",
  COALESCE(NULLIF(t."deliverableType", ''), 'GENERAL'),
  CASE
    WHEN t."stage" = 'DONE' THEN 'APPROVED'
    WHEN t."stage" = 'REVIEW' THEN 'INTERNAL_REVIEW'
    ELSE 'INTERNAL_REVIEW'
  END,
  CASE WHEN t."stage" = 'DONE' THEN 1 ELSE 0 END,
  CASE WHEN t."stage" = 'DONE' THEN 'APPROVED' ELSE 'PENDING' END,
  t."deadline",
  CASE WHEN t."stage" = 'DONE' THEN t."updatedAt" ELSE NULL END,
  t."createdAt",
  t."updatedAt"
FROM "Task" t
JOIN "Project" p ON p."id" = t."projectId"
JOIN LATERAL (
  SELECT b."id"
  FROM "Brief" b
  WHERE b."campaignId" = p."id"
  ORDER BY b."createdAt" ASC
  LIMIT 1
) b ON true
WHERE t."deliverableId" IS NULL;

UPDATE "Task" t
SET "deliverableId" = concat('deliverable_', md5(t."id"))
WHERE t."deliverableId" IS NULL;

ALTER TABLE "Task" ALTER COLUMN "deliverableId" SET NOT NULL;

INSERT INTO "DeliverableRevision" ("id", "deliverableId", "versionNumber", "status", "changeNote", "createdAt")
SELECT
  concat('revision_', replace(gen_random_uuid()::text, '-', '')),
  d."id",
  1,
  d."status",
  'Imported from legacy task workflow',
  d."createdAt"
FROM "Deliverable" d
WHERE NOT EXISTS (
  SELECT 1 FROM "DeliverableRevision" r WHERE r."deliverableId" = d."id" AND r."versionNumber" = 1
);

INSERT INTO "WorkflowTemplate" ("id", "companyId", "name", "description", "deliverableType", "isDefault")
SELECT
  concat('template_', replace(gen_random_uuid()::text, '-', '')),
  c."id",
  'Script - Edit - Review - Subtitles - Export',
  'Default recurring production workflow for creative deliverables.',
  'VIDEO',
  true
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1 FROM "WorkflowTemplate" wt
  WHERE wt."companyId" = c."id" AND wt."name" = 'Script - Edit - Review - Subtitles - Export'
);

INSERT INTO "WorkflowTemplateStep" ("id", "templateId", "title", "sortOrder", "defaultPriority")
SELECT concat('step_', replace(gen_random_uuid()::text, '-', '')), wt."id", step."title", step."sortOrder", step."priority"
FROM "WorkflowTemplate" wt
CROSS JOIN (
  VALUES
    ('Script', 1, 'MEDIUM'),
    ('Edit', 2, 'HIGH'),
    ('Review', 3, 'HIGH'),
    ('Subtitles', 4, 'MEDIUM'),
    ('Export', 5, 'HIGH')
) AS step("title", "sortOrder", "priority")
WHERE wt."name" = 'Script - Edit - Review - Subtitles - Export'
  AND NOT EXISTS (
    SELECT 1 FROM "WorkflowTemplateStep" s
    WHERE s."templateId" = wt."id" AND s."sortOrder" = step."sortOrder"
  );

CREATE INDEX "Brief_companyId_campaignId_status_createdAt_idx" ON "Brief"("companyId", "campaignId", "status", "createdAt");
CREATE INDEX "Brief_companyId_clientId_createdAt_idx" ON "Brief"("companyId", "clientId", "createdAt");
CREATE INDEX "Deliverable_companyId_campaignId_status_createdAt_idx" ON "Deliverable"("companyId", "campaignId", "status", "createdAt");
CREATE INDEX "Deliverable_briefId_status_createdAt_idx" ON "Deliverable"("briefId", "status", "createdAt");
CREATE INDEX "Deliverable_approvalState_updatedAt_idx" ON "Deliverable"("approvalState", "updatedAt");
CREATE INDEX "DeliverableFile_deliverableId_createdAt_idx" ON "DeliverableFile"("deliverableId", "createdAt");
CREATE INDEX "DeliverableFile_uploadedById_createdAt_idx" ON "DeliverableFile"("uploadedById", "createdAt");
CREATE INDEX "DeliverableFile_deliverableId_versionNumber_idx" ON "DeliverableFile"("deliverableId", "versionNumber");
CREATE UNIQUE INDEX "DeliverableRevision_deliverableId_versionNumber_key" ON "DeliverableRevision"("deliverableId", "versionNumber");
CREATE INDEX "DeliverableRevision_deliverableId_createdAt_idx" ON "DeliverableRevision"("deliverableId", "createdAt");
CREATE INDEX "ApprovalDecision_companyId_createdAt_idx" ON "ApprovalDecision"("companyId", "createdAt");
CREATE INDEX "ApprovalDecision_deliverableId_createdAt_idx" ON "ApprovalDecision"("deliverableId", "createdAt");
CREATE INDEX "ApprovalDecision_status_createdAt_idx" ON "ApprovalDecision"("status", "createdAt");
CREATE INDEX "DeliverableActivity_companyId_createdAt_idx" ON "DeliverableActivity"("companyId", "createdAt");
CREATE INDEX "DeliverableActivity_briefId_createdAt_idx" ON "DeliverableActivity"("briefId", "createdAt");
CREATE INDEX "DeliverableActivity_deliverableId_createdAt_idx" ON "DeliverableActivity"("deliverableId", "createdAt");
CREATE INDEX "DeliverableActivity_type_createdAt_idx" ON "DeliverableActivity"("type", "createdAt");
CREATE INDEX "WorkflowTemplate_companyId_deliverableType_idx" ON "WorkflowTemplate"("companyId", "deliverableType");
CREATE UNIQUE INDEX "WorkflowTemplate_companyId_name_key" ON "WorkflowTemplate"("companyId", "name");
CREATE INDEX "WorkflowTemplateStep_templateId_sortOrder_idx" ON "WorkflowTemplateStep"("templateId", "sortOrder");
CREATE INDEX "Subtask_taskId_sortOrder_idx" ON "Subtask"("taskId", "sortOrder");
CREATE INDEX "Subtask_assigneeId_status_idx" ON "Subtask"("assigneeId", "status");
CREATE UNIQUE INDEX "TaskDependency_taskId_dependsOnTaskId_key" ON "TaskDependency"("taskId", "dependsOnTaskId");
CREATE INDEX "TaskDependency_dependsOnTaskId_idx" ON "TaskDependency"("dependsOnTaskId");
CREATE INDEX "Task_deliverableId_stage_createdAt_idx" ON "Task"("deliverableId", "stage", "createdAt");
CREATE INDEX "Task_projectId_stage_createdAt_idx" ON "Task"("projectId", "stage", "createdAt");
CREATE INDEX "InvoiceItem_deliverableId_idx" ON "InvoiceItem"("deliverableId");
CREATE INDEX "Comment_deliverableFileId_timestampStart_createdAt_idx" ON "Comment"("deliverableFileId", "timestampStart", "createdAt");

ALTER TABLE "Brief" ADD CONSTRAINT "Brief_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "Brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliverableFile" ADD CONSTRAINT "DeliverableFile_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliverableFile" ADD CONSTRAINT "DeliverableFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliverableRevision" ADD CONSTRAINT "DeliverableRevision_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeliverableActivity" ADD CONSTRAINT "DeliverableActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliverableActivity" ADD CONSTRAINT "DeliverableActivity_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "Brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliverableActivity" ADD CONSTRAINT "DeliverableActivity_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliverableActivity" ADD CONSTRAINT "DeliverableActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplateStep" ADD CONSTRAINT "WorkflowTemplateStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subtask" ADD CONSTRAINT "Subtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subtask" ADD CONSTRAINT "Subtask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_deliverableFileId_fkey" FOREIGN KEY ("deliverableFileId") REFERENCES "DeliverableFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
