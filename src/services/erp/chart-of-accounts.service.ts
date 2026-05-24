import 'server-only'

import type { SessionUser } from '@/modules/shared/session'
import { assertFinanceManage, assertFinanceRead, requireFinanceCompany } from '@/modules/finance/policy'
import { normalizeCurrency } from '@/modules/accounting/money'
import { createAccount } from '@/modules/accounting/accounting.service'
import { listErpAccounts, seedStandardAgencyChart as seedStandardAgencyChartRepository } from '@/repositories/erp/accounts.repository'
import {
  STANDARD_AGENCY_ACCOUNTS,
  STANDARD_AGENCY_CATEGORIES,
  STANDARD_AGENCY_DEFAULT_ACCOUNT_CODES,
} from '@/services/erp/standard-agency-coa'
import { erpSeedStandardChartSchema } from '@/services/erp/erp.validation'

function serializeBigInt(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(serializeBigInt)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, serializeBigInt(nested)]))
  }
  return value
}

export async function listErpChartAccounts(user: SessionUser) {
  const companyId = requireFinanceCompany(user)
  assertFinanceRead(user)
  return serializeBigInt(await listErpAccounts(companyId))
}

export async function createErpAccount(user: SessionUser, rawInput: unknown) {
  return createAccount(user, rawInput)
}

export async function seedStandardAgencyChart(user: SessionUser, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)
  const input = erpSeedStandardChartSchema.parse(rawInput ?? {})
  const baseCurrency = normalizeCurrency(input.baseCurrency)

  const result = await seedStandardAgencyChartRepository({
    companyId,
    baseCurrency,
    categories: STANDARD_AGENCY_CATEGORIES,
    accounts: STANDARD_AGENCY_ACCOUNTS,
    defaultCodes: STANDARD_AGENCY_DEFAULT_ACCOUNT_CODES,
  })

  return serializeBigInt({
    initialized: true,
    chart: result.chart,
    accounts: result.accounts,
    accountCount: result.accounts.length,
  })
}
