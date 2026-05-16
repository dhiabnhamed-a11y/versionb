import {
  assertCan,
  can,
  canManageFinance,
  canManageWorkspace,
  type PermissionAction,
  type PermissionResource,
  type PermissionSubject,
} from '@/modules/permissions/permissions'
import type { SessionUser } from '@/modules/shared/session'
import {
  requireMinimumRole,
  requirePermission as requireAccessPermission,
  requireResourceOwnership,
  requireRole,
  requireTenantAccess,
  tenantScopedWhere,
} from '@/modules/security/access-control'

export { assertAllowed, assertAllowedAsync } from '@/lib/api/policy'
export { assertCan, can, canManageFinance, canManageWorkspace }
export { requireMinimumRole, requireResourceOwnership, requireRole, requireTenantAccess, tenantScopedWhere }
export type { PermissionAction, PermissionResource, PermissionSubject }

export function requirePermission(
  user: SessionUser,
  action: PermissionAction,
  subject: PermissionSubject,
  resource?: PermissionResource
) {
  return requireAccessPermission(user, action, subject, resource)
}

export function createPermissionCheck(
  action: PermissionAction,
  subject: PermissionSubject,
  resource?: PermissionResource | ((user: SessionUser) => PermissionResource | undefined)
) {
  return (user: SessionUser) => {
    const resolvedResource = typeof resource === 'function' ? resource(user) : resource
    return can(user, action, subject, resolvedResource)
  }
}
