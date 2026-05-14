import 'server-only'

import { prisma } from '@/lib/db'
import { badRequest } from '@/modules/shared/errors'
import { toJsonValue } from '@/modules/shared/json'
import type { SessionUser } from '@/modules/shared/session'
import { assertFinanceManage, requireFinanceCompany } from '@/modules/finance/policy'
import { normalizeCurrency } from '@/modules/accounting/money'
import { createForecastSchema } from '@/modules/forecasting/forecasting.validation'

function parseOptionalDate(value: string | null | undefined, field: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest(`Invalid ${field}.`)
  return date
}

export async function createForecast(user: SessionUser, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)
  const input = createForecastSchema.parse(rawInput)
  const startsAt = parseOptionalDate(input.startsAt, 'startsAt')
  const endsAt = parseOptionalDate(input.endsAt, 'endsAt')
  if (startsAt && endsAt && startsAt > endsAt) throw badRequest('Forecast start must be before end.')
  if (input.periodId) {
    const period = await prisma.financialPeriod.findFirst({ where: { id: input.periodId, companyId }, select: { id: true } })
    if (!period) throw badRequest('Selected forecast period was not found in this workspace.')
  }

  return prisma.forecast.create({
    data: {
      companyId,
      periodId: input.periodId ?? null,
      name: input.name,
      horizon: input.horizon ?? 'MONTHLY',
      currency: normalizeCurrency(input.currency),
      startsAt,
      endsAt,
      assumptions: toJsonValue(input.assumptions),
      metrics: toJsonValue(input.metrics),
    },
  })
}
