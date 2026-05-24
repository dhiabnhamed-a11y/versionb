import 'server-only'

import { Prisma } from '@prisma/client'
import type { SessionUser } from '@/modules/shared/session'
import { assertFinanceRead, requireFinanceCompany } from '@/modules/finance/policy'
import { badRequest } from '@/modules/shared/errors'
import { normalizeCurrency, zeroDecimal } from '@/modules/accounting/money'
import { getTrialBalanceRows, listAccountsForTrialBalance } from '@/repositories/erp/ledger.repository'
import { erpTrialBalanceQuerySchema } from '@/services/erp/erp.validation'

function parseDate(value: string | null | undefined, field: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest(`Invalid ${field}.`)
  return date
}

function money(value: Prisma.Decimal | number | string | null | undefined) {
  return new Prisma.Decimal(value ?? 0).toFixed(2)
}

function minor(value: bigint | number | string | null | undefined) {
  return BigInt(value ?? 0).toString()
}

export async function getErpTrialBalance(user: SessionUser, rawQuery: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceRead(user)
  const query = erpTrialBalanceQuerySchema.parse(rawQuery)
  const startsAt = parseDate(query.startsAt, 'startsAt')
  const endsAt = parseDate(query.endsAt, 'endsAt')
  if (startsAt && endsAt && startsAt > endsAt) throw badRequest('Report start must be before report end.')

  const rows = await getTrialBalanceRows(companyId, {
    startsAt,
    endsAt,
    departmentId: query.departmentId,
    projectId: query.projectId,
    costCenterId: query.costCenterId,
    currency: query.currency ? normalizeCurrency(query.currency) : null,
  })
  const accounts = await listAccountsForTrialBalance(companyId, rows.map((row) => row.accountId))
  const accountById = new Map(accounts.map((account) => [account.id, account]))

  const lines = rows
    .map((row) => {
      const account = accountById.get(row.accountId)
      if (!account) return null
      const debit = row._sum.debit ?? zeroDecimal()
      const credit = row._sum.credit ?? zeroDecimal()
      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        normalBalance: account.normalBalance,
        currency: row.currency,
        debit: money(debit),
        credit: money(credit),
        balance: money(account.normalBalance === 'DEBIT' ? new Prisma.Decimal(debit).minus(credit) : new Prisma.Decimal(credit).minus(debit)),
        debitMinor: minor(row._sum.debitMinor),
        creditMinor: minor(row._sum.creditMinor),
        balanceMinor: minor(row._sum.balanceImpactMinor),
      }
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line))
    .sort((left, right) => left.accountCode.localeCompare(right.accountCode))

  const debitMinorTotal = lines.reduce((total, line) => total + BigInt(line.debitMinor), BigInt(0))
  const creditMinorTotal = lines.reduce((total, line) => total + BigInt(line.creditMinor), BigInt(0))

  return {
    generatedAt: new Date().toISOString(),
    startsAt: startsAt?.toISOString() ?? null,
    endsAt: endsAt?.toISOString() ?? null,
    filters: {
      departmentId: query.departmentId ?? null,
      projectId: query.projectId ?? null,
      costCenterId: query.costCenterId ?? null,
      currency: query.currency ? normalizeCurrency(query.currency) : null,
    },
    totals: {
      debitMinor: debitMinorTotal.toString(),
      creditMinor: creditMinorTotal.toString(),
      balanced: debitMinorTotal === creditMinorTotal,
    },
    lines,
  }
}
