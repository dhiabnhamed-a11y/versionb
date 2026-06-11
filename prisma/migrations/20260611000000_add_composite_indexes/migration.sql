-- CreateIndex (idempotent — safe to re-run)
-- User composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_companyId_role_idx" ON "User"("companyId", "role");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_companyId_accountStatus_createdAt_idx" ON "User"("companyId", "accountStatus", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_email_idx" ON "User"("email");

-- Project composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Project_companyId_roomId_idx" ON "Project"("companyId", "roomId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Project_companyId_categoryId_idx" ON "Project"("companyId", "categoryId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Project_companyId_clientId_idx" ON "Project"("companyId", "clientId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Project_companyId_updatedAt_idx" ON "Project"("companyId", "updatedAt");

-- Task composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Task_deliverableId_stage_createdAt_idx" ON "Task"("deliverableId", "stage", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Task_projectId_stage_createdAt_idx" ON "Task"("projectId", "stage", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Task_enterpriseAssignedTeamId_enterpriseQueuePriority_enterprise_idx" ON "Task"("enterpriseAssignedTeamId", "enterpriseQueuePriority", "enterpriseSlaDueAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Task_enterpriseDepartmentId_stage_createdAt_idx" ON "Task"("enterpriseDepartmentId", "stage", "createdAt");

-- AiRun composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AiRun_companyId_status_createdAt_idx" ON "AiRun"("companyId", "status", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AiRun_companyId_userId_createdAt_idx" ON "AiRun"("companyId", "userId", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AiRun_trigger_status_createdAt_idx" ON "AiRun"("trigger", "status", "createdAt");
