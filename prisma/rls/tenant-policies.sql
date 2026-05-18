-- Apply manually on PostgreSQL after setting app.current_company_id per request.
-- Example (per connection): SET app.current_company_id = 'company_cuid';

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_user_isolation ON "User"
  USING ("companyId" = current_setting('app.current_company_id', true));

CREATE POLICY tenant_project_isolation ON "Project"
  USING ("companyId" = current_setting('app.current_company_id', true));

CREATE POLICY tenant_task_isolation ON "Task"
  USING ("companyId" = current_setting('app.current_company_id', true));

CREATE POLICY tenant_client_isolation ON "Client"
  USING ("companyId" = current_setting('app.current_company_id', true));
