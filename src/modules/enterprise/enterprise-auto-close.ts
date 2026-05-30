import { enterpriseRepositoryPrisma } from '@/modules/enterprise/enterprise.repository'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { logger } from '@/modules/shared/logger'

export async function autoCloseResolvedIncidents(): Promise<{ closed: number }> {
  const now = new Date()

  const candidates = await enterpriseRepositoryPrisma.enterpriseIncident.findMany({
    where: {
      status: 'RESOLVED',
      autoCloseAt: { lte: now, not: null },
      closedAt: null,
    },
    select: { id: true, incidentNumber: true, title: true, companyId: true, resolvedAt: true, autoCloseAt: true },
  })

  let closed = 0

  for (const incident of candidates) {
    await enterpriseRepositoryPrisma.enterpriseIncident.update({
      where: { id: incident.id },
      data: {
        status: 'CLOSED',
        closedAt: now,
        resolution: 'Auto-closed after resolution timeout.',
        auditTrail: [
          { at: now.toISOString(), action: 'auto_closed', reason: `Auto-close triggered at ${now.toISOString()} (autoCloseAt: ${incident.autoCloseAt?.toISOString()})` },
        ] as any,
      },
    })

    await publishDomainEvent({
      type: 'enterprise.incident.updated',
      companyId: incident.companyId,
      actorId: null,
      entityType: 'enterprise_incident',
      entityId: incident.id,
      action: 'Incident auto-closed',
      payload: { incidentId: incident.id, incidentNumber: incident.incidentNumber },
    })

    closed++
  }

  logger.info('enterprise.auto_close_run', { scanned: candidates.length, closed })
  return { closed }
}
