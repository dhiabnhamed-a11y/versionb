import { enterpriseRepositoryPrisma } from '@/modules/enterprise/enterprise.repository'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { notFound } from '@/modules/shared/errors'
import { logger } from '@/modules/shared/logger'
import type { SessionUser } from '@/modules/shared/session'

function requireCompany(user: SessionUser) {
  if (!user.companyId) throw Object.assign(new Error('No company found.'), { status: 400 })
  return user.companyId
}

export async function triggerCsatSurvey(incidentId: string) {
  const incident = await enterpriseRepositoryPrisma.enterpriseIncident.findFirst({
    where: { id: incidentId },
  })
  if (!incident) throw notFound('Incident not found.')

  const metadata = (incident.metadata as Record<string, unknown>) || {}
  metadata.csatSurveySentAt = new Date().toISOString()
  metadata.csatStatus = 'PENDING'

  await enterpriseRepositoryPrisma.enterpriseIncident.update({
    where: { id: incidentId },
    data: { metadata: metadata as any },
  })

  await publishDomainEvent({
    type: 'enterprise.csat.survey_sent',
    companyId: incident.companyId,
    actorId: null,
    entityType: 'enterprise_incident',
    entityId: incidentId,
    action: 'CSAT survey sent',
    payload: { incidentId, incidentNumber: incident.incidentNumber },
  })

  logger.info('enterprise.csat_survey_triggered', { incidentId })
  return { sent: true, incidentId }
}

export async function submitCsatResponse(
  user: SessionUser,
  incidentId: string,
  input: { score: number; feedback?: string | null }
) {
  const companyId = requireCompany(user)
  const incident = await enterpriseRepositoryPrisma.enterpriseIncident.findFirst({
    where: { id: incidentId, companyId },
  })
  if (!incident) throw notFound('Incident not found.')

  if (input.score < 1 || input.score > 5) {
    throw Object.assign(new Error('CSAT score must be between 1 and 5.'), { status: 400 })
  }

  const metadata = (incident.metadata as Record<string, unknown>) || {}
  metadata.csatScore = input.score
  metadata.csatFeedback = input.feedback || null
  metadata.csatRespondedAt = new Date().toISOString()
  metadata.csatStatus = 'COMPLETED'

  await enterpriseRepositoryPrisma.enterpriseIncident.update({
    where: { id: incidentId },
    data: { metadata: metadata as any },
  })

  await publishDomainEvent({
    type: 'enterprise.csat.response_received',
    companyId,
    actorId: user.id,
    entityType: 'enterprise_incident',
    entityId: incidentId,
    action: 'CSAT response received',
    payload: { incidentId, score: input.score, feedback: input.feedback },
  })

  return { submitted: true, score: input.score }
}

export async function getCsatSummary(user: SessionUser, departmentId?: string) {
  const companyId = requireCompany(user)
  const where: any = { companyId, metadata: { path: ['csatScore'], not: null } }
  if (departmentId) where.departmentId = departmentId

  const incidents = await enterpriseRepositoryPrisma.enterpriseIncident.findMany({
    where,
    select: {
      id: true,
      incidentNumber: true,
      title: true,
      departmentId: true,
      metadata: true,
      resolvedAt: true,
    },
    orderBy: { resolvedAt: 'desc' },
    take: 500,
  })

  const scores = incidents
    .map((i) => {
      const m = i.metadata as Record<string, unknown> | null
      return m?.csatScore ? Number(m.csatScore) : null
    })
    .filter((s): s is number => s !== null)

  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  scores.forEach((s) => { if (distribution[s as keyof typeof distribution] !== undefined) distribution[s as keyof typeof distribution]++ })

  return {
    total: scores.length,
    averageScore: Math.round(avgScore * 10) / 10,
    distribution,
    responses: incidents,
  }
}
