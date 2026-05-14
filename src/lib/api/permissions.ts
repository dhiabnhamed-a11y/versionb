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

export { assertAllowed, assertAllowedAsync } from '@/lib/api/policy'
export { assertCan, can, canManageFinance, canManageWorkspace }
export type { PermissionAction, PermissionResource, PermissionSubject }

export function requirePermission(
  user: SessionUser,
  action: PermissionAction,
  subject: PermissionSubject,
  resource?: PermissionResource
) {
  assertCan(user, action, subject, resource)
  return user
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
