import 'server-only'

import { prisma } from '@/lib/db'
import { badRequest } from '@/modules/shared/errors'
import { STANDARD_COA } from '@/services/erp2/coa'

export async function setupErpWorkspace(workspaceId: string, baseCurrency?: string) {
  const existing = await prisma.eRPFiscalYear.findFirst({
    where: { workspaceId, isDeleted: false },
  })

  if (existing) {
    throw badRequest('ERP workspace is already initialized')
  }

  const currency = baseCurrency ?? 'USD'
  const now = new Date()
  const year = now.getFullYear()

  const fiscalYear = await prisma.eRPFiscalYear.create({
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

  const parentCodes = new Set(STANDARD_COA.filter((a) => !a.parentCode).map((a) => a.code))
  const parentMap = new Map<string, string>()

  for (const acc of STANDARD_COA) {
    if (!acc.parentCode) {
      const created = await prisma.eRPAccount.create({
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
      await prisma.eRPAccount.create({
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

  return { fiscalYearId: fiscalYear.id, accountsCreated: STANDARD_COA.length, currency }
}
