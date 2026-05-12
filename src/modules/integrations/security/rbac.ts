import { normalizeUserRole } from '@/lib/security'
import { isContentCreationCompanyType } from '@/lib/company-types'
import { forbidden, badRequest } from '@/modules/shared/errors'
import type { SessionUser } from '@/modules/shared/session'

export function requireIntegrationCompany(user: SessionUser) {
  if (!user.companyId) throw badRequest('No company found for this account.')
  return user.companyId
}

export function assertContentCreatorWorkspace(user: SessionUser) {
  if (!isContentCreationCompanyType(user.companyType)) {
    throw forbidden('Social integrations are available for content creation workspaces.')
  }
}

export function assertCanReadIntegrations(user: SessionUser) {
  assertContentCreatorWorkspace(user)
  const role = normalizeUserRole(user.role)
  if (role === 'SUPER_ADMIN') return
  if (!user.companyId) throw forbidden()
}

export function assertCanManageIntegrations(user: SessionUser) {
  assertContentCreatorWorkspace(user)
  const role = normalizeUserRole(user.role)
  if (role !== 'OWNER' && role !== 'MANAGER') throw forbidden('Only owners and managers can manage social integrations.')
  requireIntegrationCompany(user)
}
