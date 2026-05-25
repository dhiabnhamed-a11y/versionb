import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { normalizeUserRole } from '@/lib/security'
import { badRequest, forbidden, notFound } from '@/modules/shared/errors'
import type { SessionUser } from '@/modules/shared/session'
import { computeCashForecast } from '@/services/erp2/ai'
import { ensureErpWorkspaceInitialized } from '@/services/erp2/setup.service'
import {
  createErpBudgetSchema,
  createErpEmployeeSchema,
  createErpInventoryItemSchema,
  createErpJournalEntrySchema,
  createErpLeaveRequestSchema,
  createErpPayableSchema,
  createErpPurchaseOrderSchema,
  createErpReceivableSchema,
  createErpTaxRateSchema,
  erpGenericModulePatchSchema,
  erpModuleNameSchema,
  updateErpSettingsSchema,
  type ErpModuleName,
} from '@/services/erp2/operations.validation'

type TransactionClient = Prisma.TransactionClient

type QueryInput = {
  q?: string | null
  status?: string | null
}

type Metric = {
  label: string
  value: number | string
  tone?: 'neutral' | 'good' | 'warning' | 'critical'
  format?: 'money' | 'number' | 'text' | 'percent'
}

type SelectOption = {
  label: string
  value: string
  meta?: string
}

type ModulePayload = {
  module: ErpModuleName
  metrics: Metric[]
  rows: Array<Record<string, unknown>>
  secondaryRows?: Array<Record<string, unknown>>
  options?: Record<string, SelectOption[]>
  insights?: string[]
  generatedAt: string
}

const READABLE_ROLE_RANK: Record<string, number> = {
  EMPLOYEE: 10,
  MANAGER: 50,
  OWNER: 80,
  SUPER_ADMIN: 100,
}

function workspaceIdFor(user: SessionUser) {
  if (!user.companyId) throw forbidden('A workspace is required for ERP operations.')
  return user.companyId
}

function requireManager(user: SessionUser) {
  const role = normalizeUserRole(user.role)
  if ((READABLE_ROLE_RANK[role] ?? 0) < READABLE_ROLE_RANK.MANAGER) {
    throw forbidden('Manager or owner permissions are required for ERP changes.')
  }
}

function requireOwner(user: SessionUser) {
  const role = normalizeUserRole(user.role)
  if ((READABLE_ROLE_RANK[role] ?? 0) < READABLE_ROLE_RANK.OWNER) {
    throw forbidden('Owner permissions are required for role changes.')
  }
}

function toCents(value: unknown) {
  if (typeof value === 'number') return Math.round(value * 100)
  if (typeof value === 'string') {
    const normalized = value.replace(/[$,\s]/g, '')
    return Math.round(Number(normalized || '0') * 100)
  }
  return 0
}

function toDate(value: string, fallback = new Date()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function daysInclusive(start: Date, end: Date) {
  const startMs = startOfDay(start).getTime()
  const endMs = startOfDay(end).getTime()
  return Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1)
}

function currentMonthYear(date = new Date()) {
  return { month: date.getMonth() + 1, year: date.getFullYear() }
}

function qContains(value?: string | null) {
  const q = value?.trim()
  return q ? { contains: q, mode: Prisma.QueryMode.insensitive } : undefined
}

function isPastDue(dueDate: Date, paid = false) {
  return !paid && startOfDay(dueDate).getTime() < startOfDay(new Date()).getTime()
}

function makePayload(input: Omit<ModulePayload, 'generatedAt'>): ModulePayload {
  return { ...input, generatedAt: new Date().toISOString() }
}

async function ensureReady(workspaceId: string) {
  await prisma.$transaction((tx) => ensureErpWorkspaceInitialized(tx, workspaceId), {
    maxWait: 10_000,
    timeout: 30_000,
  })
}

async function recordOperationalEvent(
  tx: TransactionClient,
  user: SessionUser,
  action: string,
  entityType: string,
  entityId: string,
  after?: Prisma.InputJsonValue
) {
  await Promise.all([
    tx.auditLog.create({
      data: {
        companyId: user.companyId,
        actorId: user.id,
        action,
        entityType,
        entityId,
        after,
        metadata: { surface: 'erp', source: 'erp2_operations' },
      },
    }),
    tx.activity.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action,
        entityType,
        entityId,
        source: 'erp',
        metadata: after,
      },
    }),
  ])
}

async function defaultCurrency(tx: TransactionClient, workspaceId: string) {
  const settings = await tx.eRPSettings.findUnique({
    where: { workspaceId },
    select: { defaultCurrency: true },
  })
  return settings?.defaultCurrency ?? 'USD'
}

async function getOpenPeriod(tx: TransactionClient, workspaceId: string, date: Date) {
  const period = await tx.eRPPeriod.findFirst({
    where: {
      workspaceId,
      isDeleted: false,
      isLocked: false,
      startDate: { lte: date },
      endDate: { gte: date },
    },
    orderBy: { startDate: 'asc' },
  })
  if (!period) throw badRequest('No open fiscal period covers this transaction date.')
  return period
}

async function postBalances(
  tx: TransactionClient,
  workspaceId: string,
  lines: Array<{ accountId: string; debit: number; credit: number }>,
  date = new Date()
) {
  const { month, year } = currentMonthYear(date)
  for (const line of lines) {
    await tx.eRPAccountBalance.upsert({
      where: { workspaceId_accountId_month_year: { workspaceId, accountId: line.accountId, month, year } },
      create: {
        workspaceId,
        accountId: line.accountId,
        month,
        year,
        debitTotal: line.debit,
        creditTotal: line.credit,
        netChange: line.debit - line.credit,
      },
      update: {
        debitTotal: { increment: line.debit },
        creditTotal: { increment: line.credit },
        netChange: { increment: line.debit - line.credit },
      },
    })
  }
}

async function createSimpleJournal(
  tx: TransactionClient,
  user: SessionUser,
  input: {
    date?: Date
    description: string
    reference?: string | null
    debitAccountId: string
    creditAccountId: string
    amountCents: number
    currency?: string
    sourceType: string
    sourceId: string
    postNow?: boolean
  }
) {
  const workspaceId = workspaceIdFor(user)
  const date = input.date ?? new Date()
  const period = await getOpenPeriod(tx, workspaceId, date)
  const accounts = await tx.eRPAccount.findMany({
    where: {
      workspaceId,
      id: { in: [input.debitAccountId, input.creditAccountId] },
      isDeleted: false,
      isActive: true,
    },
    select: { id: true },
  })
  if (accounts.length !== 2 || input.debitAccountId === input.creditAccountId) {
    throw badRequest('Debit and credit accounts must be two active accounts in this workspace.')
  }

  const count = await tx.eRPJournalEntry.count({ where: { workspaceId } })
  const entryNumber = `JE-${date.getFullYear()}-${String(count + 1).padStart(5, '0')}`
  const lines = [
    { accountId: input.debitAccountId, description: input.description, debit: input.amountCents, credit: 0 },
    { accountId: input.creditAccountId, description: input.description, debit: 0, credit: input.amountCents },
  ]

  const entry = await tx.eRPJournalEntry.create({
    data: {
      workspaceId,
      periodId: period.id,
      entryNumber,
      date,
      description: input.description,
      reference: input.reference || undefined,
      status: input.postNow === false ? 'DRAFT' : 'POSTED',
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      createdById: user.id,
      lines: {
        create: lines.map((line) => ({
          ...line,
          workspaceId,
          currency: input.currency ?? 'USD',
        })),
      },
    },
    include: { lines: true },
  })

  if (entry.status === 'POSTED') {
    await postBalances(tx, workspaceId, lines, date)
  }

  await recordOperationalEvent(tx, user, entry.status === 'POSTED' ? 'erp.journal_entry.posted' : 'erp.journal_entry.created', 'ERPJournalEntry', entry.id, {
    entryNumber,
    amount: input.amountCents,
    sourceType: input.sourceType,
  })

  return entry
}

async function createWorkflowAlert(
  tx: TransactionClient,
  workspaceId: string,
  input: {
    type: 'OVERDUE_AR' | 'BUDGET_THRESHOLD' | 'CASH_LOW' | 'PAYROLL_ANOMALY'
    severity: 'INFO' | 'WARNING' | 'CRITICAL'
    title: string
    description: string
    entityType: string
    entityId: string
    confidence?: number
  }
) {
  await tx.eRPAlert.create({
    data: {
      workspaceId,
      type: input.type,
      severity: input.severity,
      title: input.title,
      description: input.description,
      entityType: input.entityType,
      entityId: input.entityId,
      aiConfidence: input.confidence ?? 0.82,
    },
  })
}

function accountsToOptions(accounts: Array<{ id: string; code: string; name: string; type: string }>): SelectOption[] {
  return accounts.map((account) => ({
    value: account.id,
    label: `${account.code} - ${account.name}`,
    meta: account.type,
  }))
}

function vendorsToOptions(vendors: Array<{ id: string; name: string; email: string | null }>): SelectOption[] {
  return vendors.map((vendor) => ({
    value: vendor.id,
    label: vendor.name,
    meta: vendor.email ?? undefined,
  }))
}

function employeesToOptions(employees: Array<{ id: string; firstName: string; lastName: string; jobTitle: string }>): SelectOption[] {
  return employees.map((employee) => ({
    value: employee.id,
    label: `${employee.firstName} ${employee.lastName}`,
    meta: employee.jobTitle,
  }))
}

export async function getErpCommandCenter(user: SessionUser) {
  const workspaceId = workspaceIdFor(user)
  await ensureReady(workspaceId)

  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86_400_000)

  const [
    settings,
    totalAccounts,
    totalJournalEntries,
    totalPurchaseOrders,
    totalEmployees,
    postedLines,
    openReceivables,
    openPayables,
    lowStockItems,
    unresolvedAlerts,
    recentActivity,
  ] = await Promise.all([
    prisma.eRPSettings.findUnique({ where: { workspaceId } }),
    prisma.eRPAccount.count({ where: { workspaceId, isDeleted: false, isActive: true } }),
    prisma.eRPJournalEntry.count({ where: { workspaceId, isDeleted: false } }),
    prisma.eRPPurchaseOrder.count({ where: { workspaceId, isDeleted: false } }),
    prisma.eRPEmployee.count({ where: { workspaceId, isDeleted: false, isActive: true } }),
    prisma.eRPJournalLine.findMany({
      where: { workspaceId, isDeleted: false, journalEntry: { status: 'POSTED', isDeleted: false } },
      include: { account: true },
      take: 500,
    }),
    prisma.eRPARLedger.aggregate({
      where: { workspaceId, isDeleted: false, status: { in: ['OPEN', 'PARTIAL', 'OVERDUE'] } },
      _sum: { amount: true, amountPaid: true },
      _count: true,
    }),
    prisma.eRPAPBill.aggregate({
      where: { workspaceId, isDeleted: false, status: { in: ['PENDING', 'APPROVED', 'OVERDUE'] } },
      _sum: { amount: true, amountPaid: true },
      _count: true,
    }),
    prisma.eRPInventoryItem.count({
      where: { workspaceId, isDeleted: false, isActive: true, currentStock: { lte: prisma.eRPInventoryItem.fields.reorderPoint } },
    }).catch(() => 0),
    prisma.eRPAlert.count({ where: { workspaceId, isResolved: false } }),
    prisma.activity.findMany({
      where: { companyId: workspaceId, source: 'erp' },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ])

  const cashBalance = postedLines
    .filter((line) => line.account.code.startsWith('10'))
    .reduce((sum, line) => sum + line.debit - line.credit, 0)
  const receivableExposure = (openReceivables._sum.amount ?? 0) - (openReceivables._sum.amountPaid ?? 0)
  const payableExposure = (openPayables._sum.amount ?? 0) - (openPayables._sum.amountPaid ?? 0)

  const dueSoonReceivables = await prisma.eRPARLedger.count({
    where: {
      workspaceId,
      isDeleted: false,
      status: { in: ['OPEN', 'PARTIAL'] },
      dueDate: { lte: thirtyDaysFromNow },
    },
  })

  return {
    totals: { totalAccounts, totalJournalEntries, totalPurchaseOrders, totalEmployees },
    metrics: [
      { label: 'Cash position', value: cashBalance, format: 'money', tone: cashBalance < 0 ? 'critical' : 'good' },
      { label: 'Receivables exposure', value: receivableExposure, format: 'money', tone: receivableExposure > 0 ? 'warning' : 'neutral' },
      { label: 'Payables exposure', value: payableExposure, format: 'money', tone: payableExposure > cashBalance ? 'critical' : 'neutral' },
      { label: 'Open alerts', value: unresolvedAlerts, format: 'number', tone: unresolvedAlerts > 0 ? 'warning' : 'good' },
    ],
    operations: {
      lowStockItems,
      dueSoonReceivables,
      defaultCurrency: settings?.defaultCurrency ?? 'USD',
    },
    recentActivity,
  }
}

export async function listErpModule(user: SessionUser, rawModule: string, query: QueryInput): Promise<ModulePayload> {
  const module = erpModuleNameSchema.parse(rawModule)
  const workspaceId = workspaceIdFor(user)
  await ensureReady(workspaceId)

  switch (module) {
    case 'general-ledger':
      return listGeneralLedger(workspaceId, module, query)
    case 'accounts-receivable':
      return listAccountsReceivable(workspaceId, module, query)
    case 'accounts-payable':
      return listAccountsPayable(workspaceId, module, query)
    case 'budgets':
      return listBudgets(workspaceId, module, query)
    case 'procurement':
      return listProcurement(workspaceId, module, query)
    case 'inventory':
      return listInventory(workspaceId, module, query)
    case 'hr':
      return listHr(workspaceId, module, query)
    case 'leave':
      return listLeave(workspaceId, module, query)
    case 'reports':
      return listReports(workspaceId, module)
    case 'settings':
      return listSettings(workspaceId, module)
    case 'roles':
      return listRoles(workspaceId, module)
    default:
      throw notFound()
  }
}

async function listGeneralLedger(workspaceId: string, module: ErpModuleName, query: QueryInput): Promise<ModulePayload> {
  const q = qContains(query.q)
  const status = query.status?.trim().toUpperCase()
  const where: Prisma.ERPJournalEntryWhereInput = {
    workspaceId,
    isDeleted: false,
    ...(q ? { OR: [{ entryNumber: q }, { description: q }, { reference: q }] } : {}),
    ...(status ? { status: status as Prisma.EnumERPJournalStatusFilter['equals'] } : {}),
  }

  const [accounts, entries, postedLines, draftCount] = await Promise.all([
    prisma.eRPAccount.findMany({
      where: { workspaceId, isDeleted: false, isActive: true },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, type: true, currency: true },
    }),
    prisma.eRPJournalEntry.findMany({
      where,
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
      take: 50,
    }),
    prisma.eRPJournalLine.findMany({
      where: { workspaceId, isDeleted: false, journalEntry: { status: 'POSTED' } },
      include: { account: true },
      take: 500,
    }),
    prisma.eRPJournalEntry.count({ where: { workspaceId, isDeleted: false, status: 'DRAFT' } }),
  ])

  const debitTotal = postedLines.reduce((sum, line) => sum + line.debit, 0)
  const creditTotal = postedLines.reduce((sum, line) => sum + line.credit, 0)

  return makePayload({
    module,
    metrics: [
      { label: 'Posted debits', value: debitTotal, format: 'money', tone: 'neutral' },
      { label: 'Posted credits', value: creditTotal, format: 'money', tone: 'neutral' },
      { label: 'Draft entries', value: draftCount, format: 'number', tone: draftCount > 0 ? 'warning' : 'good' },
      { label: 'Active accounts', value: accounts.length, format: 'number', tone: 'good' },
    ],
    rows: entries.map((entry) => ({
      id: entry.id,
      entryNumber: entry.entryNumber,
      date: entry.date,
      description: entry.description,
      reference: entry.reference,
      status: entry.status,
      amount: Math.max(
        entry.lines.reduce((sum, line) => sum + line.debit, 0),
        entry.lines.reduce((sum, line) => sum + line.credit, 0)
      ),
      lines: entry.lines.map((line) => `${line.account.code} ${line.account.name}`).join(' / '),
      createdAt: entry.createdAt,
    })),
    options: { accounts: accountsToOptions(accounts) },
    insights: [
      debitTotal === creditTotal ? 'Posted ledger lines are balanced.' : 'Posted ledger lines are not balanced. Review manual entries.',
      draftCount > 0 ? `${draftCount} journal entries are waiting to be posted.` : 'No draft journal entries are waiting.',
    ],
  })
}

async function listAccountsReceivable(workspaceId: string, module: ErpModuleName, query: QueryInput): Promise<ModulePayload> {
  const q = qContains(query.q)
  const status = query.status?.trim().toUpperCase()
  const where: Prisma.ERPARLedgerWhereInput = {
    workspaceId,
    isDeleted: false,
    ...(q ? { OR: [{ clientName: q }, { clientEmail: q }, { invoiceRef: q }] } : {}),
    ...(status ? { status: status as Prisma.EnumERPARStatusFilter['equals'] } : {}),
  }

  const [rows, aggregate, overdue, clients] = await Promise.all([
    prisma.eRPARLedger.findMany({
      where,
      include: { payments: { where: { isDeleted: false }, orderBy: { paidAt: 'desc' } } },
      orderBy: { dueDate: 'asc' },
      take: 80,
    }),
    prisma.eRPARLedger.aggregate({
      where: { workspaceId, isDeleted: false, status: { in: ['OPEN', 'PARTIAL', 'OVERDUE'] } },
      _sum: { amount: true, amountPaid: true },
      _count: true,
    }),
    prisma.eRPARLedger.count({ where: { workspaceId, isDeleted: false, status: 'OVERDUE' } }),
    prisma.client.findMany({
      where: { companyId: workspaceId },
      select: { id: true, companyName: true, email: true },
      orderBy: { companyName: 'asc' },
      take: 100,
    }),
  ])

  const total = aggregate._sum.amount ?? 0
  const paid = aggregate._sum.amountPaid ?? 0

  return makePayload({
    module,
    metrics: [
      { label: 'Open receivables', value: total - paid, format: 'money', tone: total > paid ? 'warning' : 'good' },
      { label: 'Collected', value: paid, format: 'money', tone: 'good' },
      { label: 'Open invoices', value: aggregate._count, format: 'number', tone: 'neutral' },
      { label: 'Overdue', value: overdue, format: 'number', tone: overdue > 0 ? 'critical' : 'good' },
    ],
    rows: rows.map((item) => ({
      id: item.id,
      clientName: item.clientName,
      invoiceRef: item.invoiceRef,
      dueDate: item.dueDate,
      status: item.status,
      amount: item.amount,
      amountPaid: item.amountPaid,
      balance: item.amount - item.amountPaid,
      currency: item.currency,
      payments: item.payments.length,
    })),
    options: {
      clients: clients.map((client) => ({
        value: client.id,
        label: client.companyName,
        meta: client.email ?? undefined,
      })),
    },
    insights: [
      overdue > 0 ? `${overdue} receivable records are overdue and should trigger follow-up.` : 'No receivable records are overdue.',
      total > paid ? 'Collections are part of the cash forecast and dashboard risk metrics.' : 'All receivables are collected.',
    ],
  })
}

async function listAccountsPayable(workspaceId: string, module: ErpModuleName, query: QueryInput): Promise<ModulePayload> {
  const q = qContains(query.q)
  const status = query.status?.trim().toUpperCase()
  const where: Prisma.ERPAPBillWhereInput = {
    workspaceId,
    isDeleted: false,
    ...(q ? { OR: [{ billNumber: q }, { description: q }, { vendor: { name: q } }] } : {}),
    ...(status ? { status: status as Prisma.EnumERPAPStatusFilter['equals'] } : {}),
  }

  const [bills, aggregate, vendors, overdue] = await Promise.all([
    prisma.eRPAPBill.findMany({
      where,
      include: { vendor: true, payments: { where: { isDeleted: false }, orderBy: { paidAt: 'desc' } } },
      orderBy: { dueDate: 'asc' },
      take: 80,
    }),
    prisma.eRPAPBill.aggregate({
      where: { workspaceId, isDeleted: false, status: { in: ['PENDING', 'APPROVED', 'OVERDUE'] } },
      _sum: { amount: true, amountPaid: true },
      _count: true,
    }),
    prisma.eRPVendor.findMany({
      where: { workspaceId, isDeleted: false, isActive: true },
      orderBy: { name: 'asc' },
      take: 100,
      select: { id: true, name: true, email: true },
    }),
    prisma.eRPAPBill.count({ where: { workspaceId, isDeleted: false, status: 'OVERDUE' } }),
  ])

  const total = aggregate._sum.amount ?? 0
  const paid = aggregate._sum.amountPaid ?? 0

  return makePayload({
    module,
    metrics: [
      { label: 'Payables exposure', value: total - paid, format: 'money', tone: total > paid ? 'warning' : 'good' },
      { label: 'Paid', value: paid, format: 'money', tone: 'good' },
      { label: 'Open bills', value: aggregate._count, format: 'number', tone: 'neutral' },
      { label: 'Overdue', value: overdue, format: 'number', tone: overdue > 0 ? 'critical' : 'good' },
    ],
    rows: bills.map((bill) => ({
      id: bill.id,
      vendorName: bill.vendor.name,
      billNumber: bill.billNumber,
      dueDate: bill.dueDate,
      status: bill.status,
      amount: bill.amount,
      amountPaid: bill.amountPaid,
      balance: bill.amount - bill.amountPaid,
      currency: bill.currency,
      description: bill.description,
    })),
    secondaryRows: vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      email: vendor.email,
    })),
    options: { vendors: vendorsToOptions(vendors) },
    insights: [
      overdue > 0 ? `${overdue} vendor bills are overdue.` : 'No vendor bills are overdue.',
      total > paid ? 'Open bills feed cash forecasting and AP risk metrics.' : 'No payable exposure is currently open.',
    ],
  })
}

async function listBudgets(workspaceId: string, module: ErpModuleName, query: QueryInput): Promise<ModulePayload> {
  const q = qContains(query.q)
  const status = query.status?.trim().toUpperCase()
  const [budgets, accounts] = await Promise.all([
    prisma.eRPBudget.findMany({
      where: {
        workspaceId,
        isDeleted: false,
        ...(q ? { name: q } : {}),
        ...(status ? { status: status as Prisma.EnumERPBudgetStatusFilter['equals'] } : {}),
      },
      include: { lines: { where: { isDeleted: false }, take: 12 } },
      orderBy: { startDate: 'desc' },
      take: 50,
    }),
    prisma.eRPAccount.findMany({
      where: { workspaceId, isDeleted: false, isActive: true },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, type: true },
    }),
  ])

  const totalBudget = budgets.flatMap((budget) => budget.lines).reduce((sum, line) => sum + line.budgetAmount, 0)
  const actual = budgets.flatMap((budget) => budget.lines).reduce((sum, line) => sum + line.actualAmount, 0)
  const activeCount = budgets.filter((budget) => budget.status === 'ACTIVE').length

  return makePayload({
    module,
    metrics: [
      { label: 'Budgeted', value: totalBudget, format: 'money', tone: 'neutral' },
      { label: 'Actual', value: actual, format: 'money', tone: actual > totalBudget ? 'critical' : 'good' },
      { label: 'Variance', value: totalBudget - actual, format: 'money', tone: actual > totalBudget ? 'critical' : 'good' },
      { label: 'Active budgets', value: activeCount, format: 'number', tone: activeCount > 0 ? 'good' : 'warning' },
    ],
    rows: budgets.map((budget) => ({
      id: budget.id,
      name: budget.name,
      status: budget.status,
      startDate: budget.startDate,
      endDate: budget.endDate,
      amount: budget.lines.reduce((sum, line) => sum + line.budgetAmount, 0),
      actual: budget.lines.reduce((sum, line) => sum + line.actualAmount, 0),
      currency: budget.currency,
    })),
    options: {
      accounts: accounts.map((account) => ({
        value: account.code,
        label: `${account.code} - ${account.name}`,
        meta: account.type,
      })),
    },
    insights: [
      actual > totalBudget ? 'Actual spend is above budget. Review expense accounts and approval thresholds.' : 'Budget spend is currently within plan.',
      activeCount === 0 ? 'Activate a budget to enable variance monitoring.' : 'Active budgets are included in ERP alerting.',
    ],
  })
}

async function listProcurement(workspaceId: string, module: ErpModuleName, query: QueryInput): Promise<ModulePayload> {
  const q = qContains(query.q)
  const status = query.status?.trim().toUpperCase()
  const [orders, vendors] = await Promise.all([
    prisma.eRPPurchaseOrder.findMany({
      where: {
        workspaceId,
        isDeleted: false,
        ...(q ? { OR: [{ poNumber: q }, { vendorName: q }, { notes: q }] } : {}),
        ...(status ? { status: status as Prisma.EnumERPPOStatusFilter['equals'] } : {}),
      },
      include: { lines: { where: { isDeleted: false } } },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    prisma.eRPVendor.findMany({
      where: { workspaceId, isDeleted: false, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true },
      take: 100,
    }),
  ])

  const openTotal = orders
    .filter((order) => !['CLOSED', 'CANCELLED', 'FULLY_RECEIVED'].includes(order.status))
    .reduce((sum, order) => sum + order.totalAmount, 0)
  const awaitingApproval = orders.filter((order) => order.status === 'SUBMITTED').length
  const received = orders.filter((order) => order.status === 'FULLY_RECEIVED' || order.status === 'CLOSED').length

  return makePayload({
    module,
    metrics: [
      { label: 'Open purchase value', value: openTotal, format: 'money', tone: openTotal > 0 ? 'warning' : 'good' },
      { label: 'Awaiting approval', value: awaitingApproval, format: 'number', tone: awaitingApproval > 0 ? 'warning' : 'good' },
      { label: 'Received orders', value: received, format: 'number', tone: 'good' },
      { label: 'Vendors', value: vendors.length, format: 'number', tone: 'neutral' },
    ],
    rows: orders.map((order) => ({
      id: order.id,
      poNumber: order.poNumber,
      vendorName: order.vendorName,
      status: order.status,
      totalAmount: order.totalAmount,
      currency: order.currency,
      expectedDate: order.expectedDate,
      requestedBy: order.requestedBy,
      lines: order.lines.map((line) => line.description).join(', '),
    })),
    options: { vendors: vendorsToOptions(vendors) },
    insights: [
      awaitingApproval > 0 ? `${awaitingApproval} purchase orders are waiting for approval.` : 'No purchase orders are blocked on approval.',
      openTotal > 0 ? 'Open procurement commitments are included in operational cash planning.' : 'No open procurement commitments.',
    ],
  })
}

async function listInventory(workspaceId: string, module: ErpModuleName, query: QueryInput): Promise<ModulePayload> {
  const q = qContains(query.q)
  const [items, assets] = await Promise.all([
    prisma.eRPInventoryItem.findMany({
      where: {
        workspaceId,
        isDeleted: false,
        ...(q ? { OR: [{ sku: q }, { name: q }, { category: q }] } : {}),
      },
      include: { movements: { where: { isDeleted: false }, orderBy: { movedAt: 'desc' }, take: 3 } },
      orderBy: { name: 'asc' },
      take: 100,
    }),
    prisma.eRPFixedAsset.findMany({
      where: { workspaceId, isDeleted: false },
      orderBy: { purchaseDate: 'desc' },
      take: 50,
    }),
  ])

  const inventoryValue = items.reduce((sum, item) => sum + item.currentStock * item.unitCost, 0)
  const lowStock = items.filter((item) => item.currentStock <= item.reorderPoint).length
  const assetValue = assets.reduce((sum, asset) => sum + asset.currentBookValue, 0)

  return makePayload({
    module,
    metrics: [
      { label: 'Inventory value', value: inventoryValue, format: 'money', tone: 'neutral' },
      { label: 'Low stock SKUs', value: lowStock, format: 'number', tone: lowStock > 0 ? 'critical' : 'good' },
      { label: 'Tracked assets', value: assets.length, format: 'number', tone: 'neutral' },
      { label: 'Asset book value', value: assetValue, format: 'money', tone: 'neutral' },
    ],
    rows: items.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      currentStock: item.currentStock,
      reorderPoint: item.reorderPoint,
      unitCost: item.unitCost,
      inventoryValue: item.currentStock * item.unitCost,
      status: item.currentStock <= item.reorderPoint ? 'LOW_STOCK' : 'OK',
      currency: item.currency,
      lastMovement: item.movements[0]?.movedAt ?? null,
    })),
    secondaryRows: assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      category: asset.category,
      purchaseDate: asset.purchaseDate,
      currentBookValue: asset.currentBookValue,
      status: asset.isDisposed ? 'DISPOSED' : 'ACTIVE',
    })),
    insights: [
      lowStock > 0 ? `${lowStock} inventory items are at or below reorder point.` : 'Inventory reorder points are healthy.',
      assetValue > 0 ? 'Fixed asset book value is available for financial reporting.' : 'No fixed assets have been registered yet.',
    ],
  })
}

async function listHr(workspaceId: string, module: ErpModuleName, query: QueryInput): Promise<ModulePayload> {
  const q = qContains(query.q)
  const [employees, departments, payrollRuns] = await Promise.all([
    prisma.eRPEmployee.findMany({
      where: {
        workspaceId,
        isDeleted: false,
        ...(q ? { OR: [{ firstName: q }, { lastName: q }, { email: q }, { jobTitle: q }] } : {}),
      },
      include: { department: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.eRPHRDepartment.findMany({ where: { workspaceId, isDeleted: false }, orderBy: { name: 'asc' }, take: 100 }),
    prisma.eRPPayrollRun.findMany({
      where: { workspaceId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  const monthlyPayroll = employees
    .filter((employee) => employee.isActive)
    .reduce((sum, employee) => sum + employee.baseSalary, 0)
  const draftPayroll = payrollRuns.filter((run) => run.status === 'DRAFT').length

  return makePayload({
    module,
    metrics: [
      { label: 'Active employees', value: employees.filter((employee) => employee.isActive).length, format: 'number', tone: 'good' },
      { label: 'Departments', value: departments.length, format: 'number', tone: 'neutral' },
      { label: 'Monthly payroll', value: monthlyPayroll, format: 'money', tone: 'warning' },
      { label: 'Draft payroll runs', value: draftPayroll, format: 'number', tone: draftPayroll > 0 ? 'warning' : 'good' },
    ],
    rows: employees.map((employee) => ({
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      name: `${employee.firstName} ${employee.lastName}`,
      email: employee.email,
      jobTitle: employee.jobTitle,
      department: employee.department?.name ?? 'Unassigned',
      startDate: employee.startDate,
      status: employee.isActive ? 'ACTIVE' : 'INACTIVE',
      baseSalary: employee.baseSalary,
      currency: employee.currency,
    })),
    secondaryRows: payrollRuns.map((run) => ({
      id: run.id,
      runNumber: run.runNumber,
      period: run.period,
      payDate: run.payDate,
      status: run.status,
      totalNet: run.totalNet,
      totalGross: run.totalGross,
    })),
    options: {
      departments: departments.map((department) => ({ value: department.id, label: department.name, meta: department.code ?? undefined })),
    },
    insights: [
      employees.length === 0 ? 'Add employees to enable payroll and leave workflows.' : 'Employee records are connected to payroll and leave balances.',
      draftPayroll > 0 ? `${draftPayroll} payroll runs are waiting for approval or payment.` : 'No draft payroll runs are waiting.',
    ],
  })
}

async function listLeave(workspaceId: string, module: ErpModuleName, query: QueryInput): Promise<ModulePayload> {
  const q = qContains(query.q)
  const status = query.status?.trim().toUpperCase()
  const [requests, employees] = await Promise.all([
    prisma.eRPLeaveRequest.findMany({
      where: {
        workspaceId,
        isDeleted: false,
        ...(q ? { OR: [{ reason: q }, { employee: { firstName: q } }, { employee: { lastName: q } }] } : {}),
        ...(status ? { status: status as Prisma.EnumERPLeaveStatusFilter['equals'] } : {}),
      },
      include: { employee: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.eRPEmployee.findMany({
      where: { workspaceId, isDeleted: false, isActive: true },
      orderBy: { lastName: 'asc' },
      select: { id: true, firstName: true, lastName: true, jobTitle: true },
      take: 100,
    }),
  ])

  const pending = requests.filter((request) => request.status === 'PENDING').length
  const approvedDays = requests.filter((request) => request.status === 'APPROVED').reduce((sum, request) => sum + request.days, 0)

  return makePayload({
    module,
    metrics: [
      { label: 'Pending requests', value: pending, format: 'number', tone: pending > 0 ? 'warning' : 'good' },
      { label: 'Approved leave days', value: approvedDays, format: 'number', tone: 'neutral' },
      { label: 'Employees covered', value: employees.length, format: 'number', tone: employees.length > 0 ? 'good' : 'warning' },
      { label: 'Requests', value: requests.length, format: 'number', tone: 'neutral' },
    ],
    rows: requests.map((request) => ({
      id: request.id,
      employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
      type: request.type,
      startDate: request.startDate,
      endDate: request.endDate,
      days: request.days,
      status: request.status,
      reason: request.reason,
    })),
    options: { employees: employeesToOptions(employees) },
    insights: [
      pending > 0 ? `${pending} leave requests need a manager decision.` : 'No leave requests are pending.',
      'Approved leave updates employee leave balances automatically.',
    ],
  })
}

async function listReports(workspaceId: string, module: ErpModuleName): Promise<ModulePayload> {
  const [forecast, lines, receivables, payables, budgets, alerts] = await Promise.all([
    computeCashForecast(workspaceId, 30),
    prisma.eRPJournalLine.findMany({
      where: { workspaceId, isDeleted: false, journalEntry: { status: 'POSTED', isDeleted: false } },
      include: { account: true, journalEntry: true },
      take: 1000,
    }),
    prisma.eRPARLedger.findMany({ where: { workspaceId, isDeleted: false }, take: 200 }),
    prisma.eRPAPBill.findMany({ where: { workspaceId, isDeleted: false }, take: 200 }),
    prisma.eRPBudget.findMany({ where: { workspaceId, isDeleted: false }, include: { lines: true }, take: 40 }),
    prisma.eRPAlert.count({ where: { workspaceId, isResolved: false } }),
  ])

  const revenue = lines.filter((line) => line.account.type === 'REVENUE').reduce((sum, line) => sum + line.credit - line.debit, 0)
  const expenses = lines.filter((line) => line.account.type === 'EXPENSE').reduce((sum, line) => sum + line.debit - line.credit, 0)
  const assets = lines.filter((line) => line.account.type === 'ASSET').reduce((sum, line) => sum + line.debit - line.credit, 0)
  const liabilities = lines.filter((line) => line.account.type === 'LIABILITY').reduce((sum, line) => sum + line.credit - line.debit, 0)
  const arExposure = receivables.reduce((sum, item) => sum + Math.max(0, item.amount - item.amountPaid), 0)
  const apExposure = payables.reduce((sum, item) => sum + Math.max(0, item.amount - item.amountPaid), 0)
  const budgetTotal = budgets.flatMap((budget) => budget.lines).reduce((sum, line) => sum + line.budgetAmount, 0)
  const budgetActual = budgets.flatMap((budget) => budget.lines).reduce((sum, line) => sum + line.actualAmount, 0)

  return makePayload({
    module,
    metrics: [
      { label: 'Revenue', value: revenue, format: 'money', tone: revenue > 0 ? 'good' : 'neutral' },
      { label: 'Expenses', value: expenses, format: 'money', tone: expenses > revenue ? 'critical' : 'neutral' },
      { label: 'Net income', value: revenue - expenses, format: 'money', tone: revenue >= expenses ? 'good' : 'critical' },
      { label: 'Projected minimum cash', value: forecast.minBalance, format: 'money', tone: forecast.crisisDetected ? 'critical' : 'good' },
    ],
    rows: [
      { id: 'income-statement', report: 'Income statement', revenue, expenses, netIncome: revenue - expenses, status: revenue >= expenses ? 'HEALTHY' : 'LOSS' },
      { id: 'balance-sheet', report: 'Balance sheet', assets, liabilities, equity: assets - liabilities, status: assets >= liabilities ? 'BALANCED' : 'REVIEW' },
      { id: 'working-capital', report: 'Working capital', receivables: arExposure, payables: apExposure, netWorkingCapital: arExposure - apExposure, status: arExposure >= apExposure ? 'POSITIVE' : 'TIGHT' },
      { id: 'budget-variance', report: 'Budget variance', budgeted: budgetTotal, actual: budgetActual, variance: budgetTotal - budgetActual, status: budgetActual <= budgetTotal ? 'ON_PLAN' : 'OVER_BUDGET' },
    ],
    secondaryRows: forecast.projectedDays.slice(0, 14).map((day) => ({
      id: day.date,
      date: day.date,
      expected: day.expected,
      optimistic: day.optimistic,
      pessimistic: day.pessimistic,
      inflows: day.inflows,
      outflows: day.outflows,
    })),
    insights: [
      ...forecast.recommendations,
      alerts > 0 ? `${alerts} unresolved ERP alerts are affecting report confidence.` : 'No unresolved ERP alerts are affecting reports.',
    ],
  })
}

async function listSettings(workspaceId: string, module: ErpModuleName): Promise<ModulePayload> {
  const [settings, fiscalYears, periods, taxRates, progress] = await Promise.all([
    prisma.eRPSettings.findUnique({ where: { workspaceId } }),
    prisma.eRPFiscalYear.findMany({ where: { workspaceId, isDeleted: false }, orderBy: { startDate: 'desc' }, take: 10 }),
    prisma.eRPPeriod.findMany({ where: { workspaceId, isDeleted: false }, orderBy: { startDate: 'desc' }, take: 24 }),
    prisma.eRPTaxRate.findMany({ where: { workspaceId, isDeleted: false }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.eRPSetupProgress.findUnique({ where: { workspaceId } }),
  ])

  return makePayload({
    module,
    metrics: [
      { label: 'Default currency', value: settings?.defaultCurrency ?? 'USD', format: 'text', tone: 'neutral' },
      { label: 'Fiscal years', value: fiscalYears.length, format: 'number', tone: fiscalYears.length > 0 ? 'good' : 'warning' },
      { label: 'Open periods', value: periods.filter((period) => !period.isLocked).length, format: 'number', tone: 'good' },
      { label: 'Tax rates', value: taxRates.length, format: 'number', tone: 'neutral' },
    ],
    rows: taxRates.map((rate) => ({
      id: rate.id,
      name: rate.name,
      rate: rate.rate,
      appliesTo: rate.appliesTo,
      status: rate.isActive ? 'ACTIVE' : 'INACTIVE',
      createdAt: rate.createdAt,
    })),
    secondaryRows: periods.map((period) => ({
      id: period.id,
      name: period.name,
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.isLocked ? 'LOCKED' : 'OPEN',
    })),
    insights: [
      progress?.completedAt ? 'ERP workspace initialization is complete.' : 'ERP setup progress has not been completed.',
      `Accounting basis: ${settings?.accountingBasis ?? 'ACCRUAL'}.`,
    ],
  })
}

async function listRoles(workspaceId: string, module: ErpModuleName): Promise<ModulePayload> {
  const users = await prisma.user.findMany({
    where: { companyId: workspaceId, accountStatus: 'ACTIVE' },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    take: 100,
  })

  const owners = users.filter((user) => user.role === 'OWNER').length
  const managers = users.filter((user) => user.role === 'MANAGER').length
  const employees = users.filter((user) => user.role === 'EMPLOYEE').length

  return makePayload({
    module,
    metrics: [
      { label: 'Owners', value: owners, format: 'number', tone: owners > 0 ? 'good' : 'critical' },
      { label: 'Managers', value: managers, format: 'number', tone: managers > 0 ? 'good' : 'warning' },
      { label: 'Employees', value: employees, format: 'number', tone: 'neutral' },
      { label: 'Active users', value: users.length, format: 'number', tone: 'neutral' },
    ],
    rows: users.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.role,
      createdAt: member.createdAt,
    })),
    insights: [
      'Owners can manage roles, settings, finance, procurement, HR, and AI workflows.',
      'Managers can operate ERP modules but cannot change owner permissions.',
    ],
  })
}

export async function createErpModuleRecord(user: SessionUser, rawModule: string, input: unknown) {
  const module = erpModuleNameSchema.parse(rawModule)
  requireManager(user)
  const workspaceId = workspaceIdFor(user)
  await ensureReady(workspaceId)

  switch (module) {
    case 'general-ledger':
      return createJournalRecord(user, input)
    case 'accounts-receivable':
      return createReceivableRecord(user, input)
    case 'accounts-payable':
      return createPayableRecord(user, input)
    case 'budgets':
      return createBudgetRecord(user, input)
    case 'procurement':
      return createPurchaseOrderRecord(user, input)
    case 'inventory':
      return createInventoryRecord(user, input)
    case 'hr':
      return createEmployeeRecord(user, input)
    case 'leave':
      return createLeaveRecord(user, input)
    case 'settings':
      return createTaxRateRecord(user, input)
    default:
      throw badRequest(`Create is not available for ${module}.`)
  }
}

async function createJournalRecord(user: SessionUser, input: unknown) {
  const workspaceId = workspaceIdFor(user)
  const parsed = createErpJournalEntrySchema.parse(input)
  const amountCents = toCents(parsed.amount)

  return prisma.$transaction(
    async (tx) => {
      const currency = parsed.currency ?? (await defaultCurrency(tx, workspaceId))
      return createSimpleJournal(tx, user, {
        date: toDate(parsed.date),
        description: parsed.description,
        reference: parsed.reference || null,
        debitAccountId: parsed.debitAccountId,
        creditAccountId: parsed.creditAccountId,
        amountCents,
        currency,
        sourceType: 'MANUAL',
        sourceId: 'manual-entry',
        postNow: parsed.postNow,
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 }
  )
}

async function createReceivableRecord(user: SessionUser, input: unknown) {
  const workspaceId = workspaceIdFor(user)
  const parsed = createErpReceivableSchema.parse(input)
  const amount = toCents(parsed.amount)
  const dueDate = toDate(parsed.dueDate)

  return prisma.$transaction(async (tx) => {
    const currency = parsed.currency ?? (await defaultCurrency(tx, workspaceId))
    const receivable = await tx.eRPARLedger.create({
      data: {
        workspaceId,
        clientId: parsed.clientId || undefined,
        clientName: parsed.clientName,
        clientEmail: parsed.clientEmail || undefined,
        invoiceRef: parsed.invoiceRef || undefined,
        amount,
        currency,
        dueDate,
        status: isPastDue(dueDate) ? 'OVERDUE' : 'OPEN',
      },
    })
    if (receivable.status === 'OVERDUE') {
      await createWorkflowAlert(tx, workspaceId, {
        type: 'OVERDUE_AR',
        severity: 'WARNING',
        title: 'Receivable created overdue',
        description: `${parsed.clientName} has an overdue receivable for ${(amount / 100).toFixed(2)} ${currency}.`,
        entityType: 'ERPARLedger',
        entityId: receivable.id,
      })
    }
    await recordOperationalEvent(tx, user, 'erp.receivable.created', 'ERPARLedger', receivable.id, {
      clientName: parsed.clientName,
      amount,
      dueDate: dueDate.toISOString(),
    })
    return receivable
  })
}

async function findOrCreateVendor(tx: TransactionClient, workspaceId: string, input: { vendorId?: string; vendorName: string; vendorEmail?: string; vendorPhone?: string; currency: string }) {
  if (input.vendorId) {
    const vendor = await tx.eRPVendor.findFirst({ where: { id: input.vendorId, workspaceId, isDeleted: false } })
    if (!vendor) throw badRequest('Selected vendor was not found in this workspace.')
    return vendor
  }

  const existing = await tx.eRPVendor.findFirst({
    where: { workspaceId, isDeleted: false, name: { equals: input.vendorName, mode: Prisma.QueryMode.insensitive } },
  })
  if (existing) return existing

  return tx.eRPVendor.create({
    data: {
      workspaceId,
      name: input.vendorName,
      email: input.vendorEmail || undefined,
      phone: input.vendorPhone || undefined,
      currency: input.currency,
    },
  })
}

async function createPayableRecord(user: SessionUser, input: unknown) {
  const workspaceId = workspaceIdFor(user)
  const parsed = createErpPayableSchema.parse(input)
  const amount = toCents(parsed.amount)
  const issueDate = toDate(parsed.issueDate)
  const dueDate = toDate(parsed.dueDate)

  return prisma.$transaction(async (tx) => {
    const currency = parsed.currency ?? (await defaultCurrency(tx, workspaceId))
    const vendor = await findOrCreateVendor(tx, workspaceId, {
      vendorId: parsed.vendorId || undefined,
      vendorName: parsed.vendorName,
      vendorEmail: parsed.vendorEmail || undefined,
      vendorPhone: parsed.vendorPhone || undefined,
      currency,
    })

    const bill = await tx.eRPAPBill.create({
      data: {
        workspaceId,
        vendorId: vendor.id,
        billNumber: parsed.billNumber,
        amount,
        currency,
        issueDate,
        dueDate,
        description: parsed.description || undefined,
        status: isPastDue(dueDate) ? 'OVERDUE' : 'PENDING',
      },
    })
    await recordOperationalEvent(tx, user, 'erp.payable.created', 'ERPAPBill', bill.id, {
      vendorName: vendor.name,
      amount,
      dueDate: dueDate.toISOString(),
    })
    return bill
  })
}

async function createBudgetRecord(user: SessionUser, input: unknown) {
  const workspaceId = workspaceIdFor(user)
  const parsed = createErpBudgetSchema.parse(input)
  const monthlyAmount = toCents(parsed.monthlyAmount)
  const startDate = toDate(parsed.startDate)
  const endDate = toDate(parsed.endDate)

  if (endDate < startDate) throw badRequest('Budget end date must be after the start date.')

  return prisma.$transaction(async (tx) => {
    const currency = parsed.currency ?? (await defaultCurrency(tx, workspaceId))
    const fiscalYear = await tx.eRPFiscalYear.findFirst({
      where: { workspaceId, isDeleted: false, startDate: { lte: startDate }, endDate: { gte: startDate } },
      select: { id: true },
    })
    const account = await tx.eRPAccount.findFirst({
      where: { workspaceId, code: parsed.accountCode, isDeleted: false },
      select: { code: true, name: true },
    })
    const budget = await tx.eRPBudget.create({
      data: {
        workspaceId,
        name: parsed.name,
        fiscalYearId: fiscalYear?.id,
        startDate,
        endDate,
        status: parsed.status ?? 'DRAFT',
        currency,
      },
    })

    const months: Array<{ month: number; year: number }> = []
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
    while (cursor <= last && months.length < 36) {
      months.push({ month: cursor.getMonth() + 1, year: cursor.getFullYear() })
      cursor.setMonth(cursor.getMonth() + 1)
    }

    await tx.eRPBudgetLine.createMany({
      data: months.map((month) => ({
        workspaceId,
        budgetId: budget.id,
        accountCode: parsed.accountCode,
        accountName: parsed.accountName || account?.name || parsed.accountCode,
        month: month.month,
        year: month.year,
        budgetAmount: monthlyAmount,
      })),
    })

    await recordOperationalEvent(tx, user, 'erp.budget.created', 'ERPBudget', budget.id, {
      name: parsed.name,
      monthlyAmount,
      months: months.length,
    })
    return budget
  })
}

async function createPurchaseOrderRecord(user: SessionUser, input: unknown) {
  const workspaceId = workspaceIdFor(user)
  const parsed = createErpPurchaseOrderSchema.parse(input)
  const unitPrice = toCents(parsed.unitPrice)
  const totalAmount = unitPrice * parsed.quantity

  return prisma.$transaction(async (tx) => {
    const currency = parsed.currency ?? (await defaultCurrency(tx, workspaceId))
    const vendor = await findOrCreateVendor(tx, workspaceId, {
      vendorId: parsed.vendorId || undefined,
      vendorName: parsed.vendorName,
      currency,
    })
    const count = await tx.eRPPurchaseOrder.count({ where: { workspaceId } })
    const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`
    const po = await tx.eRPPurchaseOrder.create({
      data: {
        workspaceId,
        poNumber,
        vendorId: vendor.id,
        vendorName: vendor.name,
        status: 'SUBMITTED',
        totalAmount,
        currency,
        requestedBy: user.id,
        expectedDate: parsed.expectedDate ? toDate(parsed.expectedDate) : undefined,
        notes: parsed.notes || undefined,
        lines: {
          create: {
            workspaceId,
            description: parsed.description,
            quantity: parsed.quantity,
            unitPrice,
            totalPrice: totalAmount,
            unit: parsed.unit || undefined,
          },
        },
      },
    })
    await recordOperationalEvent(tx, user, 'erp.purchase_order.created', 'ERPPurchaseOrder', po.id, {
      poNumber,
      vendorName: vendor.name,
      totalAmount,
    })
    return po
  })
}

async function createInventoryRecord(user: SessionUser, input: unknown) {
  const workspaceId = workspaceIdFor(user)
  const parsed = createErpInventoryItemSchema.parse(input)

  return prisma.$transaction(async (tx) => {
    const currency = parsed.currency ?? (await defaultCurrency(tx, workspaceId))
    const item = await tx.eRPInventoryItem.create({
      data: {
        workspaceId,
        sku: parsed.sku,
        name: parsed.name,
        category: parsed.category || undefined,
        unit: parsed.unit,
        currentStock: parsed.currentStock,
        reorderPoint: parsed.reorderPoint,
        reorderQty: parsed.reorderQty,
        unitCost: toCents(parsed.unitCost),
        currency,
      },
    })
    if (parsed.currentStock > 0) {
      await tx.eRPInventoryMovement.create({
        data: {
          workspaceId,
          itemId: item.id,
          type: 'ADJUSTMENT',
          quantity: parsed.currentStock,
          unitCost: item.unitCost,
          reference: 'Opening balance',
        },
      })
    }
    await recordOperationalEvent(tx, user, 'erp.inventory_item.created', 'ERPInventoryItem', item.id, {
      sku: parsed.sku,
      currentStock: parsed.currentStock,
    })
    return item
  })
}

async function createEmployeeRecord(user: SessionUser, input: unknown) {
  const workspaceId = workspaceIdFor(user)
  const parsed = createErpEmployeeSchema.parse(input)

  return prisma.$transaction(async (tx) => {
    const currency = parsed.currency ?? (await defaultCurrency(tx, workspaceId))
    if (parsed.departmentId) {
      const department = await tx.eRPHRDepartment.findFirst({
        where: { id: parsed.departmentId, workspaceId, isDeleted: false },
        select: { id: true },
      })
      if (!department) throw badRequest('Selected department was not found in this workspace.')
    }

    const employee = await tx.eRPEmployee.create({
      data: {
        workspaceId,
        employeeNumber: parsed.employeeNumber,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        email: parsed.email,
        phone: parsed.phone || undefined,
        jobTitle: parsed.jobTitle,
        departmentId: parsed.departmentId || undefined,
        startDate: toDate(parsed.startDate),
        contractType: parsed.contractType,
        baseSalary: toCents(parsed.baseSalary),
        currency,
        payFrequency: parsed.payFrequency,
      },
    })

    const year = new Date().getFullYear()
    await tx.eRPLeaveBalance.createMany({
      data: [
        { workspaceId, employeeId: employee.id, year, type: 'ANNUAL', entitled: 20, remaining: 20 },
        { workspaceId, employeeId: employee.id, year, type: 'SICK', entitled: 10, remaining: 10 },
      ],
      skipDuplicates: true,
    })

    await recordOperationalEvent(tx, user, 'erp.employee.created', 'ERPEmployee', employee.id, {
      employeeNumber: parsed.employeeNumber,
      name: `${parsed.firstName} ${parsed.lastName}`,
    })
    return employee
  })
}

async function createLeaveRecord(user: SessionUser, input: unknown) {
  const workspaceId = workspaceIdFor(user)
  const parsed = createErpLeaveRequestSchema.parse(input)
  const startDate = toDate(parsed.startDate)
  const endDate = toDate(parsed.endDate)
  if (endDate < startDate) throw badRequest('Leave end date must be after start date.')

  return prisma.$transaction(async (tx) => {
    const employee = await tx.eRPEmployee.findFirst({
      where: { id: parsed.employeeId, workspaceId, isDeleted: false, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    })
    if (!employee) throw badRequest('Selected employee was not found in this workspace.')

    const request = await tx.eRPLeaveRequest.create({
      data: {
        workspaceId,
        employeeId: employee.id,
        type: parsed.type,
        startDate,
        endDate,
        days: daysInclusive(startDate, endDate),
        reason: parsed.reason || undefined,
      },
    })
    await recordOperationalEvent(tx, user, 'erp.leave_request.created', 'ERPLeaveRequest', request.id, {
      employeeName: `${employee.firstName} ${employee.lastName}`,
      type: parsed.type,
      days: request.days,
    })
    return request
  })
}

async function createTaxRateRecord(user: SessionUser, input: unknown) {
  const workspaceId = workspaceIdFor(user)
  const parsed = createErpTaxRateSchema.parse(input)

  return prisma.$transaction(async (tx) => {
    const taxRate = await tx.eRPTaxRate.create({
      data: {
        workspaceId,
        name: parsed.name,
        rate: parsed.rate,
        appliesTo: parsed.appliesTo,
      },
    })
    await recordOperationalEvent(tx, user, 'erp.tax_rate.created', 'ERPTaxRate', taxRate.id, {
      name: parsed.name,
      rate: parsed.rate,
      appliesTo: parsed.appliesTo,
    })
    return taxRate
  })
}

export async function patchErpModuleRecord(user: SessionUser, rawModule: string, input: unknown) {
  const module = erpModuleNameSchema.parse(rawModule)
  const parsed = erpGenericModulePatchSchema.parse(input)
  const workspaceId = workspaceIdFor(user)

  if (module === 'roles') requireOwner(user)
  else requireManager(user)

  await ensureReady(workspaceId)

  switch (module) {
    case 'general-ledger':
      return postJournalRecord(user, parsed.id)
    case 'accounts-receivable':
      return applyReceivableAction(user, parsed)
    case 'accounts-payable':
      return applyPayableAction(user, parsed)
    case 'budgets':
      return applyBudgetAction(user, parsed)
    case 'procurement':
      return applyPurchaseOrderAction(user, parsed)
    case 'inventory':
      return applyInventoryAction(user, parsed)
    case 'hr':
      return applyHrAction(user, parsed)
    case 'leave':
      return applyLeaveAction(user, parsed)
    case 'settings':
      return applySettingsAction(user, input)
    case 'roles':
      return applyRoleAction(user, parsed)
    default:
      throw badRequest(`Update is not available for ${module}.`)
  }
}

async function postJournalRecord(user: SessionUser, id: string) {
  const workspaceId = workspaceIdFor(user)
  return prisma.$transaction(async (tx) => {
    const entry = await tx.eRPJournalEntry.findFirst({
      where: { id, workspaceId, isDeleted: false },
      include: { lines: true },
    })
    if (!entry) throw notFound()
    if (entry.status !== 'DRAFT') return entry

    await postBalances(tx, workspaceId, entry.lines, entry.date)
    const updated = await tx.eRPJournalEntry.update({
      where: { id },
      data: { status: 'POSTED', approvedById: user.id, approvedAt: new Date() },
    })
    await recordOperationalEvent(tx, user, 'erp.journal_entry.posted', 'ERPJournalEntry', id, {
      entryNumber: entry.entryNumber,
    })
    return updated
  })
}

async function applyReceivableAction(user: SessionUser, input: Record<string, unknown>) {
  const workspaceId = workspaceIdFor(user)
  if (input.action !== 'record-payment') throw badRequest('Unsupported receivable action.')
  const paymentAmount = toCents(input.amount)
  if (paymentAmount <= 0) throw badRequest('Payment amount must be greater than zero.')

  return prisma.$transaction(async (tx) => {
    const receivable = await tx.eRPARLedger.findFirst({ where: { id: input.id as string, workspaceId, isDeleted: false } })
    if (!receivable) throw notFound()
    const remaining = receivable.amount - receivable.amountPaid
    const amount = Math.min(paymentAmount, remaining)
    const nextPaid = receivable.amountPaid + amount
    const status = nextPaid >= receivable.amount ? 'PAID' : 'PARTIAL'
    const payment = await tx.eRPARPayment.create({
      data: {
        workspaceId,
        arLedgerId: receivable.id,
        amount,
        currency: receivable.currency,
        method: String(input.method ?? 'bank'),
        reference: typeof input.reference === 'string' ? input.reference : undefined,
        paidAt: new Date(),
      },
    })
    const updated = await tx.eRPARLedger.update({
      where: { id: receivable.id },
      data: { amountPaid: nextPaid, status },
    })
    await recordOperationalEvent(tx, user, 'erp.receivable.payment_recorded', 'ERPARLedger', receivable.id, {
      amount,
      paymentId: payment.id,
      status,
    })
    return updated
  })
}

async function applyPayableAction(user: SessionUser, input: Record<string, unknown>) {
  const workspaceId = workspaceIdFor(user)

  return prisma.$transaction(async (tx) => {
    const bill = await tx.eRPAPBill.findFirst({ where: { id: input.id as string, workspaceId, isDeleted: false }, include: { vendor: true } })
    if (!bill) throw notFound()

    if (input.action === 'approve') {
      const updated = await tx.eRPAPBill.update({ where: { id: bill.id }, data: { status: 'APPROVED' } })
      await recordOperationalEvent(tx, user, 'erp.payable.approved', 'ERPAPBill', bill.id, { billNumber: bill.billNumber })
      return updated
    }

    if (input.action === 'pay') {
      const amount = Math.min(toCents(input.amount) || bill.amount - bill.amountPaid, bill.amount - bill.amountPaid)
      if (amount <= 0) throw badRequest('No unpaid amount remains on this bill.')
      const payment = await tx.eRPAPPayment.create({
        data: {
          workspaceId,
          billId: bill.id,
          amount,
          currency: bill.currency,
          method: String(input.method ?? 'bank'),
          reference: typeof input.reference === 'string' ? input.reference : undefined,
          paidAt: new Date(),
        },
      })
      const nextPaid = bill.amountPaid + amount
      const updated = await tx.eRPAPBill.update({
        where: { id: bill.id },
        data: { amountPaid: nextPaid, status: nextPaid >= bill.amount ? 'PAID' : 'APPROVED' },
      })
      await recordOperationalEvent(tx, user, 'erp.payable.payment_recorded', 'ERPAPBill', bill.id, {
        amount,
        paymentId: payment.id,
      })
      return updated
    }

    throw badRequest('Unsupported payable action.')
  })
}

async function applyBudgetAction(user: SessionUser, input: Record<string, unknown>) {
  const workspaceId = workspaceIdFor(user)
  if (!['approve', 'activate', 'close'].includes(String(input.action))) throw badRequest('Unsupported budget action.')
  const status = input.action === 'approve' ? 'APPROVED' : input.action === 'activate' ? 'ACTIVE' : 'CLOSED'
  const budget = await prisma.eRPBudget.findFirst({ where: { id: input.id as string, workspaceId, isDeleted: false } })
  if (!budget) throw notFound()
  const updated = await prisma.eRPBudget.update({ where: { id: budget.id }, data: { status } })
  await prisma.activity.create({
    data: { companyId: workspaceId, userId: user.id, source: 'erp', action: `erp.budget.${String(input.action)}`, entityType: 'ERPBudget', entityId: budget.id },
  })
  return updated
}

async function applyPurchaseOrderAction(user: SessionUser, input: Record<string, unknown>) {
  const workspaceId = workspaceIdFor(user)
  return prisma.$transaction(async (tx) => {
    const order = await tx.eRPPurchaseOrder.findFirst({ where: { id: input.id as string, workspaceId, isDeleted: false }, include: { lines: true } })
    if (!order) throw notFound()

    if (input.action === 'approve') {
      const updated = await tx.eRPPurchaseOrder.update({
        where: { id: order.id },
        data: { status: 'APPROVED', approvedBy: user.id, approvedAt: new Date() },
      })
      await recordOperationalEvent(tx, user, 'erp.purchase_order.approved', 'ERPPurchaseOrder', order.id, { poNumber: order.poNumber })
      return updated
    }

    if (input.action === 'receive') {
      await Promise.all(
        order.lines.map((line) =>
          tx.eRPPOLine.update({
            where: { id: line.id },
            data: { receivedQty: line.quantity },
          })
        )
      )
      const updated = await tx.eRPPurchaseOrder.update({ where: { id: order.id }, data: { status: 'FULLY_RECEIVED' } })
      await recordOperationalEvent(tx, user, 'erp.purchase_order.received', 'ERPPurchaseOrder', order.id, { poNumber: order.poNumber })
      return updated
    }

    throw badRequest('Unsupported purchase order action.')
  })
}

async function applyInventoryAction(user: SessionUser, input: Record<string, unknown>) {
  const workspaceId = workspaceIdFor(user)
  if (input.action !== 'adjust-stock') throw badRequest('Unsupported inventory action.')
  const quantity = Number(input.quantity)
  if (!Number.isFinite(quantity) || quantity === 0) throw badRequest('Stock adjustment quantity cannot be zero.')

  return prisma.$transaction(async (tx) => {
    const item = await tx.eRPInventoryItem.findFirst({ where: { id: input.id as string, workspaceId, isDeleted: false } })
    if (!item) throw notFound()
    await tx.eRPInventoryMovement.create({
      data: {
        workspaceId,
        itemId: item.id,
        type: quantity > 0 ? 'PURCHASE' : 'ADJUSTMENT',
        quantity,
        unitCost: item.unitCost,
        reference: typeof input.reference === 'string' ? input.reference : 'Manual adjustment',
      },
    })
    const updated = await tx.eRPInventoryItem.update({
      where: { id: item.id },
      data: { currentStock: { increment: quantity } },
    })
    await recordOperationalEvent(tx, user, 'erp.inventory.stock_adjusted', 'ERPInventoryItem', item.id, {
      sku: item.sku,
      quantity,
    })
    return updated
  })
}

async function applyHrAction(user: SessionUser, input: Record<string, unknown>) {
  const workspaceId = workspaceIdFor(user)

  if (input.action === 'generate-payroll') {
    return prisma.$transaction(async (tx) => {
      const employees = await tx.eRPEmployee.findMany({ where: { workspaceId, isDeleted: false, isActive: true } })
      if (employees.length === 0) throw badRequest('At least one active employee is required to generate payroll.')
      const now = new Date()
      const count = await tx.eRPPayrollRun.count({ where: { workspaceId } })
      const runNumber = `PAY-${now.getFullYear()}-${String(count + 1).padStart(5, '0')}`
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      const totalGross = employees.reduce((sum, employee) => sum + employee.baseSalary, 0)
      const totalTax = Math.round(totalGross * 0.12)
      const totalNet = totalGross - totalTax
      const run = await tx.eRPPayrollRun.create({
        data: {
          workspaceId,
          runNumber,
          period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
          startDate,
          endDate,
          payDate: new Date(now.getFullYear(), now.getMonth() + 1, 5),
          status: 'DRAFT',
          totalGross,
          totalTax,
          totalNet,
          lines: {
            create: employees.map((employee) => {
              const taxAmount = Math.round(employee.baseSalary * 0.12)
              return {
                workspaceId,
                employeeId: employee.id,
                baseSalary: employee.baseSalary,
                taxAmount,
                netPay: employee.baseSalary - taxAmount,
                currency: employee.currency,
              }
            }),
          },
        },
      })
      await recordOperationalEvent(tx, user, 'erp.payroll.generated', 'ERPPayrollRun', run.id, {
        runNumber,
        employees: employees.length,
        totalNet,
      })
      return run
    })
  }

  if (input.action === 'toggle-active') {
    const employee = await prisma.eRPEmployee.findFirst({ where: { id: input.id as string, workspaceId, isDeleted: false } })
    if (!employee) throw notFound()
    return prisma.eRPEmployee.update({ where: { id: employee.id }, data: { isActive: !employee.isActive } })
  }

  throw badRequest('Unsupported HR action.')
}

async function applyLeaveAction(user: SessionUser, input: Record<string, unknown>) {
  const workspaceId = workspaceIdFor(user)
  if (!['approve', 'reject'].includes(String(input.action))) throw badRequest('Unsupported leave action.')

  return prisma.$transaction(async (tx) => {
    const request = await tx.eRPLeaveRequest.findFirst({ where: { id: input.id as string, workspaceId, isDeleted: false }, include: { employee: true } })
    if (!request) throw notFound()
    if (request.status !== 'PENDING') return request
    const nextStatus = input.action === 'approve' ? 'APPROVED' : 'REJECTED'
    if (nextStatus === 'APPROVED') {
      const year = request.startDate.getFullYear()
      const balance = await tx.eRPLeaveBalance.findUnique({
        where: { workspaceId_employeeId_year_type: { workspaceId, employeeId: request.employeeId, year, type: request.type } },
      })
      if (balance && balance.remaining < request.days) {
        throw badRequest('Leave balance is not sufficient for this request.')
      }
      if (balance) {
        await tx.eRPLeaveBalance.update({
          where: { id: balance.id },
          data: { used: { increment: request.days }, remaining: { decrement: request.days } },
        })
      }
    }
    const updated = await tx.eRPLeaveRequest.update({
      where: { id: request.id },
      data: { status: nextStatus, approvedById: user.id, approvedAt: new Date() },
    })
    await recordOperationalEvent(tx, user, `erp.leave_request.${String(input.action)}`, 'ERPLeaveRequest', request.id, {
      employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
      days: request.days,
      status: nextStatus,
    })
    return updated
  })
}

async function applySettingsAction(user: SessionUser, input: unknown) {
  const workspaceId = workspaceIdFor(user)
  const parsed = updateErpSettingsSchema.parse(input)
  const updated = await prisma.eRPSettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      defaultCurrency: parsed.defaultCurrency,
      accountingBasis: parsed.accountingBasis,
      fiscalYearStartMonth: parsed.fiscalYearStartMonth,
      taxName: parsed.taxName,
      taxRate: parsed.taxRate,
    },
    update: {
      defaultCurrency: parsed.defaultCurrency,
      accountingBasis: parsed.accountingBasis,
      fiscalYearStartMonth: parsed.fiscalYearStartMonth,
      taxName: parsed.taxName,
      taxRate: parsed.taxRate,
    },
  })
  await prisma.auditLog.create({
    data: {
      companyId: workspaceId,
      actorId: user.id,
      action: 'erp.settings.updated',
      entityType: 'ERPSettings',
      entityId: updated.id,
      after: parsed,
      metadata: { surface: 'erp' },
    },
  })
  return updated
}

async function applyRoleAction(user: SessionUser, input: Record<string, unknown>) {
  const workspaceId = workspaceIdFor(user)
  const role = String(input.role ?? '').toUpperCase()
  if (!['OWNER', 'MANAGER', 'EMPLOYEE'].includes(role)) throw badRequest('Invalid role.')
  const target = await prisma.user.findFirst({ where: { id: input.id as string, companyId: workspaceId } })
  if (!target) throw notFound()
  const updated = await prisma.user.update({ where: { id: target.id }, data: { role } })
  await prisma.auditLog.create({
    data: {
      companyId: workspaceId,
      actorId: user.id,
      action: 'erp.role.updated',
      entityType: 'User',
      entityId: target.id,
      before: { role: target.role },
      after: { role },
      metadata: { surface: 'erp' },
    },
  })
  return updated
}
