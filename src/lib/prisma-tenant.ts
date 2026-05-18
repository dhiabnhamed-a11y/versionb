import { Prisma } from '@prisma/client'
import type { SessionUser } from '@/modules/shared/session'
import { normalizeUserRole } from '@/lib/security'
import { forbidden } from '@/modules/shared/errors'
import { getPrismaTenantContext } from '@/lib/tenant/prisma-context'

const TENANT_SCOPED_MODELS = new Set([
  'User',
  'Project',
  'Client',
  'Room',
  'Invite',
  'Alert',
  'Company',
])

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

function mergeTenantWhere(model: string, args: Record<string, unknown>) {
  const ctx = getPrismaTenantContext()
  if (!ctx || ctx.bypass || !TENANT_SCOPED_MODELS.has(model)) return args
  const where = (args.where ?? {}) as Record<string, unknown>
  if (where.companyId !== undefined) return args
  return { ...args, where: { ...where, companyId: ctx.companyId } }
}

export function createTenantAuditExtension() {
  return Prisma.defineExtension({
    name: 'tenant-audit',
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          return query(mergeTenantWhere(model, args as Record<string, unknown>))
        },
        async findFirst({ model, args, query }) {
          return query(mergeTenantWhere(model, args as Record<string, unknown>))
        },
        async count({ model, args, query }) {
          return query(mergeTenantWhere(model, args as Record<string, unknown>))
        },
        async $allOperations({ args, query }) {
          return query(args)
        },
      },
    },
  })
}
