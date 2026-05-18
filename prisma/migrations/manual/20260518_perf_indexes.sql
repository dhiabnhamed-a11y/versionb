-- Manual performance indexes for tenant-scoped dashboards (apply via psql or Supabase SQL editor)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Project_companyId_updatedAt_idx" ON "Project" ("companyId", "updatedAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Task_projectId_stage_deadline_idx" ON "Task" ("projectId", "stage", "deadline");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Deliverable_companyId_updatedAt_idx" ON "Deliverable" ("companyId", "updatedAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Invoice_companyId_status_dueDate_idx" ON "Invoice" ("companyId", "status", "dueDate");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Client_companyId_status_idx" ON "Client" ("companyId", "status");
