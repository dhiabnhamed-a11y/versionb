import { prisma } from '@/lib/db'
import { logger } from '@/modules/shared/logger'

const COST_PER_OPERATION: Record<string, number> = {
  'ai_chat':         0.002,   
  'ai_action':       0.005,   
  'contract_gen':    0.020,   
  'report_export':   0.001,   
  'media_transform': 0.0005,  
}

export async function trackOperationCost(params: {
  companyId: string
  userId: string
  operation: string
  metadata?: Record<string, unknown>
}) {
  const estimatedCostUsd = COST_PER_OPERATION[params.operation] ?? 0

  try {
    await prisma.analyticsMetric.create({
      data: {
        companyId: params.companyId,
        metric: 'operation_cost',
        value: estimatedCostUsd,
        dimensions: {
          operation: params.operation,
          userId: params.userId,
          ...params.metadata,
        },
        recordedAt: new Date(),
      },
    })
  } catch (err) {
    logger.warn('cost_attribution.failed', { error: String(err), ...params })
  }
}

export async function getCostByTenant(startDate: Date, endDate: Date) {
  return prisma.analyticsMetric.groupBy({
    by: ['companyId'],
    where: {
      metric: 'operation_cost',
      recordedAt: { gte: startDate, lte: endDate },
    },
    _sum: { value: true },
    _count: { id: true },
    orderBy: { _sum: { value: 'desc' } },
  })
}
