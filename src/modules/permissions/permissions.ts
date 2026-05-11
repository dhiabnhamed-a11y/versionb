import { normalizeUserRole, type UserRole } from '@/lib/security'
import { forbidden } from '@/modules/shared/errors'
import type { SessionUser } from '@/modules/shared/session'

export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'manage'
  | 'approve'
  | 'review'
  | 'comment'
  | 'upload'
  | 'execute'

export type PermissionSubject =
  | 'workspace'
  | 'task'
  | 'project'
  | 'client'
  | 'deliverable'
  | 'invoice'
  | 'approval'
  | 'file'
  | 'notification'
  | 'analytics'
  | 'settings'
  | 'automation'
  | 'ai'
  | 'audit'
  | 'portal'

export type PermissionResource = {
  companyId?: string | null
  assigneeId?: string | null
  managerId?: string | null
  actorId?: string | null
  projectId?: string | null
  assignedUserIds?: string[]
}

const ROLE_RANK: Record<UserRole, number> = {
  EMPLOYEE: 10,
  MANAGER: 50,
  OWNER: 80,
  SUPER_ADMIN: 100,
}

function roleOf(user: Pick<SessionUser, 'role'>) {
  return normalizeUserRole(user.role)
}

function sameWorkspace(user: SessionUser, resource?: PermissionResource) {
  return !resource?.companyId || (Boolean(user.companyId) && user.companyId === resource.companyId)
}

function isAssigned(user: SessionUser, resource?: PermissionResource) {
  return Boolean(
    user.id &&
      (resource?.assigneeId === user.id ||
        resource?.managerId === user.id ||
        resource?.actorId === user.id ||
        resource?.assignedUserIds?.includes(user.id))
  )
}

function atLeast(role: UserRole, required: UserRole) {
  return ROLE_RANK[role] >= ROLE_RANK[required]
}

export function can(user: SessionUser, action: PermissionAction, subject: PermissionSubject, resource?: PermissionResource) {
  const role = roleOf(user)

  if (role === 'SUPER_ADMIN') {
    return subject === 'audit' || subject === 'settings' || subject === 'workspace' || subject === 'analytics'
  }

  if (!sameWorkspace(user, resource)) return false

  if (atLeast(role, 'OWNER')) return true

  if (role === 'MANAGER') {
    if (subject === 'audit') return action === 'read'
    return subject !== 'settings' || action === 'read' || action === 'update'
  }

  if (role === 'EMPLOYEE') {
    if (subject === 'task') {
      return action === 'read' || action === 'comment' || action === 'upload' || (action === 'update' && isAssigned(user, resource))
    }

    if (subject === 'project' || subject === 'deliverable' || subject === 'file') {
      return action === 'read' && isAssigned(user, resource)
    }

    if (subject === 'notification' || subject === 'ai') {
      return action === 'read' || action === 'update'
    }
  }

  return false
}

export function assertCan(user: SessionUser, action: PermissionAction, subject: PermissionSubject, resource?: PermissionResource) {
  if (!can(user, action, subject, resource)) {
    throw forbidden()
  }
}

export function canManageWorkspace(user: SessionUser) {
  const role = roleOf(user)
  return role === 'OWNER' || role === 'MANAGER'
}

export function canManageFinance(user: SessionUser) {
  const role = roleOf(user)
  return role === 'OWNER' || role === 'MANAGER'
}
