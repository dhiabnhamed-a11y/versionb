import { enterpriseRepositoryPrisma } from '@/modules/enterprise/enterprise.repository'
import { badRequest, notFound } from '@/modules/shared/errors'
import type { SessionUser } from '@/modules/shared/session'

function company(user: SessionUser) {
  if (!user.companyId) throw badRequest('No company found.')
  return user.companyId
}

export async function listSavedFilters(user: SessionUser, entityType: string) {
  const companyId = company(user)
  const prefs = await enterpriseRepositoryPrisma.notificationPreference.findFirst({
    where: { userId: user.id },
    select: { id: true, mutedEntities: true },
  })

  const stored = prefs?.mutedEntities as Record<string, unknown> | null
  const filters = (stored?.savedFilters as Record<string, unknown>[]) || []

  return filters
    .filter((f) => f.entityType === entityType)
    .map((f) => ({
      id: f.id,
      name: f.name,
      entityType: f.entityType,
      filters: f.filters,
    }))
}

export async function saveFilter(
  user: SessionUser,
  input: {
    name: string
    entityType: string
    filters: Record<string, unknown>
  }
) {
  const companyId = company(user)

  let prefs = await enterpriseRepositoryPrisma.notificationPreference.findFirst({
    where: { userId: user.id },
  })

  if (!prefs) {
    prefs = await enterpriseRepositoryPrisma.notificationPreference.create({
      data: { userId: user.id, mutedEntities: { savedFilters: [] } },
    })
  }

  const existing = (prefs.mutedEntities as Record<string, unknown>) || {}
  const savedFilters = (existing.savedFilters as Record<string, unknown>[]) || []

  const newFilter = {
    id: `filter_${Date.now()}`,
    name: input.name,
    entityType: input.entityType,
    filters: input.filters,
    createdAt: new Date().toISOString(),
  }

  savedFilters.push(newFilter)

  await enterpriseRepositoryPrisma.notificationPreference.update({
    where: { id: prefs.id },
    data: { mutedEntities: { ...existing, savedFilters } as any },
  })

  return newFilter
}

export async function deleteSavedFilter(user: SessionUser, filterId: string) {
  const prefs = await enterpriseRepositoryPrisma.notificationPreference.findFirst({
    where: { userId: user.id },
  })
  if (!prefs) throw notFound('No saved filters found.')

  const existing = (prefs.mutedEntities as Record<string, unknown>) || {}
  const savedFilters = (existing.savedFilters as Record<string, unknown>[]) || []
  const filtered = savedFilters.filter((f) => f.id !== filterId)

  if (filtered.length === savedFilters.length) {
    throw notFound('Saved filter not found.')
  }

  await enterpriseRepositoryPrisma.notificationPreference.update({
    where: { id: prefs.id },
    data: { mutedEntities: { ...existing, savedFilters: filtered } as any },
  })

  return { deleted: true }
}
