-- TASKIT financial operating system core.
-- Additive-only: enterprise finance, double-entry accounting, payroll,
-- expense, treasury, budgeting, forecasting, profitability, approvals,
-- and financial audit infrastructure without changing existing records.

CREATE TYPE "FinancialAccountType" AS ENUM (
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
  'CONTRA_ASSET',
  'CONTRA_LIABILITY',
  'CONTRA_REVENUE'
);

CREATE TYPE "FinancialNormalBalance" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "FinancialRecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "FinancialPeriodStatus" AS ENUM ('OPEN', 'LOCKED', 'CLOSED');
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'REVERSED', 'VOID');
CREATE TYPE "JournalEntrySourceType" AS ENUM ('MANUAL', 'INVOICE', 'PAYMENT', 'PAYROLL', 'EXPENSE', 'TREASURY', 'TRANSFER', 'ADJUSTMENT', 'REVERSAL', 'AI');
CREATE TYPE "ReconciliationStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'RECONCILED', 'VOID');
CREATE TYPE "ApprovalFlowStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ESCALATED');
CREATE TYPE "ApprovalStepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED', 'ESCALATED');
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID', 'REIMBURSED', 'VOID');
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'PAID', 'VOID');
CREATE TYPE "TreasuryAccountType" AS ENUM ('BANK', 'CASH', 'WALLET', 'CREDIT_CARD', 'PAYMENT_PROCESSOR');
CREATE TYPE "TreasuryTransactionStatus" AS ENUM ('SCHEDULED', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'RECONCILED', 'CANCELLED', 'FAILED');
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'LOCKED', 'ARCHIVED');
CREATE TYPE "ForecastStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "ProfitabilityScope" AS ENUM ('COMPANY', 'CLIENT', 'PROJECT', 'EMPLOYEE', 'DEPARTMENT');
CREATE TYPE "TimeEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'BILLED', 'LOCKED');

CREATE TABLE "ChartOfAccount" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "FinancialRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChartOfAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Account" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "chartId" TEXT,
  "parentAccountId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "FinancialAccountType" NOT NULL,
  "normalBalance" "FinancialNormalBalance" NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "FinancialRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialPeriod" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "FinancialPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "closedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinancialPeriod_valid_range_chk" CHECK ("startsAt" < "endsAt")
);

CREATE TABLE "JournalEntry" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "periodId" TEXT,
  "createdById" TEXT,
  "approvedById" TEXT,
  "postedById" TEXT,
  "invoiceId" TEXT,
  "entryNumber" TEXT NOT NULL,
  "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceType" "JournalEntrySourceType" NOT NULL DEFAULT 'MANUAL',
  "sourceId" TEXT,
  "memo" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "totalDebit" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "totalCredit" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "idempotencyKey" TEXT,
  "postedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "reversedAt" TIMESTAMP(3),
  "reversalOfEntryId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalEntry_balanced_totals_chk" CHECK ("totalDebit" = "totalCredit" AND "totalDebit" >= 0 AND "totalCredit" >= 0)
);

CREATE TABLE "JournalLine" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "description" TEXT,
  "debit" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "credit" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1,
  "projectId" TEXT,
  "clientId" TEXT,
  "invoiceId" TEXT,
  "taskId" TEXT,
  "targetType" TEXT,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalLine_single_sided_amount_chk" CHECK (
    "debit" >= 0 AND "credit" >= 0 AND
    (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0))
  )
);

CREATE TABLE "Ledger" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "periodId" TEXT,
  "accountId" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "journalLineId" TEXT NOT NULL,
  "postingDate" TIMESTAMP(3) NOT NULL,
  "debit" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "credit" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "balanceImpact" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Ledger_single_sided_amount_chk" CHECK (
    "debit" >= 0 AND "credit" >= 0 AND
    (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0))
  )
);

CREATE TABLE "Reconciliation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "treasuryAccountId" TEXT,
  "periodId" TEXT,
  "status" "ReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
  "statementDate" TIMESTAMP(3),
  "openingBalance" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "closingBalance" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "reconciledAt" TIMESTAMP(3),
  "reconciledById" TEXT,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Reconciliation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransactionReference" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "journalEntryId" TEXT,
  "ledgerId" TEXT,
  "invoiceId" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "externalRef" TEXT,
  "idempotencyKey" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionReference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialAuditLog" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "previousHash" TEXT,
  "hash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Vendor" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "taxId" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "paymentTerms" TEXT,
  "defaultAccountId" TEXT,
  "status" "FinancialRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpenseCategory" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "defaultAccountId" TEXT,
  "status" "FinancialRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "vendorId" TEXT,
  "categoryId" TEXT,
  "submittedById" TEXT,
  "approvedById" TEXT,
  "projectId" TEXT,
  "taskId" TEXT,
  "clientId" TEXT,
  "journalEntryId" TEXT,
  "treasuryTransactionId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
  "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "subtotal" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "taxTotal" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "total" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "reimbursable" BOOLEAN NOT NULL DEFAULT false,
  "receiptUrl" TEXT,
  "receiptOcrStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
  "aiCategoryConfidence" DECIMAL(8,6),
  "recurrenceRule" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Expense_nonnegative_amounts_chk" CHECK ("subtotal" >= 0 AND "taxTotal" >= 0 AND "total" >= 0)
);

CREATE TABLE "EmployeeCompensationProfile" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "employmentType" TEXT NOT NULL DEFAULT 'SALARIED',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "annualSalary" DECIMAL(18,6),
  "hourlyRate" DECIMAL(18,6),
  "overtimeRate" DECIMAL(18,6),
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "vacationBalance" DECIMAL(10,4) NOT NULL DEFAULT 0,
  "status" "FinancialRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeCompensationProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payroll" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "processedById" TEXT,
  "approvedById" TEXT,
  "journalEntryId" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "grossPay" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "overtimePay" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "bonusPay" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "deductions" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "taxes" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "netPay" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "approvedAt" TIMESTAMP(3),
  "postedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payroll_valid_range_chk" CHECK ("periodStart" <= "periodEnd"),
  CONSTRAINT "Payroll_nonnegative_amounts_chk" CHECK (
    "grossPay" >= 0 AND "overtimePay" >= 0 AND "bonusPay" >= 0 AND
    "deductions" >= 0 AND "taxes" >= 0 AND "netPay" >= 0
  )
);

CREATE TABLE "PayrollItem" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "payrollId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "projectId" TEXT,
  "taskId" TEXT,
  "itemType" TEXT NOT NULL,
  "description" TEXT,
  "hours" DECIMAL(10,4) NOT NULL DEFAULT 0,
  "rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "taxable" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayrollItem_nonnegative_amounts_chk" CHECK ("hours" >= 0 AND "rate" >= 0 AND "amount" >= 0)
);

CREATE TABLE "TreasuryAccount" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "ledgerAccountId" TEXT,
  "name" TEXT NOT NULL,
  "type" "TreasuryAccountType" NOT NULL DEFAULT 'BANK',
  "institutionName" TEXT,
  "maskedNumber" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "openingBalance" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "currentBalance" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "status" "FinancialRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TreasuryAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreasuryTransaction" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "fromAccountId" TEXT,
  "toAccountId" TEXT,
  "createdById" TEXT,
  "approvedById" TEXT,
  "journalEntryId" TEXT,
  "invoiceId" TEXT,
  "status" "TreasuryTransactionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "direction" TEXT NOT NULL DEFAULT 'OUTFLOW',
  "paymentMethod" TEXT,
  "amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "scheduledFor" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "reconciledAt" TIMESTAMP(3),
  "externalRef" TEXT,
  "memo" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TreasuryTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TreasuryTransaction_nonnegative_amount_chk" CHECK ("amount" >= 0)
);

CREATE TABLE "Budget" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "periodId" TEXT,
  "projectId" TEXT,
  "name" TEXT NOT NULL,
  "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "totalAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Budget_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Budget_nonnegative_amount_chk" CHECK ("totalAmount" >= 0)
);

CREATE TABLE "BudgetLine" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "budgetId" TEXT NOT NULL,
  "accountId" TEXT,
  "projectId" TEXT,
  "department" TEXT,
  "description" TEXT,
  "amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BudgetLine_nonnegative_amount_chk" CHECK ("amount" >= 0)
);

CREATE TABLE "Forecast" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "periodId" TEXT,
  "name" TEXT NOT NULL,
  "status" "ForecastStatus" NOT NULL DEFAULT 'DRAFT',
  "horizon" TEXT NOT NULL DEFAULT 'MONTHLY',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "assumptions" JSONB,
  "metrics" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Forecast_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialMetric" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "accountId" TEXT,
  "projectId" TEXT,
  "key" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'company',
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "value" DECIMAL(20,6) NOT NULL DEFAULT 0,
  "dimensions" JSONB,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfitabilitySnapshot" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "scope" "ProfitabilityScope" NOT NULL,
  "projectId" TEXT,
  "clientId" TEXT,
  "employeeId" TEXT,
  "department" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "revenue" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "laborCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "expenseCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "grossProfit" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "grossMarginPercent" DECIMAL(8,4) NOT NULL DEFAULT 0,
  "revisionCostImpact" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "approvalDelayCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "marginLeakage" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "evidence" JSONB,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfitabilitySnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfitabilitySnapshot_valid_range_chk" CHECK ("periodStart" <= "periodEnd")
);

CREATE TABLE "ApprovalFlow" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "createdById" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "flowType" TEXT NOT NULL,
  "status" "ApprovalFlowStatus" NOT NULL DEFAULT 'PENDING',
  "requiredRole" TEXT,
  "summary" TEXT,
  "aiSummary" JSONB,
  "escalatesAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalFlow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalStep" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "flowId" TEXT NOT NULL,
  "assignedToId" TEXT,
  "decidedById" TEXT,
  "sortOrder" INTEGER NOT NULL,
  "status" "ApprovalStepStatus" NOT NULL DEFAULT 'PENDING',
  "decisionNote" TEXT,
  "dueAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimeEntry" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "projectId" TEXT,
  "taskId" TEXT,
  "clientId" TEXT,
  "payrollItemId" TEXT,
  "status" "TimeEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "workDate" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "hours" DECIMAL(10,4) NOT NULL DEFAULT 0,
  "billable" BOOLEAN NOT NULL DEFAULT true,
  "costRate" DECIMAL(18,6),
  "billRate" DECIMAL(18,6),
  "description" TEXT,
  "approvedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TimeEntry_nonnegative_amounts_chk" CHECK (
    "hours" >= 0 AND
    ("costRate" IS NULL OR "costRate" >= 0) AND
    ("billRate" IS NULL OR "billRate" >= 0)
  )
);

CREATE UNIQUE INDEX "ChartOfAccount_companyId_name_key" ON "ChartOfAccount"("companyId", "name");
CREATE INDEX "ChartOfAccount_companyId_status_createdAt_idx" ON "ChartOfAccount"("companyId", "status", "createdAt");

CREATE UNIQUE INDEX "Account_companyId_code_key" ON "Account"("companyId", "code");
CREATE INDEX "Account_companyId_type_status_idx" ON "Account"("companyId", "type", "status");
CREATE INDEX "Account_companyId_parentAccountId_idx" ON "Account"("companyId", "parentAccountId");
CREATE INDEX "Account_chartId_idx" ON "Account"("chartId");

CREATE UNIQUE INDEX "FinancialPeriod_companyId_name_key" ON "FinancialPeriod"("companyId", "name");
CREATE INDEX "FinancialPeriod_companyId_status_startsAt_endsAt_idx" ON "FinancialPeriod"("companyId", "status", "startsAt", "endsAt");
CREATE INDEX "FinancialPeriod_closedById_closedAt_idx" ON "FinancialPeriod"("closedById", "closedAt");

CREATE UNIQUE INDEX "JournalEntry_companyId_entryNumber_key" ON "JournalEntry"("companyId", "entryNumber");
CREATE UNIQUE INDEX "JournalEntry_companyId_idempotencyKey_key" ON "JournalEntry"("companyId", "idempotencyKey");
CREATE INDEX "JournalEntry_companyId_status_transactionDate_idx" ON "JournalEntry"("companyId", "status", "transactionDate");
CREATE INDEX "JournalEntry_companyId_sourceType_sourceId_idx" ON "JournalEntry"("companyId", "sourceType", "sourceId");
CREATE INDEX "JournalEntry_companyId_invoiceId_transactionDate_idx" ON "JournalEntry"("companyId", "invoiceId", "transactionDate");
CREATE INDEX "JournalEntry_periodId_status_idx" ON "JournalEntry"("periodId", "status");
CREATE INDEX "JournalEntry_createdById_createdAt_idx" ON "JournalEntry"("createdById", "createdAt");

CREATE UNIQUE INDEX "JournalLine_journalEntryId_lineNumber_key" ON "JournalLine"("journalEntryId", "lineNumber");
CREATE INDEX "JournalLine_companyId_accountId_createdAt_idx" ON "JournalLine"("companyId", "accountId", "createdAt");
CREATE INDEX "JournalLine_companyId_projectId_createdAt_idx" ON "JournalLine"("companyId", "projectId", "createdAt");
CREATE INDEX "JournalLine_companyId_clientId_createdAt_idx" ON "JournalLine"("companyId", "clientId", "createdAt");
CREATE INDEX "JournalLine_companyId_invoiceId_createdAt_idx" ON "JournalLine"("companyId", "invoiceId", "createdAt");
CREATE INDEX "JournalLine_companyId_taskId_createdAt_idx" ON "JournalLine"("companyId", "taskId", "createdAt");

CREATE UNIQUE INDEX "Ledger_journalLineId_key" ON "Ledger"("journalLineId");
CREATE INDEX "Ledger_companyId_accountId_postingDate_idx" ON "Ledger"("companyId", "accountId", "postingDate");
CREATE INDEX "Ledger_companyId_sourceType_sourceId_idx" ON "Ledger"("companyId", "sourceType", "sourceId");
CREATE INDEX "Ledger_periodId_accountId_idx" ON "Ledger"("periodId", "accountId");

CREATE INDEX "Reconciliation_companyId_status_statementDate_idx" ON "Reconciliation"("companyId", "status", "statementDate");
CREATE INDEX "Reconciliation_companyId_accountId_statementDate_idx" ON "Reconciliation"("companyId", "accountId", "statementDate");
CREATE INDEX "Reconciliation_treasuryAccountId_statementDate_idx" ON "Reconciliation"("treasuryAccountId", "statementDate");

CREATE UNIQUE INDEX "TransactionReference_companyId_sourceType_sourceId_key" ON "TransactionReference"("companyId", "sourceType", "sourceId");
CREATE UNIQUE INDEX "TransactionReference_companyId_idempotencyKey_key" ON "TransactionReference"("companyId", "idempotencyKey");
CREATE INDEX "TransactionReference_companyId_externalRef_idx" ON "TransactionReference"("companyId", "externalRef");
CREATE INDEX "TransactionReference_journalEntryId_idx" ON "TransactionReference"("journalEntryId");
CREATE INDEX "TransactionReference_ledgerId_idx" ON "TransactionReference"("ledgerId");

CREATE UNIQUE INDEX "FinancialAuditLog_hash_key" ON "FinancialAuditLog"("hash");
CREATE INDEX "FinancialAuditLog_companyId_createdAt_idx" ON "FinancialAuditLog"("companyId", "createdAt");
CREATE INDEX "FinancialAuditLog_companyId_entityType_entityId_createdAt_idx" ON "FinancialAuditLog"("companyId", "entityType", "entityId", "createdAt");
CREATE INDEX "FinancialAuditLog_actorId_createdAt_idx" ON "FinancialAuditLog"("actorId", "createdAt");
CREATE INDEX "FinancialAuditLog_action_createdAt_idx" ON "FinancialAuditLog"("action", "createdAt");

CREATE UNIQUE INDEX "Vendor_companyId_name_key" ON "Vendor"("companyId", "name");
CREATE INDEX "Vendor_companyId_status_createdAt_idx" ON "Vendor"("companyId", "status", "createdAt");
CREATE INDEX "Vendor_companyId_email_idx" ON "Vendor"("companyId", "email");

CREATE UNIQUE INDEX "ExpenseCategory_companyId_name_key" ON "ExpenseCategory"("companyId", "name");
CREATE INDEX "ExpenseCategory_companyId_status_createdAt_idx" ON "ExpenseCategory"("companyId", "status", "createdAt");

CREATE UNIQUE INDEX "Expense_journalEntryId_key" ON "Expense"("journalEntryId");
CREATE UNIQUE INDEX "Expense_treasuryTransactionId_key" ON "Expense"("treasuryTransactionId");
CREATE INDEX "Expense_companyId_status_expenseDate_idx" ON "Expense"("companyId", "status", "expenseDate");
CREATE INDEX "Expense_companyId_vendorId_expenseDate_idx" ON "Expense"("companyId", "vendorId", "expenseDate");
CREATE INDEX "Expense_companyId_categoryId_expenseDate_idx" ON "Expense"("companyId", "categoryId", "expenseDate");
CREATE INDEX "Expense_companyId_projectId_expenseDate_idx" ON "Expense"("companyId", "projectId", "expenseDate");
CREATE INDEX "Expense_companyId_clientId_expenseDate_idx" ON "Expense"("companyId", "clientId", "expenseDate");
CREATE INDEX "Expense_submittedById_createdAt_idx" ON "Expense"("submittedById", "createdAt");

CREATE UNIQUE INDEX "EmployeeCompensationProfile_userId_key" ON "EmployeeCompensationProfile"("userId");
CREATE INDEX "EmployeeCompensationProfile_companyId_status_createdAt_idx" ON "EmployeeCompensationProfile"("companyId", "status", "createdAt");
CREATE INDEX "EmployeeCompensationProfile_companyId_userId_idx" ON "EmployeeCompensationProfile"("companyId", "userId");

CREATE UNIQUE INDEX "Payroll_journalEntryId_key" ON "Payroll"("journalEntryId");
CREATE INDEX "Payroll_companyId_status_periodStart_periodEnd_idx" ON "Payroll"("companyId", "status", "periodStart", "periodEnd");
CREATE INDEX "Payroll_processedById_createdAt_idx" ON "Payroll"("processedById", "createdAt");
CREATE INDEX "Payroll_approvedById_approvedAt_idx" ON "Payroll"("approvedById", "approvedAt");

CREATE INDEX "PayrollItem_companyId_employeeId_createdAt_idx" ON "PayrollItem"("companyId", "employeeId", "createdAt");
CREATE INDEX "PayrollItem_payrollId_itemType_idx" ON "PayrollItem"("payrollId", "itemType");
CREATE INDEX "PayrollItem_companyId_projectId_createdAt_idx" ON "PayrollItem"("companyId", "projectId", "createdAt");
CREATE INDEX "PayrollItem_companyId_taskId_createdAt_idx" ON "PayrollItem"("companyId", "taskId", "createdAt");

CREATE UNIQUE INDEX "TreasuryAccount_companyId_name_key" ON "TreasuryAccount"("companyId", "name");
CREATE INDEX "TreasuryAccount_companyId_type_status_idx" ON "TreasuryAccount"("companyId", "type", "status");
CREATE INDEX "TreasuryAccount_ledgerAccountId_idx" ON "TreasuryAccount"("ledgerAccountId");

CREATE UNIQUE INDEX "TreasuryTransaction_journalEntryId_key" ON "TreasuryTransaction"("journalEntryId");
CREATE INDEX "TreasuryTransaction_companyId_status_scheduledFor_idx" ON "TreasuryTransaction"("companyId", "status", "scheduledFor");
CREATE INDEX "TreasuryTransaction_companyId_direction_executedAt_idx" ON "TreasuryTransaction"("companyId", "direction", "executedAt");
CREATE INDEX "TreasuryTransaction_companyId_invoiceId_createdAt_idx" ON "TreasuryTransaction"("companyId", "invoiceId", "createdAt");
CREATE INDEX "TreasuryTransaction_fromAccountId_executedAt_idx" ON "TreasuryTransaction"("fromAccountId", "executedAt");
CREATE INDEX "TreasuryTransaction_toAccountId_executedAt_idx" ON "TreasuryTransaction"("toAccountId", "executedAt");

CREATE UNIQUE INDEX "Budget_companyId_name_key" ON "Budget"("companyId", "name");
CREATE INDEX "Budget_companyId_status_startsAt_endsAt_idx" ON "Budget"("companyId", "status", "startsAt", "endsAt");
CREATE INDEX "Budget_companyId_projectId_startsAt_idx" ON "Budget"("companyId", "projectId", "startsAt");

CREATE INDEX "BudgetLine_budgetId_accountId_idx" ON "BudgetLine"("budgetId", "accountId");
CREATE INDEX "BudgetLine_companyId_projectId_idx" ON "BudgetLine"("companyId", "projectId");
CREATE INDEX "BudgetLine_companyId_department_idx" ON "BudgetLine"("companyId", "department");

CREATE UNIQUE INDEX "Forecast_companyId_name_key" ON "Forecast"("companyId", "name");
CREATE INDEX "Forecast_companyId_status_startsAt_endsAt_idx" ON "Forecast"("companyId", "status", "startsAt", "endsAt");

CREATE UNIQUE INDEX "FinancialMetric_companyId_key_scope_periodStart_periodEnd_key" ON "FinancialMetric"("companyId", "key", "scope", "periodStart", "periodEnd");
CREATE INDEX "FinancialMetric_companyId_key_computedAt_idx" ON "FinancialMetric"("companyId", "key", "computedAt");
CREATE INDEX "FinancialMetric_companyId_projectId_periodStart_idx" ON "FinancialMetric"("companyId", "projectId", "periodStart");
CREATE INDEX "FinancialMetric_expiresAt_idx" ON "FinancialMetric"("expiresAt");

CREATE UNIQUE INDEX "ProfitabilitySnapshot_companyId_scope_projectId_clientId_employeeId_department_periodStart_periodEnd_key" ON "ProfitabilitySnapshot"("companyId", "scope", "projectId", "clientId", "employeeId", "department", "periodStart", "periodEnd");
CREATE INDEX "ProfitabilitySnapshot_companyId_scope_periodStart_periodEnd_idx" ON "ProfitabilitySnapshot"("companyId", "scope", "periodStart", "periodEnd");
CREATE INDEX "ProfitabilitySnapshot_companyId_projectId_periodStart_idx" ON "ProfitabilitySnapshot"("companyId", "projectId", "periodStart");
CREATE INDEX "ProfitabilitySnapshot_companyId_clientId_periodStart_idx" ON "ProfitabilitySnapshot"("companyId", "clientId", "periodStart");

CREATE INDEX "ApprovalFlow_companyId_status_createdAt_idx" ON "ApprovalFlow"("companyId", "status", "createdAt");
CREATE INDEX "ApprovalFlow_companyId_entityType_entityId_idx" ON "ApprovalFlow"("companyId", "entityType", "entityId");
CREATE INDEX "ApprovalFlow_createdById_createdAt_idx" ON "ApprovalFlow"("createdById", "createdAt");

CREATE UNIQUE INDEX "ApprovalStep_flowId_sortOrder_key" ON "ApprovalStep"("flowId", "sortOrder");
CREATE INDEX "ApprovalStep_companyId_status_dueAt_idx" ON "ApprovalStep"("companyId", "status", "dueAt");
CREATE INDEX "ApprovalStep_assignedToId_status_dueAt_idx" ON "ApprovalStep"("assignedToId", "status", "dueAt");
CREATE INDEX "ApprovalStep_decidedById_decidedAt_idx" ON "ApprovalStep"("decidedById", "decidedAt");

CREATE INDEX "TimeEntry_companyId_employeeId_workDate_idx" ON "TimeEntry"("companyId", "employeeId", "workDate");
CREATE INDEX "TimeEntry_companyId_projectId_workDate_idx" ON "TimeEntry"("companyId", "projectId", "workDate");
CREATE INDEX "TimeEntry_companyId_taskId_workDate_idx" ON "TimeEntry"("companyId", "taskId", "workDate");
CREATE INDEX "TimeEntry_companyId_clientId_workDate_idx" ON "TimeEntry"("companyId", "clientId", "workDate");
CREATE INDEX "TimeEntry_companyId_status_workDate_idx" ON "TimeEntry"("companyId", "status", "workDate");

ALTER TABLE "ChartOfAccount" ADD CONSTRAINT "ChartOfAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Account" ADD CONSTRAINT "Account_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Account" ADD CONSTRAINT "Account_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "ChartOfAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Account" ADD CONSTRAINT "Account_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinancialPeriod" ADD CONSTRAINT "FinancialPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialPeriod" ADD CONSTRAINT "FinancialPeriod_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FinancialPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalOfEntryId_fkey" FOREIGN KEY ("reversalOfEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FinancialPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_journalLineId_fkey" FOREIGN KEY ("journalLineId") REFERENCES "JournalLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_treasuryAccountId_fkey" FOREIGN KEY ("treasuryAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FinancialPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransactionReference" ADD CONSTRAINT "TransactionReference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionReference" ADD CONSTRAINT "TransactionReference_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransactionReference" ADD CONSTRAINT "TransactionReference_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "Ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransactionReference" ADD CONSTRAINT "TransactionReference_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinancialAuditLog" ADD CONSTRAINT "FinancialAuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialAuditLog" ADD CONSTRAINT "FinancialAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_treasuryTransactionId_fkey" FOREIGN KEY ("treasuryTransactionId") REFERENCES "TreasuryTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeCompensationProfile" ADD CONSTRAINT "EmployeeCompensationProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeCompensationProfile" ADD CONSTRAINT "EmployeeCompensationProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TreasuryAccount" ADD CONSTRAINT "TreasuryAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TreasuryAccount" ADD CONSTRAINT "TreasuryAccount_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TreasuryTransaction" ADD CONSTRAINT "TreasuryTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TreasuryTransaction" ADD CONSTRAINT "TreasuryTransaction_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreasuryTransaction" ADD CONSTRAINT "TreasuryTransaction_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreasuryTransaction" ADD CONSTRAINT "TreasuryTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreasuryTransaction" ADD CONSTRAINT "TreasuryTransaction_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreasuryTransaction" ADD CONSTRAINT "TreasuryTransaction_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreasuryTransaction" ADD CONSTRAINT "TreasuryTransaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Budget" ADD CONSTRAINT "Budget_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FinancialPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FinancialPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinancialMetric" ADD CONSTRAINT "FinancialMetric_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialMetric" ADD CONSTRAINT "FinancialMetric_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialMetric" ADD CONSTRAINT "FinancialMetric_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProfitabilitySnapshot" ADD CONSTRAINT "ProfitabilitySnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfitabilitySnapshot" ADD CONSTRAINT "ProfitabilitySnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProfitabilitySnapshot" ADD CONSTRAINT "ProfitabilitySnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApprovalFlow" ADD CONSTRAINT "ApprovalFlow_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalFlow" ADD CONSTRAINT "ApprovalFlow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "ApprovalFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_payrollItemId_fkey" FOREIGN KEY ("payrollItemId") REFERENCES "PayrollItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "prevent_financial_immutable_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Immutable financial records cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "JournalLine_prevent_update_delete"
  BEFORE UPDATE OR DELETE ON "JournalLine"
  FOR EACH ROW EXECUTE FUNCTION "prevent_financial_immutable_mutation"();

CREATE TRIGGER "Ledger_prevent_update_delete"
  BEFORE UPDATE OR DELETE ON "Ledger"
  FOR EACH ROW EXECUTE FUNCTION "prevent_financial_immutable_mutation"();

CREATE TRIGGER "FinancialAuditLog_prevent_update_delete"
  BEFORE UPDATE OR DELETE ON "FinancialAuditLog"
  FOR EACH ROW EXECUTE FUNCTION "prevent_financial_immutable_mutation"();

COMMENT ON TABLE "ChartOfAccount" IS 'Tenant-scoped charts of accounts for TASKIT financial operating system workspaces.';
COMMENT ON TABLE "Account" IS 'Tenant-scoped general-ledger accounts with explicit normal balances and soft-delete support.';
COMMENT ON TABLE "JournalEntry" IS 'Balanced double-entry journal headers. Posted entries are represented in the immutable Ledger table.';
COMMENT ON TABLE "JournalLine" IS 'Immutable debit/credit journal lines. Exactly one side must be positive per line.';
COMMENT ON TABLE "Ledger" IS 'Immutable ledger postings created only from validated journal lines.';
COMMENT ON TABLE "FinancialAuditLog" IS 'Tamper-evident financial audit trail with hash chaining metadata.';
COMMENT ON TABLE "Payroll" IS 'Payroll runs prepared for approval and ledger posting.';
COMMENT ON TABLE "Expense" IS 'Expense operations with receipt/OCR-ready metadata, approvals, treasury linking, and ledger references.';
COMMENT ON TABLE "TreasuryTransaction" IS 'Cash movement and payment tracking linked to treasury accounts and ledger entries.';
COMMENT ON TABLE "ProfitabilitySnapshot" IS 'Delivery-to-cash profitability snapshots connecting finance, clients, projects, employees, and operations.';
