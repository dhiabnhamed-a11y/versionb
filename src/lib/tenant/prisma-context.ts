import { AsyncLocalStorage } from 'async_hooks'
import type { SessionUser } from '@/modules/shared/session'
import { normalizeUserRole } from '@/lib/security'
import { prisma } from '@/lib/db'

export type PrismaTenantContext = {
  companyId: string
  role: string
  bypass: boolean
}

const storage = new AsyncLocalStorage<PrismaTenantContext>()

export function getPrismaTenantContext() {
  return storage.getStore()
}

export async function runWithPrismaTenantContext<T>(
  user: Pick<SessionUser, 'companyId' | 'role'>,
  fn: () => T | Promise<T>
): Promise<T> {
  const isSuperAdmin = normalizeUserRole(user.role) === 'SUPER_ADMIN'
  const bypass = isSuperAdmin || !user.companyId

  if (bypass) {
    return prisma.$transaction(async () => {
      await prisma.$executeRaw`SELECT set_config('app.current_company_id', 'SUPER_ADMIN', true)`
      return fn()
    }) as Promise<T>
  }

  const companyId = user.companyId!

  return storage.run(
    { companyId, role: user.role ?? 'EMPLOYEE', bypass: false },
    () =>
      prisma.$transaction(async () => {
        await prisma.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`
        return fn()
      }) as Promise<T>
  )
}

export async function runWithSystemBypass<T>(reason: string, fn: () => T | Promise<T>): Promise<T> {
  if (!reason) throw new Error('SECURITY: A reason must be provided to bypass tenant isolation.')
  const { logger } = await import('@/modules/shared/logger')
  logger.warn('tenant.system_bypass_invoked', { reason })
  
  return storage.run(
    { companyId: 'SYSTEM', role: 'SYSTEM', bypass: true },
    () =>
      prisma.$transaction(async () => {
        await prisma.$executeRaw`SELECT set_config('app.current_company_id', 'SUPER_ADMIN', true)`
        return fn()
      }) as Promise<T>
  )
}
