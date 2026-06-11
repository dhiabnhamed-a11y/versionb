-- 1. Create the application role
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'taskit_app') THEN
    CREATE ROLE taskit_app NOINHERIT LOGIN PASSWORD 'CHANGE_ME_IN_PRODUCTION';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO taskit_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO taskit_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO taskit_app;

-- 2. Helper function
CREATE OR REPLACE FUNCTION current_company_id() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER
  AS $func$ SELECT current_setting('app.current_company_id', true) $func$;

-- 3. Bypass function for Super Admin
CREATE OR REPLACE FUNCTION is_super_admin_context() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  AS $func$ SELECT current_setting('app.current_company_id', true) = 'SUPER_ADMIN' $func$;

-- 4. Apply policies to ALL tenant-scoped tables
DO $$ 
DECLARE
  tables text[] := ARRAY[
    '"User"',
    '"Client"',
    '"ClientPortalComment"',
    '"ClientActivity"',
    '"Invoice"',
    '"Contract"',
    '"ContractVersion"',
    '"ContractTemplate"',
    '"ContractClause"',
    '"ContractSignature"',
    '"ContractAuditLog"',
    '"ContractGenerationJob"',
    '"CompanySettings"',
    '"ErpWorkspaceSettings"',
    '"AdminActionLog"',
    '"Room"',
    '"ProjectCategory"',
    '"Invite"',
    '"AccessRequest"',
    '"Project"',
    '"ChartOfAccount"',
    '"AccountCategory"',
    '"CostCenter"',
    '"Account"',
    '"FinancialPeriod"',
    '"JournalEntry"',
    '"JournalLine"',
    '"Ledger"',
    '"Reconciliation"',
    '"ExchangeRate"',
    '"TransactionReference"',
    '"FinancialAuditLog"',
    '"Vendor"',
    '"ExpenseCategory"',
    '"Expense"',
    '"EmployeeCompensationProfile"',
    '"Payroll"',
    '"PayrollItem"',
    '"TreasuryAccount"',
    '"TreasuryTransaction"',
    '"Budget"',
    '"BudgetLine"',
    '"Forecast"',
    '"FinancialMetric"',
    '"ProfitabilitySnapshot"',
    '"ApprovalFlow"',
    '"ApprovalStep"',
    '"TimeEntry"',
    '"Brief"',
    '"Deliverable"',
    '"ApprovalDecision"',
    '"DeliverableActivity"',
    '"WorkflowTemplate"',
    '"EnterpriseDepartment"',
    '"EnterpriseTeam"',
    '"EnterpriseTeamMember"',
    '"EnterpriseTaskAssignment"',
    '"EnterpriseSlaPolicy"',
    '"EnterpriseAssetCategory"',
    '"EnterpriseAsset"',
    '"EnterpriseIncident"',
    '"EnterpriseMaintenancePlan"',
    '"EnterpriseMaintenanceWorkOrder"',
    '"EnterpriseComplianceControl"',
    '"EnterpriseApprovalWorkflow"',
    '"EnterpriseApprovalStep"',
    '"EnterpriseRoleAssignment"',
    '"EnterpriseAuditEvent"',
    '"Activity"',
    '"Alert"',
    '"AuditLog"',
    '"LegalConsent"',
    '"JobRun"',
    '"IdempotencyKey"',
    '"AuthSession"',
    '"RevokedToken"',
    '"SecurityNonce"',
    '"SearchIndex"',
    '"AnalyticsMetric"',
    '"CalendarEvent"',
    '"EnterpriseShift"',
    '"EnterpriseProblem"',
    '"EnterpriseChange"',
    '"EnterpriseIncidentNote"',
    '"EnterpriseIncidentTimeEntry"',
    '"EnterpriseVendor"',
    '"EnterpriseContract"',
    '"EnterpriseAssetLease"',
    '"EnterpriseServiceHealth"',
    '"EnterpriseRecurringTicket"',
    '"AiConversation"',
    '"AiConversationState"',
    '"AiPendingAction"',
    '"AiWorkflowStep"',
    '"AiActionContext"',
    '"AiMemory"',
    '"AiRun"',
    '"AiStep"',
    '"AiActionRun"',
    '"AiToolExecution"',
    '"AiApproval"',
    '"AiObservation"',
    '"AiDecision"',
    '"CreatorProfile"',
    '"ConnectedAccount"',
    '"AnalyticsSnapshot"',
    '"RealtimeMetric"',
    '"AudienceDemographic"',
    '"EngagementMetric"',
    '"RevenueMetric"',
    '"ContentPerformance"',
    '"SocialAiInsight"',
    '"SocialSyncJob"',
    '"SocialWebhookEvent"',
    '"IntegrationActivityLog"',
    '"SubscriptionEvent"',
    '"EmsCompany"',
    '"EmsStation"',
    '"EmsUnit"',
    '"EmsCrew"',
    '"EmsDispatcher"',
    '"EmsHospital"',
    '"EmsIncident"',
    '"EmsProtocol"',
    '"EmsAutomationRule"',
    '"EmsSupplyStock"',
    '"EmsNotification"',
    '"EmsAnalytics"',
    '"EmsPredictiveZone"',
    '"EmsIntegration"',
    '"EmsWebhookConfig"',
    '"EmsFieldMapping"',
    '"EmsAuditLog"',
    '"EmsIntegrationEvent"',
    '"HospitalPatient"',
    '"HospitalBed"',
    '"HospitalMedicalSupply"'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %s', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %s FOR ALL TO taskit_app USING (is_super_admin_context() OR "companyId" IS NULL OR "companyId" = current_company_id()) WITH CHECK (is_super_admin_context() OR "companyId" = current_company_id())', t);
  END LOOP;
END $$;
