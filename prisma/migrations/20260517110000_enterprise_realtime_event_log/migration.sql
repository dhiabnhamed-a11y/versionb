CREATE TABLE "RealtimeEventLog" (
  "id" TEXT NOT NULL,
  "sequence" BIGSERIAL NOT NULL,
  "workspaceId" TEXT,
  "targetScope" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "entityId" TEXT,
  "actorId" TEXT,
  "correlationId" TEXT,
  "payload" JSONB,
  "envelope" JSONB NOT NULL,
  "streamId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RealtimeEventLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RealtimeConsumerOffset" (
  "consumerId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "lastEventId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RealtimeConsumerOffset_pkey" PRIMARY KEY ("consumerId", "workspaceId")
);

CREATE INDEX "RealtimeEventLog_workspaceId_sequence_idx" ON "RealtimeEventLog"("workspaceId", "sequence");
CREATE INDEX "RealtimeEventLog_workspaceId_createdAt_idx" ON "RealtimeEventLog"("workspaceId", "createdAt");
CREATE INDEX "RealtimeEventLog_targetScope_targetId_sequence_idx" ON "RealtimeEventLog"("targetScope", "targetId", "sequence");
CREATE INDEX "RealtimeEventLog_type_createdAt_idx" ON "RealtimeEventLog"("type", "createdAt");
CREATE INDEX "RealtimeEventLog_entityId_idx" ON "RealtimeEventLog"("entityId");
CREATE INDEX "RealtimeConsumerOffset_workspaceId_updatedAt_idx" ON "RealtimeConsumerOffset"("workspaceId", "updatedAt");
