import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { badRequest } from '@/modules/shared/errors'
import { toJsonValue } from '@/modules/shared/json'
import type { SessionUser } from '@/modules/shared/session'
import { assertFinanceManage, requireFinanceCompany } from '@/modules/finance/policy'
import { normalizeCurrency, sumDecimals, toDecimal } from '@/modules/accounting/money'
import { createBudgetSchema } from '@/modules/budgeting/budgeting.validation'

function parseOptionalDate(value: string | null | undefined, field: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest(`Invalid ${field}.`)
  return date
}

export async function createBudget(user: SessionUser, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)
  const input = createBudgetSchema.parse(rawInput)
  const startsAt = parseOptionalDate(input.startsAt, 'startsAt')
  const endsAt = parseOptionalDate(input.endsAt, 'endsAt')
  if (startsAt && endsAt && startsAt > endsAt) throw badRequest('Budget start must be before end.')

  const lines = input.lines.map((line) => {
    const amount = toDecimal(line.amount, 'amount')
    if (amount.isNegative()) throw badRequest('Budget line amounts cannot be negative.')
    return { ...line, amount }
  })
  const totalAmount = sumDecimals(lines.map((line) => line.amount))
  const accountIds = [...new Set(lines.map((line) => line.accountId).filter(Boolean) as string[])]
  const projectIds = [...new Set([input.projectId, ...lines.map((line) => line.projectId)].filter(Boolean) as string[])]
  const [period, accountCount, projectCount] = await Promise.all([
    input.periodId ? prisma.financialPeriod.findFirst({ where: { id: input.periodId, companyId }, select: { id: true } }) : Promise.resolve(null),
    accountIds.length ? prisma.account.count({ where: { companyId, id: { in: accountIds }, deletedAt: null } }) : Promise.resolve(0),
    projectIds.length ? prisma.project.count({ where: { companyId, id: { in: projectIds } } }) : Promise.resolve(0),
  ])
  if (input.periodId && !period) throw badRequest('Selected budget period was not found in this workspace.')
  if (accountCount !== accountIds.length) throw badRequest('Every budget account link must stay inside this workspace.')
  if (projectCount !== projectIds.length) throw badRequest('Every budget project link must stay inside this workspace.')

  const budget = await prisma.budget.create({
    data: {
      companyId,
      periodId: input.periodId ?? null,
      projectId: input.projectId ?? null,
      name: input.name,
      currency: normalizeCurrency(input.currency),
      startsAt,
      endsAt,
      totalAmount,
      metadata: toJsonValue(input.metadata),
      lines: {
        create: lines.map((line) => ({
          companyId,
          accountId: line.accountId ?? null,
          projectId: line.projectId ?? input.projectId ?? null,
          department: line.department?.trim() || null,
          description: line.description?.trim() || null,
          amount: line.amount,
          metadata: toJsonValue(line.metadata),
        })),
      },
    },
    include: { lines: true },
  })

  return {
    ...budget,
    totalAmount: (budget.totalAmount as Prisma.Decimal).toString(),
    lines: budget.lines.map((line) => ({ ...line, amount: line.amount.toString() })),
  }
}
