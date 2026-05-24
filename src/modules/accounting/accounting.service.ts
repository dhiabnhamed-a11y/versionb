import 'server-only'

import { Prisma } from '@prisma/client'
import { toJsonValue } from '@/modules/shared/json'
import { badRequest, conflict, notFound } from '@/modules/shared/errors'
import type { PaginationInput } from '@/modules/shared/pagination'
import type { SessionUser } from '@/modules/shared/session'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { registerEnterpriseEventListeners } from '@/modules/events/listeners'
import { assertFinanceApproval, assertFinanceManage, assertFinanceRead, requireFinanceCompany } from '@/modules/finance/policy'
import { writeFinancialAuditLog } from '@/modules/finance/audit.repository'
import { decimalToMinorUnits, normalizeCurrency, sumDecimals, toDecimal, zeroDecimal } from '@/modules/accounting/money'
import type { FinancialAccountTypeValue, JournalEntryCommand, JournalLineCommand, NormalBalanceValue } from '@/modules/accounting/types'
import {
  createAccountSchema,
  createChartOfAccountSchema,
  createFinancialPeriodSchema,
  createJournalEntrySchema,
  reverseJournalEntrySchema,
} from '@/modules/accounting/accounting.validation'
import {
  accountingPrisma as prisma,
  accountReadSelect,
  findJournalEntryForCompany,
  journalEntryReadSelect,
  listAccountsForCompany,
  listJournalEntriesForCompany,
} from '@/modules/accounting/accounting.repository'

registerEnterpriseEventListeners()

type TransactionClient = Prisma.TransactionClient

function parseDate(value: string | Date | null | undefined, field: string) {
  if (value instanceof Date) return value
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) throw badRequest(`Invalid ${field}.`)
  return date
}

function trimOrNull(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed || null
}

function defaultNormalBalance(type: FinancialAccountTypeValue): NormalBalanceValue {
  if (type === 'ASSET' || type === 'EXPENSE' || type === 'CONTRA_LIABILITY' || type === 'CONTRA_REVENUE') return 'DEBIT'
  return 'CREDIT'
}

function serializeDecimalRecord<T extends Record<string, unknown>>(row: T): T {
  return JSON.parse(
    JSON.stringify(row, (_key, value) => {
      if (value && typeof value === 'object' && value.constructor?.name === 'Decimal') return value.toString()
      if (value instanceof Date) return value.toISOString()
      return value
    })
  ) as T
}

function normalizeLine(line: JournalLineCommand, index: number, currency: string, baseCurrency: string) {
  const debit = toDecimal(line.debit, `lines.${index}.debit`)
  const credit = toDecimal(line.credit, `lines.${index}.credit`)
  if (debit.isNegative() || credit.isNegative()) throw badRequest('Journal line amounts cannot be negative.')

  const hasDebit = debit.gt(0)
  const hasCredit = credit.gt(0)
  if (hasDebit === hasCredit) {
    throw badRequest('Each journal line must contain either a debit or a credit amount, not both.')
  }

  const debitMinor = decimalToMinorUnits(debit, currency, `lines.${index}.debit`)
  const creditMinor = decimalToMinorUnits(credit, currency, `lines.${index}.credit`)

  return {
    ...line,
    debit,
    credit,
    debitMinor,
    creditMinor,
    baseDebitMinor: currency === baseCurrency ? debitMinor : debitMinor,
    baseCreditMinor: currency === baseCurrency ? creditMinor : creditMinor,
    lineNumber: index + 1,
    description: trimOrNull(line.description),
    departmentId: trimOrNull(line.departmentId),
    costCenterId: trimOrNull(line.costCenterId),
    projectId: trimOrNull(line.projectId),
    clientId: trimOrNull(line.clientId),
    invoiceId: trimOrNull(line.invoiceId),
    taskId: trimOrNull(line.taskId),
    targetType: trimOrNull(line.targetType),
    targetId: trimOrNull(line.targetId),
  }
}

function normalizeJournalCommand(input: JournalEntryCommand) {
  if (input.lines.length < 2) throw badRequest('A journal entry must contain at least two lines.')

  const currency = normalizeCurrency(input.currency)
  const baseCurrency = normalizeCurrency(input.baseCurrency ?? currency)
  const lines = input.lines.map((line, index) => normalizeLine(line, index, currency, baseCurrency))
  const totalDebit = sumDecimals(lines.map((line) => line.debit))
  const totalCredit = sumDecimals(lines.map((line) => line.credit))
  const totalDebitMinor = lines.reduce((total, line) => total + line.debitMinor, BigInt(0))
  const totalCreditMinor = lines.reduce((total, line) => total + line.creditMinor, BigInt(0))
  if (!totalDebit.equals(totalCredit)) {
    throw badRequest('Journal entry is out of balance.', {
      totalDebit: totalDebit.toString(),
      totalCredit: totalCredit.toString(),
    })
  }
  if (!totalDebit.gt(0)) throw badRequest('Journal entry total must be greater than zero.')
  if (totalDebitMinor !== totalCreditMinor) {
    throw badRequest('Journal entry minor-unit totals are out of balance.', {
      totalDebitMinor: totalDebitMinor.toString(),
      totalCreditMinor: totalCreditMinor.toString(),
    })
  }

  return {
    ...input,
    periodId: trimOrNull(input.periodId),
    invoiceId: trimOrNull(input.invoiceId),
    entryNumber: trimOrNull(input.entryNumber),
    sourceType: input.sourceType ?? 'MANUAL',
    sourceId: trimOrNull(input.sourceId),
    memo: trimOrNull(input.memo),
    currency,
    accountingBasis: input.accountingBasis ?? 'ACCRUAL',
    baseCurrency,
    transactionDate: parseDate(input.transactionDate, 'transactionDate'),
    idempotencyKey: trimOrNull(input.idempotencyKey),
    requiresApproval: input.requiresApproval ?? true,
    postNow: input.postNow ?? false,
    reversalOfEntryId: trimOrNull(input.reversalOfEntryId),
    lines,
    totalDebit,
    totalCredit,
    totalDebitMinor,
    totalCreditMinor,
  }
}

async function nextJournalEntryNumber(tx: TransactionClient, companyId: string, date: Date) {
  const prefix = `JE-${date.getUTCFullYear()}-`
  const count = await tx.journalEntry.count({
    where: { companyId, entryNumber: { startsWith: prefix } },
  })
  return `${prefix}${String(count + 1).padStart(6, '0')}`
}

async function resolveOpenPeriod(tx: TransactionClient, input: { companyId: string; periodId?: string | null; transactionDate: Date }) {
  const period = input.periodId
    ? await tx.financialPeriod.findFirst({
        where: { id: input.periodId, companyId: input.companyId },
      })
    : await tx.financialPeriod.findFirst({
        where: {
          companyId: input.companyId,
          status: 'OPEN',
          startsAt: { lte: input.transactionDate },
          endsAt: { gte: input.transactionDate },
        },
        orderBy: { startsAt: 'desc' },
      })

  if (!period) throw badRequest('An open financial period is required before posting accounting entries.')
  if (period.status !== 'OPEN') throw conflict('Selected financial period is not open.')
  if (input.transactionDate < period.startsAt || input.transactionDate > period.endsAt) {
    throw badRequest('Journal transaction date must fall inside the selected financial period.')
  }

  return period
}

async function assertOperationalLinks(
  tx: TransactionClient,
  companyId: string,
  lines: ReturnType<typeof normalizeLine>[],
  invoiceId?: string | null
) {
  const projectIds = [...new Set(lines.map((line) => line.projectId).filter(Boolean) as string[])]
  const clientIds = [...new Set(lines.map((line) => line.clientId).filter(Boolean) as string[])]
  const invoiceIds = [...new Set([...lines.map((line) => line.invoiceId).filter(Boolean), invoiceId].filter(Boolean) as string[])]
  const taskIds = [...new Set(lines.map((line) => line.taskId).filter(Boolean) as string[])]
  const departmentIds = [...new Set(lines.map((line) => line.departmentId).filter(Boolean) as string[])]
  const costCenterIds = [...new Set(lines.map((line) => line.costCenterId).filter(Boolean) as string[])]

  const [projects, clients, invoices, tasks, departments, costCenters] = await Promise.all([
    projectIds.length ? tx.project.count({ where: { companyId, id: { in: projectIds } } }) : Promise.resolve(0),
    clientIds.length ? tx.client.count({ where: { companyId, id: { in: clientIds } } }) : Promise.resolve(0),
    invoiceIds.length ? tx.invoice.count({ where: { companyId, id: { in: invoiceIds } } }) : Promise.resolve(0),
    taskIds.length ? tx.task.count({ where: { id: { in: taskIds }, project: { companyId } } }) : Promise.resolve(0),
    departmentIds.length ? tx.enterpriseDepartment.count({ where: { companyId, id: { in: departmentIds }, deletedAt: null } }) : Promise.resolve(0),
    costCenterIds.length ? tx.costCenter.count({ where: { companyId, id: { in: costCenterIds }, status: 'ACTIVE' } }) : Promise.resolve(0),
  ])

  if (projects !== projectIds.length) throw badRequest('One or more journal project links are outside this workspace.')
  if (clients !== clientIds.length) throw badRequest('One or more journal client links are outside this workspace.')
  if (invoices !== invoiceIds.length) throw badRequest('One or more journal invoice links are outside this workspace.')
  if (tasks !== taskIds.length) throw badRequest('One or more journal task links are outside this workspace.')
  if (departments !== departmentIds.length) throw badRequest('One or more journal department links are outside this workspace.')
  if (costCenters !== costCenterIds.length) throw badRequest('One or more journal cost center links are outside this workspace.')
}

async function loadActiveAccounts(tx: TransactionClient, companyId: string, lines: ReturnType<typeof normalizeLine>[]) {
  const accountIds = [...new Set(lines.map((line) => line.accountId))]
  const accounts = await tx.account.findMany({
    where: { companyId, id: { in: accountIds }, status: 'ACTIVE', deletedAt: null },
    select: { id: true, code: true, name: true, normalBalance: true },
  })
  if (accounts.length !== accountIds.length) throw badRequest('Every journal line must use an active account in this workspace.')
  return new Map(accounts.map((account) => [account.id, account]))
}

async function writeJournalAudit(tx: TransactionClient, input: Parameters<typeof writeFinancialAuditLog>[1]) {
  await writeFinancialAuditLog(tx, input)
}

export async function createChartOfAccount(user: SessionUser, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)
  const input = createChartOfAccountSchema.parse(rawInput)

  const chart = await prisma.$transaction(async (tx) => {
    const created = await tx.chartOfAccount.create({
      data: {
        companyId,
        name: input.name,
        description: trimOrNull(input.description),
        currency: normalizeCurrency(input.currency),
        isDefault: input.isDefault ?? false,
        metadata: toJsonValue(input.metadata),
      },
    })
    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: 'finance.chart_of_account.created',
      entityType: 'chart_of_account',
      entityId: created.id,
      after: created,
    })
    return created
  })

  return serializeDecimalRecord(chart)
}

export async function createAccount(user: SessionUser, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)
  const input = createAccountSchema.parse(rawInput)

  const account = await prisma.$transaction(async (tx) => {
    if (input.chartId) {
      const chart = await tx.chartOfAccount.findFirst({ where: { id: input.chartId, companyId }, select: { id: true } })
      if (!chart) throw badRequest('Selected chart of accounts was not found in this workspace.')
    }
    if (input.parentAccountId) {
      const parent = await tx.account.findFirst({ where: { id: input.parentAccountId, companyId, deletedAt: null }, select: { id: true } })
      if (!parent) throw badRequest('Selected parent account was not found in this workspace.')
    }

    const created = await tx.account.create({
      data: {
        companyId,
        chartId: input.chartId ?? null,
        parentAccountId: input.parentAccountId ?? null,
        code: input.code.toUpperCase(),
        name: input.name,
        description: trimOrNull(input.description),
        type: input.type,
        normalBalance: input.normalBalance ?? defaultNormalBalance(input.type),
        currency: normalizeCurrency(input.currency),
        isSystem: input.isSystem ?? false,
        metadata: toJsonValue(input.metadata),
      },
      select: accountReadSelect,
    })
    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: 'finance.account.created',
      entityType: 'account',
      entityId: created.id,
      after: created,
    })
    return created
  })

  await publishDomainEvent({
    type: 'finance.account.created',
    companyId,
    actorId: user.id,
    entityType: 'account',
    entityId: account.id,
    action: `Account ${account.code} created`,
    payload: { account },
    after: account,
  })

  return serializeDecimalRecord(account)
}

export async function listAccounts(user: SessionUser) {
  const companyId = requireFinanceCompany(user)
  assertFinanceRead(user)
  const accounts = await listAccountsForCompany(companyId)
  return accounts.map(serializeDecimalRecord)
}

export async function createFinancialPeriod(user: SessionUser, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)
  const input = createFinancialPeriodSchema.parse(rawInput)
  const startsAt = parseDate(input.startsAt, 'startsAt')
  const endsAt = parseDate(input.endsAt, 'endsAt')
  if (startsAt >= endsAt) throw badRequest('Financial period start must be before end.')

  const period = await prisma.$transaction(async (tx) => {
    const overlap = await tx.financialPeriod.findFirst({
      where: {
        companyId,
        startsAt: { lte: endsAt },
        endsAt: { gte: startsAt },
      },
      select: { id: true, name: true },
    })
    if (overlap) throw conflict(`Financial period overlaps ${overlap.name}.`)

    const created = await tx.financialPeriod.create({
      data: {
        companyId,
        name: input.name,
        startsAt,
        endsAt,
        metadata: toJsonValue(input.metadata),
      },
    })
    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: 'finance.period.created',
      entityType: 'financial_period',
      entityId: created.id,
      after: created,
    })
    return created
  })

  return serializeDecimalRecord(period)
}

export async function listFinancialPeriods(user: SessionUser) {
  const companyId = requireFinanceCompany(user)
  assertFinanceRead(user)
  const periods = await prisma.financialPeriod.findMany({
    where: { companyId },
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
  })
  return periods.map(serializeDecimalRecord)
}

export async function closeFinancialPeriod(user: SessionUser, id: string) {
  const companyId = requireFinanceCompany(user)
  assertFinanceApproval(user)

  const period = await prisma.$transaction(async (tx) => {
    const existing = await tx.financialPeriod.findFirst({ where: { id, companyId } })
    if (!existing) throw notFound('Financial period not found.')
    if (existing.status === 'CLOSED') return existing

    const openEntries = await tx.journalEntry.count({
      where: { companyId, periodId: id, status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] } },
    })
    if (openEntries > 0) throw conflict('Cannot close a period with unposted journal entries.')

    const updated = await tx.financialPeriod.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), closedById: user.id },
    })
    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: 'finance.period.closed',
      entityType: 'financial_period',
      entityId: id,
      before: existing,
      after: updated,
    })
    return updated
  })

  return serializeDecimalRecord(period)
}

export async function createJournalEntryInTransaction(tx: TransactionClient, command: JournalEntryCommand) {
  const normalized = normalizeJournalCommand(command)
  const period = await resolveOpenPeriod(tx, {
    companyId: normalized.companyId,
    periodId: normalized.periodId,
    transactionDate: normalized.transactionDate,
  })
  await assertOperationalLinks(tx, normalized.companyId, normalized.lines, normalized.invoiceId)
  await loadActiveAccounts(tx, normalized.companyId, normalized.lines)

  const entryNumber = normalized.entryNumber ?? (await nextJournalEntryNumber(tx, normalized.companyId, normalized.transactionDate))
  const initialStatus = normalized.postNow ? 'APPROVED' : normalized.requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED'
  const created = await tx.journalEntry.create({
    data: {
      companyId: normalized.companyId,
      periodId: period.id,
      createdById: normalized.actorId ?? null,
      approvedById: normalized.requiresApproval ? null : normalized.actorId ?? null,
      approvedAt: normalized.requiresApproval ? null : new Date(),
      invoiceId: normalized.invoiceId,
      entryNumber,
      status: initialStatus,
      sourceType: normalized.sourceType,
      sourceId: normalized.sourceId,
      memo: normalized.memo,
      currency: normalized.currency,
      accountingBasis: normalized.accountingBasis,
      baseCurrency: normalized.baseCurrency,
      transactionDate: normalized.transactionDate,
      totalDebit: normalized.totalDebit,
      totalCredit: normalized.totalCredit,
      totalDebitMinor: normalized.totalDebitMinor,
      totalCreditMinor: normalized.totalCreditMinor,
      idempotencyKey: normalized.idempotencyKey,
      reversalOfEntryId: normalized.reversalOfEntryId,
      metadata: toJsonValue(normalized.metadata),
      lines: {
        create: normalized.lines.map((line) => ({
          companyId: normalized.companyId,
          accountId: line.accountId,
          lineNumber: line.lineNumber,
          description: line.description,
          debit: line.debit,
          credit: line.credit,
          debitMinor: line.debitMinor,
          creditMinor: line.creditMinor,
          baseDebitMinor: line.baseDebitMinor,
          baseCreditMinor: line.baseCreditMinor,
          currency: normalized.currency,
          departmentId: line.departmentId,
          costCenterId: line.costCenterId,
          projectId: line.projectId,
          clientId: line.clientId,
          invoiceId: line.invoiceId ?? normalized.invoiceId,
          taskId: line.taskId,
          targetType: line.targetType,
          targetId: line.targetId,
          metadata: toJsonValue(line.metadata),
        })),
      },
    },
    select: journalEntryReadSelect,
  })

  await writeJournalAudit(tx, {
    companyId: normalized.companyId,
    actorId: normalized.actorId ?? null,
    action: 'finance.journal_entry.created',
    entityType: 'journal_entry',
    entityId: created.id,
    after: created,
    metadata: { postNow: normalized.postNow, sourceType: normalized.sourceType },
  })

  if (normalized.postNow) {
    return postJournalEntryInTransaction(tx, {
      companyId: normalized.companyId,
      entryId: created.id,
      actorId: normalized.actorId ?? null,
    })
  }

  return created
}

export async function createJournalEntry(user: SessionUser, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceManage(user)
  const input = createJournalEntrySchema.parse(rawInput)

  if (input.postNow) assertFinanceApproval(user)

  if (input.idempotencyKey) {
    const existing = await prisma.journalEntry.findUnique({
      where: { companyId_idempotencyKey: { companyId, idempotencyKey: input.idempotencyKey } },
      select: journalEntryReadSelect,
    })
    if (existing) return serializeDecimalRecord(existing)
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const entry = await prisma.$transaction((tx) =>
        createJournalEntryInTransaction(tx, {
          ...input,
          companyId,
          actorId: user.id,
        })
      )

      await publishDomainEvent({
        type: entry.status === 'POSTED' ? 'finance.journal_entry.posted' : 'finance.journal_entry.created',
        companyId,
        actorId: user.id,
        entityType: 'journal_entry',
        entityId: entry.id,
        action: entry.status === 'POSTED' ? `Journal entry ${entry.entryNumber} posted` : `Journal entry ${entry.entryNumber} created`,
        payload: { journalEntry: serializeDecimalRecord(entry) },
        after: serializeDecimalRecord(entry),
      })
      return serializeDecimalRecord(entry)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && !input.entryNumber) continue
      throw error
    }
  }

  throw conflict('Unable to allocate a journal entry number. Please try again.')
}

export async function listJournalEntries(user: SessionUser, pagination: PaginationInput) {
  const companyId = requireFinanceCompany(user)
  assertFinanceRead(user)
  const [items, total] = await listJournalEntriesForCompany(companyId, pagination)
  return {
    items: items.map(serializeDecimalRecord),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      pageCount: Math.ceil(total / pagination.pageSize),
    },
  }
}

export async function getJournalEntry(user: SessionUser, id: string) {
  const companyId = requireFinanceCompany(user)
  assertFinanceRead(user)
  const entry = await findJournalEntryForCompany(companyId, id)
  if (!entry) throw notFound('Journal entry not found.')
  return serializeDecimalRecord(entry)
}

export async function postJournalEntryInTransaction(tx: TransactionClient, input: { companyId: string; entryId: string; actorId?: string | null }) {
  const entry = await tx.journalEntry.findFirst({
    where: { id: input.entryId, companyId: input.companyId },
    include: {
      period: true,
      lines: {
        include: { account: { select: { id: true, normalBalance: true } } },
        orderBy: { lineNumber: 'asc' },
      },
    },
  })
  if (!entry) throw notFound('Journal entry not found.')
  if (entry.status === 'POSTED') {
    return tx.journalEntry.findUniqueOrThrow({ where: { id: entry.id }, select: journalEntryReadSelect })
  }
  if (entry.status === 'REVERSED' || entry.status === 'VOID') throw conflict('This journal entry cannot be posted.')
  if (!entry.period || entry.period.status !== 'OPEN') throw conflict('Journal entry must belong to an open financial period before posting.')

  const debit = sumDecimals(entry.lines.map((line) => line.debit))
  const credit = sumDecimals(entry.lines.map((line) => line.credit))
  const debitMinor = entry.lines.reduce((total, line) => total + line.debitMinor, BigInt(0))
  const creditMinor = entry.lines.reduce((total, line) => total + line.creditMinor, BigInt(0))
  if (!debit.equals(credit) || !debit.equals(entry.totalDebit) || !credit.equals(entry.totalCredit)) {
    throw conflict('Journal entry lines no longer match the balanced totals.')
  }
  if (debitMinor !== creditMinor || debitMinor !== entry.totalDebitMinor || creditMinor !== entry.totalCreditMinor) {
    throw conflict('Journal entry minor-unit totals no longer match the balanced totals.')
  }

  await tx.ledger.createMany({
    data: entry.lines.map((line) => {
      const balanceImpact = line.account.normalBalance === 'DEBIT' ? line.debit.minus(line.credit) : line.credit.minus(line.debit)
      const balanceImpactMinor = line.account.normalBalance === 'DEBIT' ? line.debitMinor - line.creditMinor : line.creditMinor - line.debitMinor
      return {
        companyId: input.companyId,
        periodId: entry.periodId,
        accountId: line.accountId,
        journalEntryId: entry.id,
        journalLineId: line.id,
        postingDate: entry.transactionDate,
        debit: line.debit,
        credit: line.credit,
        balanceImpact,
        debitMinor: line.debitMinor,
        creditMinor: line.creditMinor,
        balanceImpactMinor,
        baseDebitMinor: line.baseDebitMinor,
        baseCreditMinor: line.baseCreditMinor,
        currency: line.currency,
        departmentId: line.departmentId,
        costCenterId: line.costCenterId,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        metadata: toJsonValue({ entryNumber: entry.entryNumber, lineNumber: line.lineNumber }),
      }
    }),
  })

  const updated = await tx.journalEntry.update({
    where: { id: entry.id },
    data: {
      status: 'POSTED',
      postedAt: new Date(),
      postedById: input.actorId ?? null,
      approvedAt: entry.approvedAt ?? new Date(),
      approvedById: entry.approvedById ?? input.actorId ?? null,
    },
    select: journalEntryReadSelect,
  })

  await writeFinancialAuditLog(tx, {
    companyId: input.companyId,
    actorId: input.actorId ?? null,
    action: 'finance.journal_entry.posted',
    entityType: 'journal_entry',
    entityId: entry.id,
    before: entry,
    after: updated,
  })

  return updated
}

export async function postJournalEntry(user: SessionUser, id: string) {
  const companyId = requireFinanceCompany(user)
  assertFinanceApproval(user)
  const entry = await prisma.$transaction((tx) => postJournalEntryInTransaction(tx, { companyId, entryId: id, actorId: user.id }))

  await publishDomainEvent({
    type: 'finance.journal_entry.posted',
    companyId,
    actorId: user.id,
    entityType: 'journal_entry',
    entityId: id,
    action: `Journal entry ${entry.entryNumber} posted`,
    payload: { journalEntry: serializeDecimalRecord(entry) },
    after: serializeDecimalRecord(entry),
  })

  return serializeDecimalRecord(entry)
}

export async function reverseJournalEntry(user: SessionUser, id: string, rawInput: unknown) {
  const companyId = requireFinanceCompany(user)
  assertFinanceApproval(user)
  const input = reverseJournalEntrySchema.parse(rawInput)
  const transactionDate = parseDate(input.transactionDate, 'transactionDate')

  const reversal = await prisma.$transaction(async (tx) => {
    const original = await tx.journalEntry.findFirst({
      where: { id, companyId },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    })
    if (!original) throw notFound('Journal entry not found.')
    if (original.status !== 'POSTED') throw conflict('Only posted journal entries can be reversed.')
    if (original.reversedAt) throw conflict('Journal entry was already reversed.')

    const created = await createJournalEntryInTransaction(tx, {
      companyId,
      actorId: user.id,
      sourceType: 'REVERSAL',
      sourceId: original.id,
      memo: `Reversal of ${original.entryNumber}: ${input.reason}`,
      currency: original.currency,
      transactionDate,
      idempotencyKey: input.idempotencyKey,
      requiresApproval: false,
      postNow: true,
      reversalOfEntryId: original.id,
      metadata: {
        reason: input.reason,
        originalEntryNumber: original.entryNumber,
      },
      lines: original.lines.map((line) => ({
        accountId: line.accountId,
        description: `Reverse line ${line.lineNumber}: ${line.description ?? original.entryNumber}`,
        debit: line.credit.gt(0) ? line.credit : zeroDecimal(),
        credit: line.debit.gt(0) ? line.debit : zeroDecimal(),
        departmentId: line.departmentId,
        costCenterId: line.costCenterId,
        projectId: line.projectId,
        clientId: line.clientId,
        invoiceId: line.invoiceId,
        taskId: line.taskId,
        targetType: line.targetType,
        targetId: line.targetId,
        metadata: { reversalOfLineId: line.id },
      })),
    })

    await tx.journalEntry.update({
      where: { id: original.id },
      data: { status: 'REVERSED', reversedAt: new Date() },
    })
    await writeFinancialAuditLog(tx, {
      companyId,
      actorId: user.id,
      action: 'finance.journal_entry.reversed',
      entityType: 'journal_entry',
      entityId: original.id,
      before: original,
      after: { reversedAt: new Date().toISOString(), reversalEntryId: created.id },
      metadata: { reason: input.reason },
    })
    return created
  })

  await publishDomainEvent({
    type: 'finance.journal_entry.reversed',
    companyId,
    actorId: user.id,
    entityType: 'journal_entry',
    entityId: id,
    action: 'Journal entry reversed',
    payload: { reversal: serializeDecimalRecord(reversal) },
    after: serializeDecimalRecord(reversal),
  })

  return serializeDecimalRecord(reversal)
}
