import { prisma } from '@/lib/db'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { logger } from '@/modules/shared/logger'

export async function checkApprovalEscalations(): Promise<{ processed: number; alerts: number }> {
  const now = new Date()
  let alerts = 0

  const pendingSteps = await prisma.enterpriseApprovalStep.findMany({
    where: { decision: 'PENDING', timeoutHours: { gt: 0 } },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      team: { select: { id: true, name: true, managerId: true } },
    },
  })

  for (const step of pendingSteps) {
    if (!step.createdAt) continue
    const elapsedMs = now.getTime() - new Date(step.createdAt).getTime()
    const timeoutMs = step.timeoutHours * 60 * 60 * 1000
    if (elapsedMs < timeoutMs) continue

    await prisma.enterpriseApprovalStep.update({
      where: { id: step.id },
      data: { decision: 'ESCALATED', decidedAt: now, comments: 'Auto-escalated due to timeout.' },
    })

    alerts++

    const escalationContact = step.team?.managerId || step.assigneeId
    await publishDomainEvent({
      type: 'enterprise.approval.escalated',
      companyId: step.companyId,
      actorId: null,
      entityType: step.entityType,
      entityId: step.entityId,
      action: 'Approval step auto-escalated due to timeout',
      payload: { stepId: step.id, stepLabel: step.label, escalatedTo: escalationContact },
    })
  }

  logger.info('enterprise.approval_escalation_check', { processed: pendingSteps.length, alerts })
  return { processed: pendingSteps.length, alerts }
}
