import 'server-only'

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { toJsonValue } from '@/modules/shared/json'
import type { StandardAgencyAccount, StandardAccountCategory } from '@/services/erp/standard-agency-coa'

export const erpAccountSelect = {
  id: true,
  companyId: true,
  chartId: true,
  categoryId: true,
  parentAccountId: true,
  code: true,
  name: true,
  description: true,
  type: true,
  normalBalance: true,
  currency: true,
  status: true,
  isSystem: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, code: true, name: true, rootType: true } },
  parent: { select: { id: true, code: true, name: true } },
} satisfies Prisma.AccountSelect

export function listErpAccounts(companyId: string) {
  return prisma.account.findMany({
    where: { companyId, deletedAt: null },
    select: erpAccountSelect,
    orderBy: [{ code: 'asc' }, { name: 'asc' }],
  })
}

export function findDefaultChart(companyId: string) {
  return prisma.chartOfAccount.findFirst({
    where: { companyId, isDefault: true },
    select: { id: true, name: true },
  })
}

export async function seedStandardAgencyChart(input: {
  companyId: string
  baseCurrency: string
  categories: StandardAccountCategory[]
  accounts: StandardAgencyAccount[]
  defaultCodes: {
    cash: string
    receivable: string
    payable: string
    retainedEarnings: string
  }
}) {
  return prisma.$transaction(async (tx) => {
    const chart =
      (await tx.chartOfAccount.findFirst({ where: { companyId: input.companyId, isDefault: true }, select: { id: true, name: true } })) ??
      (await tx.chartOfAccount.create({
        data: {
          companyId: input.companyId,
          name: 'TASKIT Agency ERP Chart of Accounts',
          description: 'Production-grade agency and service-business chart of accounts.',
          currency: input.baseCurrency,
          isDefault: true,
          metadata: toJsonValue({ generatedBy: 'taskit_erp_phase1', profile: 'agency_service_business' }),
        },
        select: { id: true, name: true },
      }))

    await tx.accountCategory.createMany({
      data: input.categories.map((category) => ({
        companyId: input.companyId,
        code: category.code,
        name: category.name,
        rootType: category.rootType,
        sortOrder: category.sortOrder,
        metadata: toJsonValue({ generatedBy: 'taskit_erp_phase1' }),
      })),
      skipDuplicates: true,
    })

    const categories = await tx.accountCategory.findMany({
      where: { companyId: input.companyId, code: { in: input.categories.map((category) => category.code) } },
      select: { id: true, code: true },
    })
    const categoryByCode = new Map(categories.map((category) => [category.code, category.id]))

    for (const account of input.accounts) {
      const existing = await tx.account.findUnique({
        where: { companyId_code: { companyId: input.companyId, code: account.code } },
        select: { id: true },
      })
      const parent = account.parentCode
        ? await tx.account.findUnique({
            where: { companyId_code: { companyId: input.companyId, code: account.parentCode } },
            select: { id: true },
          })
        : null

      if (existing) {
        await tx.account.update({
          where: { id: existing.id },
          data: {
            chartId: chart.id,
            categoryId: categoryByCode.get(account.categoryCode) ?? null,
            parentAccountId: parent?.id ?? null,
            type: account.type,
            normalBalance: account.normalBalance,
            isSystem: true,
          },
        })
      } else {
        await tx.account.create({
          data: {
            companyId: input.companyId,
            chartId: chart.id,
            categoryId: categoryByCode.get(account.categoryCode) ?? null,
            parentAccountId: parent?.id ?? null,
            code: account.code,
            name: account.name,
            type: account.type,
            normalBalance: account.normalBalance,
            currency: input.baseCurrency,
            isSystem: true,
            metadata: toJsonValue({ generatedBy: 'taskit_erp_phase1', recommendedFor: ['agency', 'service_business'] }),
          },
        })
      }
    }

    const defaultAccounts = await tx.account.findMany({
      where: { companyId: input.companyId, code: { in: Object.values(input.defaultCodes) } },
      select: { id: true, code: true },
    })
    const accountByCode = new Map(defaultAccounts.map((account) => [account.code, account.id]))

    await tx.erpWorkspaceSettings.upsert({
      where: { companyId: input.companyId },
      create: {
        companyId: input.companyId,
        baseCurrency: input.baseCurrency,
        accountingBasis: 'ACCRUAL',
        defaultChartId: chart.id,
        defaultCashAccountId: accountByCode.get(input.defaultCodes.cash) ?? null,
        defaultReceivableAccountId: accountByCode.get(input.defaultCodes.receivable) ?? null,
        defaultPayableAccountId: accountByCode.get(input.defaultCodes.payable) ?? null,
        retainedEarningsAccountId: accountByCode.get(input.defaultCodes.retainedEarnings) ?? null,
        metadata: toJsonValue({ generatedBy: 'taskit_erp_phase1' }),
      },
      update: {
        baseCurrency: input.baseCurrency,
        defaultChartId: chart.id,
        defaultCashAccountId: accountByCode.get(input.defaultCodes.cash) ?? undefined,
        defaultReceivableAccountId: accountByCode.get(input.defaultCodes.receivable) ?? undefined,
        defaultPayableAccountId: accountByCode.get(input.defaultCodes.payable) ?? undefined,
        retainedEarningsAccountId: accountByCode.get(input.defaultCodes.retainedEarnings) ?? undefined,
      },
    })

    const accounts = await tx.account.findMany({
      where: { companyId: input.companyId, deletedAt: null },
      select: erpAccountSelect,
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    })

    return { chart, accounts }
  })
}
