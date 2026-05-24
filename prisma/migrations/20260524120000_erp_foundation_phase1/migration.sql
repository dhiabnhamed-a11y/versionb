-- Phase 1 ERP foundation hardening.
-- Extends the existing TASKIT finance core instead of creating a parallel ledger.

CREATE TABLE "ErpWorkspaceSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "accountingBasis" TEXT NOT NULL DEFAULT 'ACCRUAL',
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "defaultChartId" TEXT,
    "defaultCashAccountId" TEXT,
    "defaultReceivableAccountId" TEXT,
    "defaultPayableAccountId" TEXT,
    "retainedEarningsAccountId" TEXT,
    "exchangeRateProvider" TEXT NOT NULL DEFAULT 'OPEN_EXCHANGE_RATES',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpWorkspaceSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "parentCategoryId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rootType" "FinancialAccountType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "parentCostCenterId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "FinancialRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'OPEN_EXCHANGE_RATES',
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rateDate" TIMESTAMP(3) NOT NULL,
    "rateMicros" BIGINT NOT NULL,
    "sourcePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Account" ADD COLUMN "categoryId" TEXT;

ALTER TABLE "FinancialPeriod"
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "lockedById" TEXT,
  ADD COLUMN "lockReason" TEXT;

ALTER TABLE "JournalEntry"
  ADD COLUMN "accountingBasis" TEXT NOT NULL DEFAULT 'ACCRUAL',
  ADD COLUMN "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN "totalDebitMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "totalCreditMinor" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "JournalLine"
  ADD COLUMN "debitMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "creditMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "baseDebitMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "baseCreditMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "departmentId" TEXT,
  ADD COLUMN "costCenterId" TEXT,
  ADD COLUMN "reconciliationId" TEXT,
  ADD COLUMN "reconciledAt" TIMESTAMP(3),
  ADD COLUMN "reconciledById" TEXT;

ALTER TABLE "Ledger"
  ADD COLUMN "debitMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "creditMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "balanceImpactMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "baseDebitMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "baseCreditMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "departmentId" TEXT,
  ADD COLUMN "costCenterId" TEXT;

CREATE UNIQUE INDEX "ErpWorkspaceSettings_companyId_key" ON "ErpWorkspaceSettings"("companyId");
CREATE INDEX "ErpWorkspaceSettings_companyId_baseCurrency_idx" ON "ErpWorkspaceSettings"("companyId", "baseCurrency");

CREATE UNIQUE INDEX "AccountCategory_companyId_code_key" ON "AccountCategory"("companyId", "code");
CREATE INDEX "AccountCategory_companyId_rootType_sortOrder_idx" ON "AccountCategory"("companyId", "rootType", "sortOrder");
CREATE INDEX "AccountCategory_companyId_parentCategoryId_idx" ON "AccountCategory"("companyId", "parentCategoryId");

CREATE UNIQUE INDEX "CostCenter_companyId_code_key" ON "CostCenter"("companyId", "code");
CREATE INDEX "CostCenter_companyId_status_code_idx" ON "CostCenter"("companyId", "status", "code");
CREATE INDEX "CostCenter_companyId_parentCostCenterId_idx" ON "CostCenter"("companyId", "parentCostCenterId");

CREATE UNIQUE INDEX "ExchangeRate_companyId_provider_baseCurrency_quoteCurrency_rateDate_key"
  ON "ExchangeRate"("companyId", "provider", "baseCurrency", "quoteCurrency", "rateDate");
CREATE INDEX "ExchangeRate_companyId_baseCurrency_quoteCurrency_rateDate_idx"
  ON "ExchangeRate"("companyId", "baseCurrency", "quoteCurrency", "rateDate");

CREATE INDEX "Account_companyId_categoryId_idx" ON "Account"("companyId", "categoryId");
CREATE INDEX "JournalLine_companyId_departmentId_createdAt_idx" ON "JournalLine"("companyId", "departmentId", "createdAt");
CREATE INDEX "JournalLine_companyId_costCenterId_createdAt_idx" ON "JournalLine"("companyId", "costCenterId", "createdAt");
CREATE INDEX "JournalLine_companyId_reconciliationId_idx" ON "JournalLine"("companyId", "reconciliationId");
CREATE INDEX "Ledger_companyId_departmentId_postingDate_idx" ON "Ledger"("companyId", "departmentId", "postingDate");
CREATE INDEX "Ledger_companyId_costCenterId_postingDate_idx" ON "Ledger"("companyId", "costCenterId", "postingDate");

ALTER TABLE "ErpWorkspaceSettings"
  ADD CONSTRAINT "ErpWorkspaceSettings_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountCategory"
  ADD CONSTRAINT "AccountCategory_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountCategory"
  ADD CONSTRAINT "AccountCategory_parentCategoryId_fkey"
  FOREIGN KEY ("parentCategoryId") REFERENCES "AccountCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CostCenter"
  ADD CONSTRAINT "CostCenter_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CostCenter"
  ADD CONSTRAINT "CostCenter_parentCostCenterId_fkey"
  FOREIGN KEY ("parentCostCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExchangeRate"
  ADD CONSTRAINT "ExchangeRate_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Account"
  ADD CONSTRAINT "Account_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "AccountCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalLine"
  ADD CONSTRAINT "JournalLine_costCenterId_fkey"
  FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalLine"
  ADD CONSTRAINT "JournalLine_reconciliationId_fkey"
  FOREIGN KEY ("reconciliationId") REFERENCES "Reconciliation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Ledger"
  ADD CONSTRAINT "Ledger_costCenterId_fkey"
  FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
