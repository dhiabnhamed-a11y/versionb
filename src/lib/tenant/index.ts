import { badRequest, forbidden, notFound } from '@/modules/shared/errors'
import type { SessionUser } from '@/modules/shared/session'

export type TenantScope = {
  companyId: string
}

export function requireTenant(user: Pick<SessionUser, 'companyId'>): TenantScope {
  if (!user.companyId) throw badRequest('No company found for this account')
  return { companyId: user.companyId }
}

export function assertSameTenant(
  user: Pick<SessionUser, 'companyId'>,
  resource: { companyId?: string | null },
  options: { hideExistence?: boolean } = {}
) {
  const tenant = requireTenant(user)
  if (resource.companyId !== tenant.companyId) {
    if (options.hideExistence ?? true) throw notFound()
    throw forbidden()
  }

  return tenant
}

export function tenantWhere(user: Pick<SessionUser, 'companyId'>) {
  return requireTenant(user)
}
