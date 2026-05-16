-- Operational AI Platform core.
-- Additive-only: execution steps, typed tool executions, approvals, observations,
-- and decisions. Existing chat, finance, contract, project, invoice, and client
-- tables are untouched for backward compatibility.

CREATE TABLE "AiStep" (
  "id" TEXT NOT NULL,
  "aiRunId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "phase" TEXT NOT NULL DEFAULT 'PLAN',
  "toolName" TEXT,
  "actionKind" TEXT,
  "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
  "permissionState" TEXT NOT NULL DEFAULT 'PENDING',
  "input" JSONB,
  "output" JSONB,
  "error" TEXT,
  "executionGraph" JSONB,
  "rollback" JSONB,
  "audit" JSONB,
  "latencyMs" INTEGER,
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "estimatedCostUsd" DECIMAL(12,6),
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "maxRetries" INTEGER NOT NULL DEFAULT 3,
  "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiToolExecution" (
  "id" TEXT NOT NULL,
  "aiRunId" TEXT NOT NULL,
  "aiStepId" TEXT,
  "aiActionRunId" TEXT,
  "companyId" TEXT NOT NULL,
  "actorId" TEXT,
  "toolName" TEXT NOT NULL,
  "actionKind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "dryRun" BOOLEAN NOT NULL DEFAULT true,
  "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
  "requiresConfirmation" BOOLEAN NOT NULL DEFAULT true,
  "idempotencyKey" TEXT,
  "input" JSONB,
  "output" JSONB,
  "audit" JSONB,
  "rollback" JSONB,
  "receipt" JSONB,
  "error" TEXT,
  "latencyMs" INTEGER,
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "estimatedCostUsd" DECIMAL(12,6),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiToolExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiApproval" (
  "id" TEXT NOT NULL,
  "aiRunId" TEXT,
  "aiStepId" TEXT,
  "companyId" TEXT NOT NULL,
  "requesterId" TEXT,
  "approverId" TEXT,
  "decidedById" TEXT,
  "approvalType" TEXT NOT NULL DEFAULT 'ACTION',
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "riskLevel" TEXT NOT NULL DEFAULT 'HIGH',
  "reason" TEXT NOT NULL,
  "preview" JSONB,
  "rollback" JSONB,
  "policy" JSONB,
  "tokenHash" TEXT,
  "expiresAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiObservation" (
  "id" TEXT NOT NULL,
  "aiRunId" TEXT NOT NULL,
  "aiStepId" TEXT,
  "companyId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" TEXT NOT NULL DEFAULT 'TRACE',
  "severity" TEXT NOT NULL DEFAULT 'INFO',
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiDecision" (
  "id" TEXT NOT NULL,
  "aiRunId" TEXT NOT NULL,
  "aiStepId" TEXT,
  "companyId" TEXT NOT NULL,
  "actorId" TEXT,
  "decisionType" TEXT NOT NULL DEFAULT 'PLAN',
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "rationale" TEXT NOT NULL,
  "inputs" JSONB,
  "outputs" JSONB,
  "policySnapshot" JSONB,
  "riskScore" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiDecision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiStep_aiRunId_sequence_key" ON "AiStep"("aiRunId", "sequence");
CREATE INDEX "AiStep_companyId_status_createdAt_idx" ON "AiStep"("companyId", "status", "createdAt");
CREATE INDEX "AiStep_companyId_toolName_createdAt_idx" ON "AiStep"("companyId", "toolName", "createdAt");
CREATE INDEX "AiStep_companyId_riskLevel_status_createdAt_idx" ON "AiStep"("companyId", "riskLevel", "status", "createdAt");

CREATE UNIQUE INDEX "AiToolExecution_companyId_idempotencyKey_key" ON "AiToolExecution"("companyId", "idempotencyKey");
CREATE INDEX "AiToolExecution_aiRunId_createdAt_idx" ON "AiToolExecution"("aiRunId", "createdAt");
CREATE INDEX "AiToolExecution_aiStepId_createdAt_idx" ON "AiToolExecution"("aiStepId", "createdAt");
CREATE INDEX "AiToolExecution_companyId_status_createdAt_idx" ON "AiToolExecution"("companyId", "status", "createdAt");
CREATE INDEX "AiToolExecution_companyId_toolName_createdAt_idx" ON "AiToolExecution"("companyId", "toolName", "createdAt");
CREATE INDEX "AiToolExecution_actorId_createdAt_idx" ON "AiToolExecution"("actorId", "createdAt");

CREATE UNIQUE INDEX "AiApproval_tokenHash_key" ON "AiApproval"("tokenHash");
CREATE INDEX "AiApproval_companyId_status_createdAt_idx" ON "AiApproval"("companyId", "status", "createdAt");
CREATE INDEX "AiApproval_companyId_riskLevel_status_createdAt_idx" ON "AiApproval"("companyId", "riskLevel", "status", "createdAt");
CREATE INDEX "AiApproval_requesterId_createdAt_idx" ON "AiApproval"("requesterId", "createdAt");
CREATE INDEX "AiApproval_approverId_status_createdAt_idx" ON "AiApproval"("approverId", "status", "createdAt");

CREATE INDEX "AiObservation_aiRunId_createdAt_idx" ON "AiObservation"("aiRunId", "createdAt");
CREATE INDEX "AiObservation_companyId_severity_createdAt_idx" ON "AiObservation"("companyId", "severity", "createdAt");
CREATE INDEX "AiObservation_companyId_type_createdAt_idx" ON "AiObservation"("companyId", "type", "createdAt");

CREATE INDEX "AiDecision_aiRunId_createdAt_idx" ON "AiDecision"("aiRunId", "createdAt");
CREATE INDEX "AiDecision_companyId_decisionType_createdAt_idx" ON "AiDecision"("companyId", "decisionType", "createdAt");
CREATE INDEX "AiDecision_companyId_status_createdAt_idx" ON "AiDecision"("companyId", "status", "createdAt");

ALTER TABLE "AiStep" ADD CONSTRAINT "AiStep_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiStep" ADD CONSTRAINT "AiStep_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiToolExecution" ADD CONSTRAINT "AiToolExecution_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiToolExecution" ADD CONSTRAINT "AiToolExecution_aiStepId_fkey" FOREIGN KEY ("aiStepId") REFERENCES "AiStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiToolExecution" ADD CONSTRAINT "AiToolExecution_aiActionRunId_fkey" FOREIGN KEY ("aiActionRunId") REFERENCES "AiActionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiToolExecution" ADD CONSTRAINT "AiToolExecution_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiToolExecution" ADD CONSTRAINT "AiToolExecution_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiApproval" ADD CONSTRAINT "AiApproval_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiApproval" ADD CONSTRAINT "AiApproval_aiStepId_fkey" FOREIGN KEY ("aiStepId") REFERENCES "AiStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiApproval" ADD CONSTRAINT "AiApproval_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiApproval" ADD CONSTRAINT "AiApproval_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiApproval" ADD CONSTRAINT "AiApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiApproval" ADD CONSTRAINT "AiApproval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiObservation" ADD CONSTRAINT "AiObservation_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiObservation" ADD CONSTRAINT "AiObservation_aiStepId_fkey" FOREIGN KEY ("aiStepId") REFERENCES "AiStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiObservation" ADD CONSTRAINT "AiObservation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiObservation" ADD CONSTRAINT "AiObservation_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiDecision" ADD CONSTRAINT "AiDecision_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiDecision" ADD CONSTRAINT "AiDecision_aiStepId_fkey" FOREIGN KEY ("aiStepId") REFERENCES "AiStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiDecision" ADD CONSTRAINT "AiDecision_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiDecision" ADD CONSTRAINT "AiDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON TABLE "AiStep" IS 'Durable execution-plan steps with permission, risk, retry, cost, and rollback metadata.';
COMMENT ON TABLE "AiToolExecution" IS 'Typed governed tool execution receipts for AI actions, including dry-runs and compensation metadata.';
COMMENT ON TABLE "AiApproval" IS 'Enterprise AI approval requests for high-risk actions, finance actions, contracts, workflows, and escalation paths.';
COMMENT ON TABLE "AiObservation" IS 'AI trace observations for policy, retrieval, tool, risk, and evaluator events.';
COMMENT ON TABLE "AiDecision" IS 'Auditable AI planning, policy, approval, and compensation decisions with rationale and risk score.';
