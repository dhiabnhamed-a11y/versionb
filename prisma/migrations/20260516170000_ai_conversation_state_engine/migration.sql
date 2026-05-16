CREATE TABLE "ai_conversation_states" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "actionType" TEXT,
  "pendingFields" JSONB,
  "resolvedFields" JSONB,
  "currentStep" TEXT,
  "expiresAt" TIMESTAMP(3),
  "confirmationRequired" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_conversation_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_pending_actions" (
  "id" TEXT NOT NULL,
  "stateId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'awaiting_input',
  "actionType" TEXT NOT NULL,
  "pendingFields" JSONB,
  "resolvedFields" JSONB,
  "currentStep" TEXT,
  "expiresAt" TIMESTAMP(3),
  "confirmationRequired" BOOLEAN NOT NULL DEFAULT false,
  "aiRunId" TEXT,
  "aiActionRunId" TEXT,
  "targetType" TEXT,
  "targetId" TEXT,
  "targetLabel" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastPrompt" TEXT,
  "receipt" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_pending_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_workflow_steps" (
  "id" TEXT NOT NULL,
  "stateId" TEXT NOT NULL,
  "pendingActionId" TEXT,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'awaiting_input',
  "actionType" TEXT NOT NULL,
  "pendingFields" JSONB,
  "resolvedFields" JSONB,
  "currentStep" TEXT NOT NULL,
  "stepIndex" INTEGER NOT NULL DEFAULT 0,
  "label" TEXT,
  "eventType" TEXT NOT NULL DEFAULT 'state_transition',
  "message" TEXT,
  "expiresAt" TIMESTAMP(3),
  "confirmationRequired" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_workflow_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_action_contexts" (
  "id" TEXT NOT NULL,
  "stateId" TEXT NOT NULL,
  "pendingActionId" TEXT,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'awaiting_input',
  "actionType" TEXT NOT NULL,
  "pendingFields" JSONB,
  "resolvedFields" JSONB,
  "currentStep" TEXT,
  "expiresAt" TIMESTAMP(3),
  "confirmationRequired" BOOLEAN NOT NULL DEFAULT false,
  "contextType" TEXT NOT NULL DEFAULT 'parameter_resolution',
  "context" JSONB NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  "source" TEXT NOT NULL DEFAULT 'ai_conversation_state_engine',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_action_contexts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_conversation_states_companyId_userId_status_updatedAt_idx"
  ON "ai_conversation_states"("companyId", "userId", "status", "updatedAt");

CREATE INDEX "ai_conversation_states_companyId_conversationId_status_idx"
  ON "ai_conversation_states"("companyId", "conversationId", "status");

CREATE INDEX "ai_conversation_states_companyId_actionType_status_expiresAt_idx"
  ON "ai_conversation_states"("companyId", "actionType", "status", "expiresAt");

CREATE INDEX "ai_pending_actions_companyId_userId_status_updatedAt_idx"
  ON "ai_pending_actions"("companyId", "userId", "status", "updatedAt");

CREATE INDEX "ai_pending_actions_companyId_conversationId_status_idx"
  ON "ai_pending_actions"("companyId", "conversationId", "status");

CREATE INDEX "ai_pending_actions_companyId_actionType_status_expiresAt_idx"
  ON "ai_pending_actions"("companyId", "actionType", "status", "expiresAt");

CREATE INDEX "ai_pending_actions_companyId_targetType_targetId_createdAt_idx"
  ON "ai_pending_actions"("companyId", "targetType", "targetId", "createdAt");

CREATE INDEX "ai_workflow_steps_companyId_conversationId_createdAt_idx"
  ON "ai_workflow_steps"("companyId", "conversationId", "createdAt");

CREATE INDEX "ai_workflow_steps_companyId_userId_status_createdAt_idx"
  ON "ai_workflow_steps"("companyId", "userId", "status", "createdAt");

CREATE INDEX "ai_workflow_steps_pendingActionId_stepIndex_idx"
  ON "ai_workflow_steps"("pendingActionId", "stepIndex");

CREATE INDEX "ai_action_contexts_companyId_conversationId_createdAt_idx"
  ON "ai_action_contexts"("companyId", "conversationId", "createdAt");

CREATE INDEX "ai_action_contexts_companyId_actionType_status_createdAt_idx"
  ON "ai_action_contexts"("companyId", "actionType", "status", "createdAt");

CREATE INDEX "ai_action_contexts_pendingActionId_contextType_createdAt_idx"
  ON "ai_action_contexts"("pendingActionId", "contextType", "createdAt");

ALTER TABLE "ai_conversation_states"
  ADD CONSTRAINT "ai_conversation_states_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_conversation_states"
  ADD CONSTRAINT "ai_conversation_states_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_conversation_states"
  ADD CONSTRAINT "ai_conversation_states_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_pending_actions"
  ADD CONSTRAINT "ai_pending_actions_stateId_fkey"
  FOREIGN KEY ("stateId") REFERENCES "ai_conversation_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_pending_actions"
  ADD CONSTRAINT "ai_pending_actions_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_pending_actions"
  ADD CONSTRAINT "ai_pending_actions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_pending_actions"
  ADD CONSTRAINT "ai_pending_actions_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_workflow_steps"
  ADD CONSTRAINT "ai_workflow_steps_stateId_fkey"
  FOREIGN KEY ("stateId") REFERENCES "ai_conversation_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_workflow_steps"
  ADD CONSTRAINT "ai_workflow_steps_pendingActionId_fkey"
  FOREIGN KEY ("pendingActionId") REFERENCES "ai_pending_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_workflow_steps"
  ADD CONSTRAINT "ai_workflow_steps_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_workflow_steps"
  ADD CONSTRAINT "ai_workflow_steps_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_workflow_steps"
  ADD CONSTRAINT "ai_workflow_steps_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_action_contexts"
  ADD CONSTRAINT "ai_action_contexts_stateId_fkey"
  FOREIGN KEY ("stateId") REFERENCES "ai_conversation_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_action_contexts"
  ADD CONSTRAINT "ai_action_contexts_pendingActionId_fkey"
  FOREIGN KEY ("pendingActionId") REFERENCES "ai_pending_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_action_contexts"
  ADD CONSTRAINT "ai_action_contexts_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_action_contexts"
  ADD CONSTRAINT "ai_action_contexts_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_action_contexts"
  ADD CONSTRAINT "ai_action_contexts_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
