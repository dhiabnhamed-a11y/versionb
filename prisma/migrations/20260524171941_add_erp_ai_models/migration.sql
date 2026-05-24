-- AlterTable: add accountBalases relation (no column change needed on ERPAccount)

-- CreateEnum
CREATE TYPE "ERPAlertType" AS ENUM ('DUPLICATE_TRANSACTION', 'EXPENSE_SPIKE', 'ROUND_NUMBER', 'WEEKEND_POSTING', 'MISSING_REFERENCE', 'OVERDUE_AR', 'BUDGET_THRESHOLD', 'CASH_LOW', 'PAYROLL_ANOMALY');

-- CreateEnum
CREATE TYPE "ERPAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "ERPAlert" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "ERPAlertType" NOT NULL,
    "severity" "ERPAlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "aiConfidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ERPAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ERPVendorCategoryMapping" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "learnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ERPVendorCategoryMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ERPAccountBalance" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "debitTotal" INTEGER NOT NULL DEFAULT 0,
    "creditTotal" INTEGER NOT NULL DEFAULT 0,
    "netChange" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ERPAccountBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ERPSetupProgress" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "step1Done" BOOLEAN NOT NULL DEFAULT false,
    "step2Done" BOOLEAN NOT NULL DEFAULT false,
    "step3Done" BOOLEAN NOT NULL DEFAULT false,
    "step4Done" BOOLEAN NOT NULL DEFAULT false,
    "step5Done" BOOLEAN NOT NULL DEFAULT false,
    "step6Done" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ERPSetupProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ERPVendorCategoryMapping_workspaceId_vendorName_key" ON "ERPVendorCategoryMapping"("workspaceId", "vendorName");

-- CreateIndex
CREATE UNIQUE INDEX "ERPAccountBalance_workspaceId_accountId_month_year_key" ON "ERPAccountBalance"("workspaceId", "accountId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ERPSetupProgress_workspaceId_key" ON "ERPSetupProgress"("workspaceId");

-- AddForeignKey
ALTER TABLE "ERPAccountBalance" ADD CONSTRAINT "ERPAccountBalance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ERPAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
