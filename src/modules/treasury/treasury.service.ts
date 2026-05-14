import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { badRequest } from '@/modules/shared/errors'
import { toJsonValue } from '@/modules/shared/json'
import type { SessionUser } from '@/modules/shared/session'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { assertFinanceManage, requireFinanceCompany } from '@/modules/finance/policy'
import { writeFinancialAuditLog } from '@/modules/finance/audit.repository'
import { normalizeCurrency, toDecimal } from '@/modules/accounting/money'
import { createTreasuryAccountSchema, createTreasuryTransactionSchema } from '@/modules/treasury/treasury.validation'

function parseOptionalDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest('Invalid scheduled payment date.')
  return date
}

export async function createTreasuryAccount(user: SessionUser, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)
  const input = createTreasuryAccountSchema.parse(rawInput)
  const openingBalance = toDecimal(input.openingBalance, 'openingBalance')
  if (openingBalance.isNegative()) throw badRequest('Opening balance cannot be negative.')

  const account = await prisma.$transaction(async (tx) => {
    if (input.ledgerAccountId) {
      const ledgerAccount = await tx.account.findFirst({ where: { id: input.ledgerAccountId, companyId, deletedAt: null }, select: { id: true } })
      if (!ledgerAccount) throw badRequest('Selected ledger account was not found in this workspace.')
    }
    const created = await tx.treasuryAccount.create({
      data: {
        companyId,
        ledgerAccountId: input.ledgerAccountId ?? null,
        name: input.name,
        type: input.type,
        institutionName: input.institutionName?.trim() || null,
        maskedNumber: input.maskedNumber?.trim() || null,
        currency: normalizeCurrency(input.currency),
        openingBalance,
        currentBalance: openingBalance,
        metadata: toJsonValue(input.metadata),
      },
    })
    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: 'finance.treasury_account.created',
      entityType: 'treasury_account',
      entityId: created.id,
      after: created,
    })
    return created
  })

  return { ...account, openingBalance: (account.openingBalance as Prisma.Decimal).toString(), currentBalance: (account.currentBalance as Prisma.Decimal).toString() }
}

export async function createTreasuryTransaction(user: SessionUser, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)
  const input = createTreasuryTransactionSchema.parse(rawInput)
  const amount = toDecimal(input.amount, 'amount')
  if (!amount.gt(0)) throw badRequest('Treasury transaction amount must be greater than zero.')
  if (!input.fromAccountId && !input.toAccountId) throw badRequest('Select a source or destination treasury account.')

  const transaction = await prisma.$transaction(async (tx) => {
    const accountIds = [input.fromAccountId, input.toAccountId].filter(Boolean) as string[]
    if (accountIds.length) {
      const count = await tx.treasuryAccount.count({ where: { companyId, id: { in: accountIds } } })
      if (count !== new Set(accountIds).size) throw badRequest('Treasury account is outside this workspace.')
    }
    if (input.invoiceId) {
      const invoice = await tx.invoice.findFirst({ where: { id: input.invoiceId, companyId }, select: { id: true } })
      if (!invoice) throw badRequest('Selected invoice was not found in this workspace.')
    }
    const created = await tx.treasuryTransaction.create({
      data: {
        companyId,
        fromAccountId: input.fromAccountId ?? null,
        toAccountId: input.toAccountId ?? null,
        createdById: user.id,
        invoiceId: input.invoiceId ?? null,
        direction: input.direction ?? (input.fromAccountId && input.toAccountId ? 'TRANSFER' : input.toAccountId ? 'INFLOW' : 'OUTFLOW'),
        paymentMethod: input.paymentMethod?.trim() || null,
        amount,
        currency: normalizeCurrency(input.currency),
        scheduledFor: parseOptionalDate(input.scheduledFor),
        externalRef: input.externalRef?.trim() || null,
        memo: input.memo?.trim() || null,
        metadata: toJsonValue(input.metadata),
      },
    })
    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: 'finance.treasury_transaction.created',
      entityType: 'treasury_transaction',
      entityId: created.id,
      after: created,
    })
    return created
  })

  await publishDomainEvent({
    type: 'finance.treasury_transaction.created',
    companyId,
    actorId: user.id,
    entityType: 'treasury_transaction',
    entityId: transaction.id,
    action: 'Treasury transaction scheduled',
    payload: { treasuryTransaction: transaction },
    after: transaction,
  })

  return { ...transaction, amount: (transaction.amount as Prisma.Decimal).toString() }
}
