import { normalizeUserRole, type UserRole } from '@/lib/security'
import {
  assertCan,
  can,
  type PermissionAction,
  type PermissionResource,
  type PermissionSubject,
} from '@/modules/permissions/permissions'
import { forbidden, notFound } from '@/modules/shared/errors'
import type { SessionUser } from '@/modules/shared/session'

type TenantResource = {
  companyId?: string | null
}

type OwnershipResource = TenantResource & {
  id?: string | null
  ownerId?: string | null
  actorId?: string | null
  createdById?: string | null
  userId?: string | null
  assigneeId?: string | null
  managerId?: string | null
  assignedUserIds?: string[] | null
}

type OwnershipOptions = {
  hideExistence?: boolean
  allowTenantAdmins?: boolean
}

const ROLE_RANK: Record<UserRole, number> = {
  EMPLOYEE: 10,
  MANAGER: 50,
  OWNER: 80,
  SUPER_ADMIN: 100,
}

function isSameTenant(user: Pick<SessionUser, 'companyId'>, resource: TenantResource) {
  return Boolean(user.companyId && resource.companyId && user.companyId === resource.companyId)
}

function isTenantBypass(user: Pick<SessionUser, 'role'>) {
  return normalizeUserRole(user.role) === 'SUPER_ADMIN'
}

function roleAtLeast(user: Pick<SessionUser, 'role'>, role: UserRole) {
  return ROLE_RANK[normalizeUserRole(user.role)] >= ROLE_RANK[role]
}

function ownsResource(user: Pick<SessionUser, 'id'>, resource: OwnershipResource) {
  if (!user.id) return false
  return (
    resource.ownerId === user.id ||
    resource.actorId === user.id ||
    resource.createdById === user.id ||
    resource.userId === user.id ||
    resource.assigneeId === user.id ||
    resource.managerId === user.id ||
    Boolean(resource.assignedUserIds?.includes(user.id))
  )
}

export function requireTenantAccess<TResource extends TenantResource>(
  user: Pick<SessionUser, 'companyId' | 'role'>,
  resource: TResource | null | undefined,
  options: { hideExistence?: boolean } = {}
) {
  if (!resource) throw notFound()
  if (isTenantBypass(user)) return resource
  if (isSameTenant(user, resource)) return resource

  if (options.hideExistence ?? true) throw notFound()
  throw forbidden()
}

export function requireRole(user: Pick<SessionUser, 'role'>, role: UserRole | UserRole[]) {
  const roles = Array.isArray(role) ? role : [role]
  if (!roles.some((candidate) => normalizeUserRole(user.role) === candidate)) {
    throw forbidden()
  }

  return user
}

export function requireMinimumRole(user: Pick<SessionUser, 'role'>, role: UserRole) {
  if (!roleAtLeast(user, role)) throw forbidden()
  return user
}

export function requirePermission(
  user: SessionUser,
  action: PermissionAction,
  subject: PermissionSubject,
  resource?: PermissionResource
) {
  assertCan(user, action, subject, resource)
  return user
}

export function hasPermission(
  user: SessionUser,
  action: PermissionAction,
  subject: PermissionSubject,
  resource?: PermissionResource
) {
  return can(user, action, subject, resource)
}

export function requireResourceOwnership<TResource extends OwnershipResource>(
  user: SessionUser,
  resource: TResource | null | undefined,
  options: OwnershipOptions = {}
) {
  const resolved = requireTenantAccess(user, resource, { hideExistence: options.hideExistence })

  if (ownsResource(user, resolved)) return resolved
  if ((options.allowTenantAdmins ?? true) && roleAtLeast(user, 'MANAGER')) return resolved

  if (options.hideExistence ?? true) throw notFound()
  throw forbidden()
}

export function tenantScopedWhere(user: Pick<SessionUser, 'companyId' | 'role'>) {
  if (isTenantBypass(user)) return {}
  if (!user.companyId) throw forbidden('A workspace is required for this action.')
  return { companyId: user.companyId }
}
