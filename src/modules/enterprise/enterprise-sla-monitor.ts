import { prisma } from '@/lib/db'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { enqueueOperationalJob } from '@/modules/jobs/job-queue'
import { logger } from '@/modules/shared/logger'

type SlaCheckResult = {
  companyId: string
  incidentId: string
  incidentNumber: string
  priority: string
  slaPolicyId: string | null
  responseDueAt: Date | null
  resolutionDueAt: Date | null
  responsePct: number
  resolutionPct: number
  responseBreached: boolean
  resolutionBreached: boolean
}

export async function checkActiveSlaCompliance(): Promise<{ checked: number; alerts: number }> {
  const now = new Date()

  const activeIncidents = await prisma.enterpriseIncident.findMany({
    where: {
      status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] },
      OR: [
        { responseDueAt: { not: null } },
        { resolutionDueAt: { not: null } },
      ],
    },
    select: {
      id: true,
      companyId: true,
      incidentNumber: true,
      priority: true,
      slaPolicyId: true,
      responseDueAt: true,
      resolutionDueAt: true,
      createdAt: true,
      firstRespondedAt: true,
      resolvedAt: true,
      auditTrail: true,
    },
  })

  let alertsFired = 0

  for (const incident of activeIncidents) {
    const result = calcSlaStatus(incident, now)
    if (!result) continue

    const thresholds = await getSlaThresholds(result)
    for (const threshold of thresholds) {
      if (!threshold.shouldAlert) continue

      await fireSlaAlert(incident.companyId, incident.id, incident.incidentNumber, result, threshold)
      alertsFired++
    }

    if (result.responseBreached || result.resolutionBreached) {
      await recordBreach(incident, result, now)
    }
  }

  return { checked: activeIncidents.length, alerts: alertsFired }
}

function calcSlaStatus(
  incident: {
    id: string
    companyId: string
    createdAt: Date
    incidentNumber: string
    responseDueAt: Date | null
    resolutionDueAt: Date | null
    firstRespondedAt: Date | null
    resolvedAt: Date | null
    priority: string
    slaPolicyId: string | null
  },
  now: Date
): SlaCheckResult | null {
  const totalResponse = incident.responseDueAt
    ? (incident.responseDueAt.getTime() - incident.createdAt.getTime())
    : 0
  const totalResolution = incident.resolutionDueAt
    ? (incident.resolutionDueAt.getTime() - incident.createdAt.getTime())
    : 0

  const elapsed = now.getTime() - incident.createdAt.getTime()

  const responsePct = totalResponse > 0 ? Math.round((elapsed / totalResponse) * 100) : 0
  const resolutionPct = totalResolution > 0 ? Math.round((elapsed / totalResolution) * 100) : 0

  const responseBreached = incident.responseDueAt ? now >= incident.responseDueAt : false
  const resolutionBreached = incident.resolutionDueAt ? now >= incident.resolutionDueAt : false

  if (totalResponse === 0 && totalResolution === 0) return null

  return {
    companyId: incident.companyId as string,
    incidentId: incident.id,
    incidentNumber: incident.incidentNumber,
    priority: incident.priority,
    slaPolicyId: incident.slaPolicyId,
    responseDueAt: incident.responseDueAt,
    resolutionDueAt: incident.resolutionDueAt,
    responsePct,
    resolutionPct,
    responseBreached,
    resolutionBreached,
  }
}

type SlaThreshold = {
  type: 'response' | 'resolution'
  level: 'WARNING' | 'CRITICAL' | 'BREACHED'
  pct: number
  shouldAlert: boolean
}

async function getSlaThresholds(result: SlaCheckResult): Promise<SlaThreshold[]> {
  const thresholds: SlaThreshold[] = []

  if (result.responseDueAt) {
    const breachPct = result.responsePct
    if (result.responseBreached) {
      thresholds.push({ type: 'response', level: 'BREACHED', pct: breachPct, shouldAlert: true })
    } else if (breachPct >= 90) {
      thresholds.push({ type: 'response', level: 'CRITICAL', pct: breachPct, shouldAlert: !result.responseBreached })
    } else if (breachPct >= 75) {
      thresholds.push({ type: 'response', level: 'WARNING', pct: breachPct, shouldAlert: true })
    }
  }

  if (result.resolutionDueAt) {
    const breachPct = result.resolutionPct
    if (result.resolutionBreached) {
      thresholds.push({ type: 'resolution', level: 'BREACHED', pct: breachPct, shouldAlert: true })
    } else if (breachPct >= 90) {
      thresholds.push({ type: 'resolution', level: 'CRITICAL', pct: breachPct, shouldAlert: true })
    } else if (breachPct >= 75) {
      thresholds.push({ type: 'resolution', level: 'WARNING', pct: breachPct, shouldAlert: true })
    }
  }

  return thresholds
}

async function fireSlaAlert(
  companyId: string,
  incidentId: string,
  incidentNumber: string,
  result: SlaCheckResult,
  threshold: SlaThreshold
) {
  const title = `SLA ${threshold.level}: ${incidentNumber}`
  const message = `${threshold.type === 'response' ? 'Response' : 'Resolution'} SLA at ${threshold.pct}% — ${threshold.level === 'BREACHED' ? 'BREACHED' : 'approaching breach'}`

  await publishDomainEvent({
    type: 'enterprise.incident.updated',
    companyId,
    actorId: undefined,
    entityType: 'enterprise_incident',
    entityId: incidentId,
    action: `sla_${threshold.level.toLowerCase()}`,
    payload: {
      slaType: threshold.type,
      slaLevel: threshold.level,
      slaPct: threshold.pct,
      responseDueAt: result.responseDueAt,
      resolutionDueAt: result.resolutionDueAt,
      message,
    },
  })

  const assignedIncident = await prisma.enterpriseIncident.findFirst({
    where: { id: incidentId },
    select: { assignedToId: true, assignedTeamId: true, departmentId: true },
  })

  if (assignedIncident?.assignedToId) {
    await enqueueOperationalJob({
      name: 'notifications.send',
      companyId,
      entityType: 'enterprise_incident',
      entityId: incidentId,
      payload: {
        type: 'sla_alert',
        level: threshold.level,
        title,
        message,
        recipientId: assignedIncident.assignedToId,
        entityType: 'enterprise_incident',
        entityId: incidentId,
      },
    })
  }

  const escalationTeam = assignedIncident?.assignedTeamId
  if (threshold.level === 'BREACHED' && escalationTeam) {
    const teamMembers = await prisma.enterpriseTeamMember.findMany({
      where: { teamId: escalationTeam, isOnCall: true },
      select: { userId: true },
    })
    for (const member of teamMembers) {
      await enqueueOperationalJob({
        name: 'notifications.send',
        companyId,
        entityType: 'enterprise_incident',
        entityId: incidentId,
        payload: {
          type: 'sla_breach_escalation',
          level: 'BREACHED',
          title: `SLA BREACH: ${incidentNumber}`,
          message,
          recipientId: member.userId,
        },
      })
    }
  }

  logger.warn('enterprise.sla_alert', {
    companyId,
    incidentId,
    incidentNumber,
    slaType: threshold.type,
    slaLevel: threshold.level,
    slaPct: threshold.pct,
  })
}

async function recordBreach(
  incident: {
    id: string
    auditTrail: unknown
  },
  result: SlaCheckResult,
  now: Date
) {
  const auditTrail = Array.isArray(incident.auditTrail) ? incident.auditTrail : []
  await prisma.enterpriseIncident.update({
    where: { id: incident.id },
    data: {
      escalationState: 'SLA_BREACHED',
      auditTrail: [
        ...auditTrail,
        {
          at: now.toISOString(),
          action: 'sla_breached',
          responseBreached: result.responseBreached,
          resolutionBreached: result.resolutionBreached,
          responsePct: result.responsePct,
          resolutionPct: result.resolutionPct,
        },
      ],
    },
  })
}
