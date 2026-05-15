import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { badRequest } from '@/modules/shared/errors'
import { toJsonValue } from '@/modules/shared/json'
import type { SessionUser } from '@/modules/shared/session'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { assertFinanceManage, requireFinanceCompany } from '@/modules/finance/policy'
import { writeFinancialAuditLog } from '@/modules/finance/audit.repository'
import { createJournalEntryInTransaction } from '@/modules/accounting/accounting.service'
import { normalizeCurrency, toDecimal, zeroDecimal } from '@/modules/accounting/money'
import { createTreasuryAccountSchema, createTreasuryTransactionSchema } from '@/modules/treasury/treasury.validation'
import type { PaginationInput } from '@/modules/shared/pagination'

function parseOptionalDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest('Invalid scheduled payment date.')
  return date
}

async function findAccountByCode(tx: Prisma.TransactionClient, companyId: string, codes: string[]) {
  const account = await tx.account.findFirst({
    where: { companyId, code: { in: codes }, status: 'ACTIVE', deletedAt: null },
    orderBy: { code: 'asc' },
    select: { id: true, code: true },
  })
  return account?.id ?? null
}

function treasuryTransactionReadInclude() {
  return {
    fromAccount: { select: { id: true, name: true, type: true } },
    toAccount: { select: { id: true, name: true, type: true } },
    invoice: { select: { id: true, invoiceNumber: true, clientName: true } },
    createdBy: { select: { id: true, name: true, email: true } },
    approvedBy: { select: { id: true, name: true, email: true } },
  } satisfies Prisma.TreasuryTransactionInclude
}

async function postTreasuryTransactionInTransaction(tx: Prisma.TransactionClient, input: { companyId: string; transactionId: string; actorId: string }) {
  const existing = await tx.treasuryTransaction.findFirst({
    where: { id: input.transactionId, companyId: input.companyId },
    include: {
      fromAccount: { include: { ledgerAccount: { select: { id: true } } } },
      toAccount: { include: { ledgerAccount: { select: { id: true } } } },
      invoice: { select: { id: true, invoiceNumber: true, status: true, clientId: true, campaignId: true, briefId: true, total: true } },
    },
  })
  if (!existing) throw badRequest('Treasury transaction was not found in this workspace.')
  if (existing.status === 'POSTED' || existing.status === 'RECONCILED') {
    return tx.treasuryTransaction.findUniqueOrThrow({ where: { id: existing.id }, include: treasuryTransactionReadInclude() })
  }
  if (existing.status === 'CANCELLED' || existing.status === 'FAILED') throw badRequest('Cancelled or failed treasury transactions cannot be posted.')

  const executedAt = existing.executedAt ?? existing.scheduledFor ?? new Date()
  const direction = existing.direction || (existing.fromAccountId && existing.toAccountId ? 'TRANSFER' : existing.toAccountId ? 'INFLOW' : 'OUTFLOW')
  const lines = []

  if (existing.fromAccountId) {
    await tx.treasuryAccount.update({
      where: { id: existing.fromAccountId },
      data: { currentBalance: { decrement: existing.amount } },
    })
  }
  if (existing.toAccountId) {
    await tx.treasuryAccount.update({
      where: { id: existing.toAccountId },
      data: { currentBalance: { increment: existing.amount } },
    })
  }

  const fromLedgerAccountId = existing.fromAccount?.ledgerAccount?.id ?? null
  const toLedgerAccountId = existing.toAccount?.ledgerAccount?.id ?? null
  const receivableAccountId = await findAccountByCode(tx, input.companyId, ['1100'])
  const revenueAccountId = await findAccountByCode(tx, input.companyId, ['4000', '4100'])
  const payableAccountId = await findAccountByCode(tx, input.companyId, ['2000'])

  if (direction === 'TRANSFER' && fromLedgerAccountId && toLedgerAccountId) {
    lines.push(
      { accountId: toLedgerAccountId, debit: existing.amount, credit: zeroDecimal(), targetType: 'treasury_transfer', targetId: existing.id },
      { accountId: fromLedgerAccountId, debit: zeroDecimal(), credit: existing.amount, targetType: 'treasury_transfer', targetId: existing.id }
    )
  } else if (direction === 'INFLOW' && toLedgerAccountId) {
    lines.push({
      accountId: toLedgerAccountId,
      debit: existing.amount,
      credit: zeroDecimal(),
      clientId: existing.invoice?.clientId ?? null,
      invoiceId: existing.invoiceId ?? null,
      projectId: existing.invoice?.campaignId ?? null,
      taskId: existing.invoice?.briefId ?? null,
      targetType: 'treasury_inflow',
      targetId: existing.id,
    })
    const creditAccountId = existing.invoiceId && receivableAccountId ? receivableAccountId : revenueAccountId
    if (creditAccountId) {
      lines.push({
        accountId: creditAccountId,
        debit: zeroDecimal(),
        credit: existing.amount,
        clientId: existing.invoice?.clientId ?? null,
        invoiceId: existing.invoiceId ?? null,
        projectId: existing.invoice?.campaignId ?? null,
        taskId: existing.invoice?.briefId ?? null,
        targetType: existing.invoiceId ? 'invoice_payment' : 'treasury_inflow',
        targetId: existing.invoiceId ?? existing.id,
      })
    }
  } else if (direction === 'OUTFLOW' && fromLedgerAccountId) {
    const debitAccountId = payableAccountId ?? fromLedgerAccountId
    lines.push(
      { accountId: debitAccountId, debit: existing.amount, credit: zeroDecimal(), targetType: 'treasury_outflow', targetId: existing.id },
      { accountId: fromLedgerAccountId, debit: zeroDecimal(), credit: existing.amount, targetType: 'treasury_outflow', targetId: existing.id }
    )
  }

  const journalEntry = lines.length >= 2
    ? await createJournalEntryInTransaction(tx, {
        companyId: input.companyId,
        actorId: input.actorId,
        sourceType: direction === 'TRANSFER' ? 'TRANSFER' : existing.invoiceId ? 'PAYMENT' : 'TREASURY',
        sourceId: existing.id,
        invoiceId: existing.invoiceId ?? null,
        memo: existing.memo ?? `${direction.toLowerCase()} treasury movement`,
        currency: existing.currency,
        transactionDate: executedAt,
        idempotencyKey: `treasury:${existing.id}:posted:v1`,
        requiresApproval: false,
        postNow: true,
        metadata: { treasuryTransactionId: existing.id, direction, externalRef: existing.externalRef },
        lines,
      })
    : null

  const invoice = existing.invoice
  if (existing.invoiceId && invoice && invoice.status !== 'paid') {
    await tx.invoice.update({
      where: { id: existing.invoiceId },
      data: { status: existing.amount.gte(invoice.total) ? 'paid' : 'partially_paid', paidAt: existing.amount.gte(invoice.total) ? executedAt : null },
    })
  }

  return tx.treasuryTransaction.update({
    where: { id: existing.id },
    data: {
      status: 'POSTED',
      approvedById: existing.approvedById ?? input.actorId,
      executedAt,
      journalEntryId: journalEntry?.id ?? existing.journalEntryId,
      metadata: toJsonValue({ ...(existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata) ? existing.metadata : {}), postedBy: input.actorId, postingModel: 'taskit_treasury_v2' }),
    },
    include: treasuryTransactionReadInclude(),
  })
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
    const result = input.executeNow
      ? await postTreasuryTransactionInTransaction(tx, { companyId, transactionId: created.id, actorId: user.id })
      : created

    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: 'finance.treasury_transaction.created',
      entityType: 'treasury_transaction',
      entityId: created.id,
      after: result,
    })
    return result
  })

  await publishDomainEvent({
    type: 'finance.treasury_transaction.created',
    companyId,
    actorId: user.id,
    entityType: 'treasury_transaction',
    entityId: transaction.id,
    action: input.executeNow ? 'Treasury transaction posted' : 'Treasury transaction scheduled',
    payload: { treasuryTransaction: transaction },
    after: transaction,
  })

  return { ...transaction, amount: (transaction.amount as Prisma.Decimal).toString() }
}

export async function postTreasuryTransaction(user: SessionUser, transactionId: string) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)

  const transaction = await prisma.$transaction(async (tx) => {
    const posted = await postTreasuryTransactionInTransaction(tx, { companyId, transactionId, actorId: user.id })
    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: 'finance.treasury_transaction.posted',
      entityType: 'treasury_transaction',
      entityId: transactionId,
      after: posted,
    })
    return posted
  })

  await publishDomainEvent({
    type: 'finance.treasury_transaction.posted',
    companyId,
    actorId: user.id,
    entityType: 'treasury_transaction',
    entityId: transaction.id,
    action: 'Treasury transaction posted',
    payload: { treasuryTransaction: transaction },
    after: transaction,
  })

  return serializeTreasuryTransaction(transaction)
}

function serializeTreasuryAccount(account: Prisma.TreasuryAccountGetPayload<{ include: { ledgerAccount: { select: { id: true; code: true; name: true } } } }>) {
  return {
    ...account,
    openingBalance: account.openingBalance.toString(),
    currentBalance: account.currentBalance.toString(),
  }
}

function serializeTreasuryTransaction(
  transaction: Prisma.TreasuryTransactionGetPayload<{
    include: {
      fromAccount: { select: { id: true; name: true; type: true } }
      toAccount: { select: { id: true; name: true; type: true } }
      invoice: { select: { id: true; invoiceNumber: true; clientName: true } }
      createdBy: { select: { id: true; name: true; email: true } }
      approvedBy: { select: { id: true; name: true; email: true } }
    }
  }>
) {
  return {
    ...transaction,
    amount: transaction.amount.toString(),
  }
}

export async function listTreasuryAccounts(user: SessionUser) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)

  const accounts = await prisma.treasuryAccount.findMany({
    where: { companyId },
    include: { ledgerAccount: { select: { id: true, code: true, name: true } } },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })

  return accounts.map(serializeTreasuryAccount)
}

export async function listTreasuryTransactions(user: SessionUser, pagination: PaginationInput) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)

  const include = {
    fromAccount: { select: { id: true, name: true, type: true } },
    toAccount: { select: { id: true, name: true, type: true } },
    invoice: { select: { id: true, invoiceNumber: true, clientName: true } },
    createdBy: { select: { id: true, name: true, email: true } },
    approvedBy: { select: { id: true, name: true, email: true } },
  } satisfies Prisma.TreasuryTransactionInclude

  const [items, total] = await prisma.$transaction([
    prisma.treasuryTransaction.findMany({
      where: { companyId },
      include,
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    prisma.treasuryTransaction.count({ where: { companyId } }),
  ])

  return {
    items: items.map(serializeTreasuryTransaction),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      pageCount: Math.ceil(total / pagination.pageSize),
    },
  }
}
