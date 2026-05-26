import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { defaultCurrencyForCountry, normalizeCurrencyCode } from '@/lib/currencies'
import { badRequest } from '@/modules/shared/errors'
import { STANDARD_COA } from '@/services/erp2/coa'

type TransactionClient = Prisma.TransactionClient

export async function ensureErpWorkspaceInitialized(
  tx: TransactionClient,
  workspaceId: string,
  baseCurrency?: string
) {
  const company = await tx.company.findUnique({
    where: { id: workspaceId },
    select: { country: true },
  })
  const requestedCurrency = baseCurrency ? normalizeCurrencyCode(baseCurrency) : null
  const workspaceCurrency = requestedCurrency ?? defaultCurrencyForCountry(company?.country)
  const existing = await tx.eRPFiscalYear.findFirst({
    where: { workspaceId, isDeleted: false },
    select: { id: true },
  })

  if (existing) {
    const [settings] = await Promise.all([
      tx.eRPSettings.upsert({
        where: { workspaceId },
        create: {
          workspaceId,
          defaultCurrency: workspaceCurrency,
          accountingBasis: 'ACCRUAL',
          fiscalYearStartMonth: 1,
        },
        update: {},
      }),
      tx.eRPSetupProgress.upsert({
        where: { workspaceId },
        create: {
          workspaceId,
          step1Done: true,
          step2Done: true,
          step3Done: true,
          step4Done: true,
          step5Done: true,
          step6Done: true,
          completedAt: new Date(),
        },
        update: {},
      }),
    ])

    return { initialized: false as const, fiscalYearId: existing.id, accountsCreated: 0, currency: settings.defaultCurrency }
  }

  const currency = workspaceCurrency
  const now = new Date()
  const year = now.getFullYear()

  const fiscalYear = await tx.eRPFiscalYear.create({
    data: {
      workspaceId,
      name: `FY ${year}`,
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31),
      status: 'OPEN',
      periods: {
        create: Array.from({ length: 12 }, (_, i) => ({
          workspaceId,
          name: new Date(year, i, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
          startDate: new Date(year, i, 1),
          endDate: new Date(year, i + 1, 0, 23, 59, 59, 999),
        })),
      },
    },
    include: { periods: true },
  })

  const parentMap = new Map<string, string>()

  for (const acc of STANDARD_COA) {
    if (!acc.parentCode) {
      const created = await tx.eRPAccount.create({
        data: {
          workspaceId,
          fiscalYearId: fiscalYear.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          currency,
        },
      })
      parentMap.set(acc.code, created.id)
    }
  }

  for (const acc of STANDARD_COA) {
    if (acc.parentCode) {
      await tx.eRPAccount.create({
        data: {
          workspaceId,
          fiscalYearId: fiscalYear.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          currency,
          parentId: parentMap.get(acc.parentCode),
        },
      })
    }
  }

  await Promise.all([
    tx.eRPSettings.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        defaultCurrency: currency,
        accountingBasis: 'ACCRUAL',
        fiscalYearStartMonth: 1,
      },
      update: {
        defaultCurrency: currency,
      },
    }),
    tx.eRPSetupProgress.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        step1Done: true,
        step2Done: true,
        step3Done: true,
        step4Done: true,
        step5Done: true,
        step6Done: true,
        completedAt: new Date(),
      },
      update: {
        step1Done: true,
        step2Done: true,
        step3Done: true,
        step4Done: true,
        step5Done: true,
        step6Done: true,
        completedAt: new Date(),
      },
    }),
  ])

  return { initialized: true as const, fiscalYearId: fiscalYear.id, accountsCreated: STANDARD_COA.length, currency }
}

export async function setupErpWorkspace(workspaceId: string, baseCurrency?: string) {
  const existing = await prisma.eRPFiscalYear.findFirst({
    where: { workspaceId, isDeleted: false },
    select: { id: true },
  })

  if (existing) {
    throw badRequest('ERP workspace is already initialized')
  }

  return prisma.$transaction((tx) => ensureErpWorkspaceInitialized(tx, workspaceId, baseCurrency), {
    maxWait: 10_000,
    timeout: 30_000,
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })
}
