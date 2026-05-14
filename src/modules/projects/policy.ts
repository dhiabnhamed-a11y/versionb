import type { ProjectSessionUser } from '@/modules/projects/types'

export function canManageProjects(user: ProjectSessionUser) {
  return user.role !== 'EMPLOYEE'
}

export function canReadProjectTenant(user: ProjectSessionUser, companyId: string | null | undefined) {
  return Boolean(user.companyId && companyId && user.companyId === companyId)
}
