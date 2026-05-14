import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { toJsonValue } from '@/modules/shared/json'
import type { SessionUser } from '@/modules/shared/session'
import { assertFinanceManage, requireFinanceCompany } from '@/modules/finance/policy'
import { writeFinancialAuditLog } from '@/modules/finance/audit.repository'

type TransactionClient = Prisma.TransactionClient

const RECOMMENDED_ACCOUNTS = [
  { code: '1000', name: 'Operating Cash', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1100', name: 'Accounts Receivable', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1200', name: 'Tax Receivable', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '2100', name: 'Payroll Liabilities', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '2200', name: 'Tax Liabilities', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '3000', name: 'Owner Equity', type: 'EQUITY', normalBalance: 'CREDIT' },
  { code: '4000', name: 'Service Revenue', type: 'REVENUE', normalBalance: 'CREDIT' },
  { code: '4100', name: 'Retainer Revenue', type: 'REVENUE', normalBalance: 'CREDIT' },
  { code: '5000', name: 'Payroll Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '5100', name: 'Contractor Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '5200', name: 'Software and Tools', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '5300', name: 'Production Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '5400', name: 'Marketing Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '5500', name: 'Travel and Meals', type: 'EXPENSE', normalBalance: 'DEBIT' },
] as const

const EXPENSE_CATEGORIES = [
  { name: 'Software and subscriptions', accountCode: '5200' },
  { name: 'Production costs', accountCode: '5300' },
  { name: 'Contractors', accountCode: '5100' },
  { name: 'Marketing', accountCode: '5400' },
  { name: 'Travel and meals', accountCode: '5500' },
] as const

async function findOrCreateChart(tx: TransactionClient, companyId: string) {
  const existing = await tx.chartOfAccount.findFirst({
    where: { companyId, isDefault: true },
    select: { id: true, name: true },
  })
  if (existing) return existing

  return tx.chartOfAccount.create({
    data: {
      companyId,
      name: 'TASKIT Financial Foundation',
      description: 'Recommended operating structure for agency and service-business finance.',
      currency: 'USD',
      isDefault: true,
      metadata: toJsonValue({ generatedBy: 'taskit_finance_setup_v1' }),
    },
    select: { id: true, name: true },
  })
}

async function ensureCurrentPeriod(tx: TransactionClient, companyId: string) {
  const now = new Date()
  const year = now.getUTCFullYear()
  const name = `${year} Financial Year`
  const existing = await tx.financialPeriod.findFirst({ where: { companyId, name }, select: { id: true } })
  if (existing) return existing

  const startsAt = new Date(Date.UTC(year, 0, 1))
  const endsAt = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
  const overlap = await tx.financialPeriod.findFirst({
    where: {
      companyId,
      startsAt: { lte: endsAt },
      endsAt: { gte: startsAt },
    },
    select: { id: true },
  })
  if (overlap) return overlap

  return tx.financialPeriod.create({
    data: {
      companyId,
      name,
      startsAt,
      endsAt,
      metadata: toJsonValue({ generatedBy: 'taskit_finance_setup_v1' }),
    },
    select: { id: true },
  })
}

export async function initializeRecommendedFinanceWorkspace(user: SessionUser) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)

  return prisma.$transaction(async (tx) => {
    const chart = await findOrCreateChart(tx, companyId)
    const existingAccounts = await tx.account.findMany({
      where: { companyId, code: { in: RECOMMENDED_ACCOUNTS.map((account) => account.code) }, deletedAt: null },
      select: { id: true, code: true },
    })
    const accountByCode = new Map(existingAccounts.map((account) => [account.code, account]))
    const createdAccounts: Array<{ id: string; code: string; name: string }> = []

    for (const account of RECOMMENDED_ACCOUNTS) {
      if (accountByCode.has(account.code)) continue
      const created = await tx.account.create({
        data: {
          companyId,
          chartId: chart.id,
          code: account.code,
          name: account.name,
          type: account.type,
          normalBalance: account.normalBalance,
          currency: 'USD',
          isSystem: true,
          metadata: toJsonValue({ generatedBy: 'taskit_finance_setup_v1', recommendedFor: ['agency', 'service_business'] }),
        },
        select: { id: true, code: true, name: true },
      })
      accountByCode.set(created.code, created)
      createdAccounts.push(created)
    }

    const createdCategories: Array<{ id: string; name: string }> = []
    for (const category of EXPENSE_CATEGORIES) {
      const exists = await tx.expenseCategory.findFirst({ where: { companyId, name: category.name }, select: { id: true } })
      if (exists) continue
      const account = accountByCode.get(category.accountCode)
      const created = await tx.expenseCategory.create({
        data: {
          companyId,
          name: category.name,
          defaultAccountId: account?.id ?? null,
          metadata: toJsonValue({ generatedBy: 'taskit_finance_setup_v1' }),
        },
        select: { id: true, name: true },
      })
      createdCategories.push(created)
    }

    const cashAccount = accountByCode.get('1000')
    const existingTreasury = await tx.treasuryAccount.findFirst({ where: { companyId, name: 'Operating Cash' }, select: { id: true } })
    const treasuryAccount =
      existingTreasury ??
      (await tx.treasuryAccount.create({
        data: {
          companyId,
          ledgerAccountId: cashAccount?.id ?? null,
          name: 'Operating Cash',
          type: 'BANK',
          currency: 'USD',
          metadata: toJsonValue({ generatedBy: 'taskit_finance_setup_v1' }),
        },
        select: { id: true },
      }))

    const period = await ensureCurrentPeriod(tx, companyId)

    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: 'finance.workspace.initialized',
      entityType: 'finance_workspace',
      entityId: companyId,
      after: {
        chartId: chart.id,
        createdAccountCount: createdAccounts.length,
        createdExpenseCategoryCount: createdCategories.length,
        treasuryAccountId: treasuryAccount.id,
        periodId: period.id,
      },
      metadata: { setupProfile: 'agency_service_business_recommended' },
    })

    return {
      initialized: true,
      chart,
      createdAccountCount: createdAccounts.length,
      createdExpenseCategoryCount: createdCategories.length,
      treasuryAccountId: treasuryAccount.id,
      periodId: period.id,
      message: 'Your financial workspace is ready.',
    }
  })
}

