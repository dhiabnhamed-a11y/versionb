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
  // Contract family
  'Contract',
  'ContractVersion',
  'ContractTemplate',
  'ContractClause',
  'ContractSignature',
  'ContractAuditLog',
  'ContractGenerationJob',
  // Finance
  'Invoice',
  'JournalEntry',
  'JournalLine',
  'Ledger',
  'FinancialPeriod',
  'Account',
  'AccountCategory',
  'CostCenter',
  'ChartOfAccount',
  'Reconciliation',
  'FinancialAuditLog',
  // Operations (Task has no direct companyId — scoped via Project, excluded intentionally)
  'AccessRequest',
  'ClientActivity',
  'ClientPortalComment',
  'AdminActionLog',
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

export function tenantTransaction(user: Pick<SessionUser, 'companyId' | 'role'>) {
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
  if (!TENANT_SCOPED_MODELS.has(model)) return args
  const ctx = getPrismaTenantContext()
  if (!ctx) {
    throw new Error(`SECURITY: Missing tenant context for scoped model ${model}. Wrap entry point in runWithPrismaTenantContext.`)
  }
  if (ctx.bypass) return args
  
  const where = (args.where ?? {}) as Record<string, unknown>
  if (where.companyId !== undefined) {
    // If query provides explicit companyId, it must match context (or super admin context)
    if (ctx.companyId !== 'SYSTEM' && where.companyId !== ctx.companyId) {
       throw new Error(`SECURITY: Query companyId ${where.companyId} does not match context companyId ${ctx.companyId}.`)
    }
    return args
  }
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
        async $allOperations({ model, args, query, operation }) {
          if (model && TENANT_SCOPED_MODELS.has(model)) {
            const ctx = getPrismaTenantContext()
            if (!ctx) {
              throw new Error(`SECURITY: Missing tenant context for operation ${operation} on scoped model ${model}. Wrap entry point in runWithPrismaTenantContext.`)
            }
          }
          return query(args)
        },
      },
    },
  })
}
