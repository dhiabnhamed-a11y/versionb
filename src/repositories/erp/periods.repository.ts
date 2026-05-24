import 'server-only'

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export function listErpPeriods(companyId: string) {
  return prisma.financialPeriod.findMany({
    where: { companyId },
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
  })
}

export function lockErpPeriod(input: { companyId: string; periodId: string; actorId: string; reason?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.financialPeriod.findFirst({ where: { id: input.periodId, companyId: input.companyId } })
    if (!existing) return null
    if (existing.status === 'LOCKED' || existing.status === 'CLOSED') return existing

    return tx.financialPeriod.update({
      where: { id: existing.id },
      data: {
        status: 'LOCKED',
        lockedAt: new Date(),
        lockedById: input.actorId,
        lockReason: input.reason?.trim() || null,
      } satisfies Prisma.FinancialPeriodUpdateInput,
    })
  })
}
