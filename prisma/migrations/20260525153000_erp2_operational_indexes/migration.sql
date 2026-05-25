-- Tenant-scoped operational indexes for the dedicated ERP workspace.
-- These keep high-frequency dashboard, module table, approval, and alert queries
-- constrained by workspace before status/date/entity filters.

CREATE INDEX IF NOT EXISTS "ERPFiscalYear_workspace_status_deleted_idx"
  ON "ERPFiscalYear" ("workspaceId", "status", "isDeleted");

CREATE INDEX IF NOT EXISTS "ERPPeriod_workspace_dates_deleted_idx"
  ON "ERPPeriod" ("workspaceId", "startDate", "endDate", "isDeleted");

CREATE INDEX IF NOT EXISTS "ERPJournalEntry_workspace_status_date_deleted_idx"
  ON "ERPJournalEntry" ("workspaceId", "status", "date", "isDeleted");

CREATE INDEX IF NOT EXISTS "ERPJournalEntry_workspace_source_idx"
  ON "ERPJournalEntry" ("workspaceId", "sourceType", "sourceId");

CREATE INDEX IF NOT EXISTS "ERPJournalLine_workspace_account_created_idx"
  ON "ERPJournalLine" ("workspaceId", "accountId", "createdAt");

CREATE INDEX IF NOT EXISTS "ERPARLedger_workspace_status_due_deleted_idx"
  ON "ERPARLedger" ("workspaceId", "status", "dueDate", "isDeleted");

CREATE INDEX IF NOT EXISTS "ERPARPayment_workspace_ledger_paid_idx"
  ON "ERPARPayment" ("workspaceId", "arLedgerId", "paidAt");

CREATE INDEX IF NOT EXISTS "ERPVendor_workspace_active_deleted_idx"
  ON "ERPVendor" ("workspaceId", "isActive", "isDeleted");

CREATE INDEX IF NOT EXISTS "ERPVendor_workspace_name_idx"
  ON "ERPVendor" ("workspaceId", "name");

CREATE INDEX IF NOT EXISTS "ERPAPBill_workspace_status_due_deleted_idx"
  ON "ERPAPBill" ("workspaceId", "status", "dueDate", "isDeleted");

CREATE INDEX IF NOT EXISTS "ERPAPBill_workspace_vendor_created_idx"
  ON "ERPAPBill" ("workspaceId", "vendorId", "createdAt");

CREATE INDEX IF NOT EXISTS "ERPAPPayment_workspace_bill_paid_idx"
  ON "ERPAPPayment" ("workspaceId", "billId", "paidAt");

CREATE INDEX IF NOT EXISTS "ERPBudget_workspace_status_dates_deleted_idx"
  ON "ERPBudget" ("workspaceId", "status", "startDate", "endDate", "isDeleted");

CREATE INDEX IF NOT EXISTS "ERPBudgetLine_workspace_account_period_idx"
  ON "ERPBudgetLine" ("workspaceId", "accountCode", "year", "month");

CREATE INDEX IF NOT EXISTS "ERPPurchaseOrder_workspace_status_created_deleted_idx"
  ON "ERPPurchaseOrder" ("workspaceId", "status", "createdAt", "isDeleted");

CREATE INDEX IF NOT EXISTS "ERPInventoryItem_workspace_active_deleted_idx"
  ON "ERPInventoryItem" ("workspaceId", "isActive", "isDeleted");

CREATE INDEX IF NOT EXISTS "ERPInventoryItem_workspace_category_idx"
  ON "ERPInventoryItem" ("workspaceId", "category");

CREATE INDEX IF NOT EXISTS "ERPInventoryMovement_workspace_item_moved_idx"
  ON "ERPInventoryMovement" ("workspaceId", "itemId", "movedAt");

CREATE INDEX IF NOT EXISTS "ERPFixedAsset_workspace_disposed_deleted_idx"
  ON "ERPFixedAsset" ("workspaceId", "isDisposed", "isDeleted");

CREATE INDEX IF NOT EXISTS "ERPEmployee_workspace_active_deleted_idx"
  ON "ERPEmployee" ("workspaceId", "isActive", "isDeleted");

CREATE INDEX IF NOT EXISTS "ERPEmployee_workspace_department_idx"
  ON "ERPEmployee" ("workspaceId", "departmentId");

CREATE INDEX IF NOT EXISTS "ERPPayrollRun_workspace_status_paydate_deleted_idx"
  ON "ERPPayrollRun" ("workspaceId", "status", "payDate", "isDeleted");

CREATE INDEX IF NOT EXISTS "ERPLeaveRequest_workspace_status_dates_deleted_idx"
  ON "ERPLeaveRequest" ("workspaceId", "status", "startDate", "endDate", "isDeleted");

CREATE INDEX IF NOT EXISTS "ERPLeaveRequest_workspace_employee_created_idx"
  ON "ERPLeaveRequest" ("workspaceId", "employeeId", "createdAt");

CREATE INDEX IF NOT EXISTS "ERPTaxRate_workspace_active_deleted_idx"
  ON "ERPTaxRate" ("workspaceId", "isActive", "isDeleted");

CREATE INDEX IF NOT EXISTS "ERPAlert_workspace_resolved_severity_created_idx"
  ON "ERPAlert" ("workspaceId", "isResolved", "severity", "createdAt");

CREATE INDEX IF NOT EXISTS "ERPAlert_workspace_entity_idx"
  ON "ERPAlert" ("workspaceId", "entityType", "entityId");
