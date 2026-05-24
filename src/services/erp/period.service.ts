import 'server-only'

import type { SessionUser } from '@/modules/shared/session'
import { createFinancialPeriod } from '@/modules/accounting/accounting.service'
import { assertFinanceApproval, assertFinanceRead, requireFinanceCompany } from '@/modules/finance/policy'
import { conflict, notFound } from '@/modules/shared/errors'
import { listErpPeriods, lockErpPeriod } from '@/repositories/erp/periods.repository'
import { erpCreatePeriodSchema, erpLockPeriodSchema } from '@/services/erp/erp.validation'

function serialize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(serialize)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, serialize(nested)]))
  return value
}

export async function listErpFinancialPeriods(user: SessionUser) {
  const companyId = requireFinanceCompany(user)
  assertFinanceRead(user)
  return serialize(await listErpPeriods(companyId))
}

export async function createErpFinancialPeriod(user: SessionUser, rawInput: unknown) {
  return createFinancialPeriod(user, erpCreatePeriodSchema.parse(rawInput))
}

export async function lockErpFinancialPeriod(user: SessionUser, periodId: string, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceApproval(user)
  const input = erpLockPeriodSchema.parse(rawInput ?? {})
  const period = await lockErpPeriod({ companyId, periodId, actorId: user.id, reason: input.reason })
  if (!period) throw notFound('Financial period not found.')
  if (period.status === 'CLOSED') throw conflict('Closed periods cannot be changed.')
  return serialize(period)
}
