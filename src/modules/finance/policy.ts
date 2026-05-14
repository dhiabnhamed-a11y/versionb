import { normalizeUserRole } from '@/lib/security'
import { canManageFinance } from '@/modules/permissions/permissions'
import { badRequest, forbidden } from '@/modules/shared/errors'
import type { SessionUser } from '@/modules/shared/session'

export function requireFinanceCompany(user: SessionUser) {
  if (!user.companyId) throw badRequest('No company found for this finance workspace.')
  return user.companyId
}

export function assertFinanceRead(user: SessionUser) {
  if (!canManageFinance(user)) throw forbidden('You do not have access to finance records.')
}

export function assertFinanceManage(user: SessionUser) {
  if (!canManageFinance(user)) throw forbidden('You do not have permission to manage finance records.')
}

export function assertFinanceApproval(user: SessionUser) {
  const role = normalizeUserRole(user.role)
  if (role !== 'OWNER' && role !== 'MANAGER') {
    throw forbidden('Financial approval requires an owner or manager role.')
  }
}
