-- AI memory and conversation substrate.
-- These tables let TASKIT OS persist scoped assistant conversations and durable
-- operational memories without exposing data across workspace or user boundaries.

CREATE TABLE "AiConversation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT,
  "context" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "intent" TEXT,
  "citations" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiMemory" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT,
  "scope" TEXT NOT NULL DEFAULT 'workspace',
  "kind" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  "source" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiConversation_companyId_userId_updatedAt_idx" ON "AiConversation"("companyId", "userId", "updatedAt");
CREATE INDEX "AiConversation_companyId_createdAt_idx" ON "AiConversation"("companyId", "createdAt");

CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");
CREATE INDEX "AiMessage_role_createdAt_idx" ON "AiMessage"("role", "createdAt");

CREATE INDEX "AiMemory_companyId_scope_kind_lastSeenAt_idx" ON "AiMemory"("companyId", "scope", "kind", "lastSeenAt");
CREATE INDEX "AiMemory_companyId_userId_lastSeenAt_idx" ON "AiMemory"("companyId", "userId", "lastSeenAt");
CREATE INDEX "AiMemory_companyId_kind_key_idx" ON "AiMemory"("companyId", "kind", "key");

ALTER TABLE "AiConversation"
  ADD CONSTRAINT "AiConversation_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiConversation"
  ADD CONSTRAINT "AiConversation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiMessage"
  ADD CONSTRAINT "AiMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiMemory"
  ADD CONSTRAINT "AiMemory_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiMemory"
  ADD CONSTRAINT "AiMemory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
