import { Prisma } from '@prisma/client'
import type { SessionUser } from '@/modules/shared/session'
import { normalizeUserRole } from '@/lib/security'
import { forbidden } from '@/modules/shared/errors'

export function tenantWhere(user: Pick<SessionUser, 'companyId' | 'role'>) {
  if (normalizeUserRole(user.role) === 'SUPER_ADMIN') return {}
  if (!user.companyId) throw forbidden('A workspace is required for this action.')
  return { companyId: user.companyId }
}

export function assertTenantResource<T extends { companyId?: string | null }>(
  user: Pick<SessionUser, 'companyId' | 'role'>,
  resource: T | null | undefined
): T {
  if (!resource) throw forbidden('Resource not found.')
  if (normalizeUserRole(user.role) === 'SUPER_ADMIN') return resource
  if (!user.companyId || resource.companyId !== user.companyId) throw forbidden('Resource not found.')
  return resource
}

export function tenantTransaction<T>(user: Pick<SessionUser, 'companyId' | 'role'>) {
  const scope = tenantWhere(user)
  return {
    scope,
    mergeWhere<TWhere extends Record<string, unknown>>(where: TWhere) {
      return { ...where, ...scope } as TWhere & typeof scope
    },
  }
}

export type TenantScopedClient = {
  tenantWhere: typeof tenantWhere
  assertTenantResource: typeof assertTenantResource
}

export const TenantPrismaGuards = {
  tenantWhere,
  assertTenantResource,
} satisfies TenantScopedClient

export function createTenantAuditExtension() {
  return Prisma.defineExtension({
    name: 'tenant-audit',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(args)
        },
      },
    },
  })
}
