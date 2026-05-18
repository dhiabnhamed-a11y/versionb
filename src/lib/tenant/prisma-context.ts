import { AsyncLocalStorage } from 'async_hooks'
import type { SessionUser } from '@/modules/shared/session'
import { normalizeUserRole } from '@/lib/security'

export type PrismaTenantContext = {
  companyId: string
  role: string
  bypass: boolean
}

const storage = new AsyncLocalStorage<PrismaTenantContext>()

export function getPrismaTenantContext() {
  return storage.getStore()
}

export function runWithPrismaTenantContext<T>(user: Pick<SessionUser, 'companyId' | 'role'>, fn: () => T | Promise<T>) {
  const bypass = normalizeUserRole(user.role) === 'SUPER_ADMIN'
  if (bypass || !user.companyId) return fn()
  return storage.run({ companyId: user.companyId, role: user.role ?? 'EMPLOYEE', bypass: false }, fn)
}
