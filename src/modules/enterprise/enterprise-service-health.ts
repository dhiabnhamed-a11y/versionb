import { enterpriseRepositoryPrisma } from '@/modules/enterprise/enterprise.repository'
import { badRequest, notFound } from '@/modules/shared/errors'
import { publishDomainEvent } from '@/modules/events/event-bus'
import type { SessionUser } from '@/modules/shared/session'

function company(user: SessionUser) {
  if (!user.companyId) throw badRequest('No company found.')
  return user.companyId
}

export async function listServices(user: SessionUser) {
  return enterpriseRepositoryPrisma.enterpriseServiceHealth.findMany({
    where: { companyId: company(user) },
    orderBy: { name: 'asc' },
  })
}

export async function updateServiceStatus(
  user: SessionUser,
  id: string,
  input: { status: string; description?: string | null; isPublic?: boolean }
) {
  const cid = company(user)
  const existing = await enterpriseRepositoryPrisma.enterpriseServiceHealth.findFirst({ where: { id, companyId: cid } })
  if (!existing) throw notFound('Service not found.')

  const updated = await enterpriseRepositoryPrisma.enterpriseServiceHealth.update({
    where: { id },
    data: {
      status: input.status.toUpperCase(),
      description: input.description === undefined ? undefined : input.description,
      isPublic: input.isPublic === undefined ? undefined : input.isPublic,
    },
  })

  await publishDomainEvent({
    type: 'enterprise.service_health.updated', companyId: cid, actorId: user.id,
    entityType: 'enterprise_service_health', entityId: id,
    action: `Service health changed to ${input.status}`,
    payload: { service: updated },
    before: existing, after: updated,
  })

  return updated
}
