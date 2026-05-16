import 'server-only'

import { prisma } from '@/lib/db'

export async function getAiObservabilitySummary(companyId: string) {
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const [runs, actions, approvals, failures, incidents] = await Promise.all([
    prisma.aiRun.count({ where: { companyId, createdAt: { gte: since } } }),
    prisma.aiToolExecution.count({ where: { companyId, createdAt: { gte: since } } }),
    prisma.aiApproval.count({ where: { companyId, createdAt: { gte: since } } }),
    prisma.aiRun.count({ where: { companyId, status: 'FAILED', createdAt: { gte: since } } }),
    prisma.aiObservation.count({ where: { companyId, severity: { in: ['ERROR', 'CRITICAL'] }, createdAt: { gte: since } } }),
  ])

  const cost = await prisma.aiRun.aggregate({
    where: { companyId, createdAt: { gte: since } },
    _sum: { estimatedCostUsd: true, promptTokens: true, completionTokens: true, latencyMs: true },
    _avg: { latencyMs: true },
  })

  return {
    windowDays: 30,
    runs,
    toolExecutions: actions,
    approvals,
    failedRuns: failures,
    safetyIncidents: incidents,
    estimatedCostUsd: Number(cost._sum.estimatedCostUsd ?? 0),
    promptTokens: cost._sum.promptTokens ?? 0,
    completionTokens: cost._sum.completionTokens ?? 0,
    averageLatencyMs: Math.round(cost._avg.latencyMs ?? 0),
  }
}
