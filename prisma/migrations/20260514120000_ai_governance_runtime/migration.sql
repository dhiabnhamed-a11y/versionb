-- Enterprise AI governance runtime.
-- Additive-only: durable AI runs, action previews, confirmation tokens, receipts,
-- rollback metadata, and execution observability without changing existing tables.

CREATE TABLE "AiRun" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT,
  "conversationId" TEXT,
  "trigger" TEXT NOT NULL DEFAULT 'chat',
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "phase" TEXT NOT NULL DEFAULT 'PLAN',
  "input" JSONB,
  "plan" JSONB,
  "result" JSONB,
  "error" TEXT,
  "model" TEXT,
  "promptVersion" TEXT,
  "latencyMs" INTEGER,
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "estimatedCostUsd" DECIMAL(12,6),
  "idempotencyKey" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiActionRun" (
  "id" TEXT NOT NULL,
  "aiRunId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "actorId" TEXT,
  "toolName" TEXT NOT NULL,
  "actionKind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  "phase" TEXT NOT NULL DEFAULT 'PREVIEW',
  "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
  "requiresConfirmation" BOOLEAN NOT NULL DEFAULT true,
  "confirmationTokenHash" TEXT,
  "confirmationExpiresAt" TIMESTAMP(3),
  "confirmationUsedAt" TIMESTAMP(3),
  "idempotencyKey" TEXT,
  "targetType" TEXT,
  "targetId" TEXT,
  "preview" JSONB,
  "diff" JSONB,
  "rollback" JSONB,
  "audit" JSONB,
  "input" JSONB,
  "result" JSONB,
  "receipt" JSONB,
  "error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiActionRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiRun_companyId_idempotencyKey_key" ON "AiRun"("companyId", "idempotencyKey");
CREATE INDEX "AiRun_companyId_status_createdAt_idx" ON "AiRun"("companyId", "status", "createdAt");
CREATE INDEX "AiRun_companyId_userId_createdAt_idx" ON "AiRun"("companyId", "userId", "createdAt");
CREATE INDEX "AiRun_trigger_status_createdAt_idx" ON "AiRun"("trigger", "status", "createdAt");

CREATE UNIQUE INDEX "AiActionRun_confirmationTokenHash_key" ON "AiActionRun"("confirmationTokenHash");
CREATE UNIQUE INDEX "AiActionRun_companyId_idempotencyKey_key" ON "AiActionRun"("companyId", "idempotencyKey");
CREATE INDEX "AiActionRun_aiRunId_createdAt_idx" ON "AiActionRun"("aiRunId", "createdAt");
CREATE INDEX "AiActionRun_companyId_status_createdAt_idx" ON "AiActionRun"("companyId", "status", "createdAt");
CREATE INDEX "AiActionRun_companyId_toolName_createdAt_idx" ON "AiActionRun"("companyId", "toolName", "createdAt");
CREATE INDEX "AiActionRun_companyId_targetType_targetId_createdAt_idx" ON "AiActionRun"("companyId", "targetType", "targetId", "createdAt");
CREATE INDEX "AiActionRun_actorId_createdAt_idx" ON "AiActionRun"("actorId", "createdAt");

ALTER TABLE "AiRun"
  ADD CONSTRAINT "AiRun_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiRun"
  ADD CONSTRAINT "AiRun_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiActionRun"
  ADD CONSTRAINT "AiActionRun_aiRunId_fkey"
  FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiActionRun"
  ADD CONSTRAINT "AiActionRun_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiActionRun"
  ADD CONSTRAINT "AiActionRun_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON TABLE "AiRun" IS 'Durable AI execution runs for planning, previews, confirmations, background work, observability, model metrics, and receipts.';
COMMENT ON TABLE "AiActionRun" IS 'Governed AI tool/action executions. Mutating actions must start here as previews with confirmation tokens before execution.';
