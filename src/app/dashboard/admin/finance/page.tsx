'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Banknote,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  Landmark,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import { useLocale } from '@/components/i18n/LocaleProvider'

type ApiList<T> = {
  items?: T[]
  pagination?: {
    total?: number
    page?: number
    pageSize?: number
    pageCount?: number
  }
}

type MoneyLike = string | number | null | undefined

type CfoBrief = {
  generatedAt: string
  model: string
  summary: string[]
  overdueInvoices: Array<{
    invoiceNumber: string
    clientName: string
    total: string
    dueDate: string | null
  }>
}

type ApprovalFlow = {
  id: string
  entityType: string
  entityId: string
  flowType: string
  status: string
  summary?: string | null
  createdAt: string
  escalatesAt?: string | null
  steps: Array<{
    id: string
    status: string
    sortOrder: number
    dueAt?: string | null
    assignedTo?: { name: string; email: string } | null
  }>
}

type Expense = {
  id: string
  title: string
  status: string
  total: string
  currency: string
  expenseDate: string
  vendor?: { name: string } | null
  project?: { title: string } | null
  client?: { companyName: string } | null
}

type PayrollRun = {
  id: string
  status: string
  currency: string
  grossPay: string
  netPay: string
  periodStart: string
  periodEnd: string
  items: Array<{ id: string; amount: string; itemType: string }>
}

type TreasuryAccount = {
  id: string
  name: string
  type: string
  currency: string
  currentBalance: string
  openingBalance: string
  ledgerAccount?: { code: string; name: string } | null
}

type TreasuryTransaction = {
  id: string
  status: string
  direction: string
  amount: string
  currency: string
  scheduledFor?: string | null
  memo?: string | null
  fromAccount?: { name: string } | null
  toAccount?: { name: string } | null
}

type JournalEntry = {
  id: string
  entryNumber: string
  status: string
  sourceType: string
  totalDebit: string
  totalCredit: string
  currency: string
  transactionDate: string
}

type Account = {
  id: string
  code: string
  name: string
  type: string
  status: string
  normalBalance: string
}

type FinanceTab = 'command' | 'approvals' | 'expenses' | 'payroll' | 'treasury' | 'ledger'

const tabs: Array<{ id: FinanceTab; label: string }> = [
  { id: 'command', label: 'Command' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'treasury', label: 'Treasury' },
  { id: 'ledger', label: 'Ledger' },
]

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || 'Finance data could not be loaded.')
  return body as T
}

function decimal(value: MoneyLike) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

function localeForDate(locale: string) {
  if (locale === 'fr') return 'fr-FR'
  if (locale === 'ar') return 'ar'
  return 'en-US'
}

function formatMoney(value: MoneyLike, currency = 'USD', locale = 'en') {
  const amount = decimal(value)
  try {
    return new Intl.NumberFormat(localeForDate(locale), {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency || 'USD'} ${Math.round(amount).toLocaleString(localeForDate(locale))}`
  }
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return 'Unscheduled'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unscheduled'
  return date.toLocaleDateString(localeForDate(locale), { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusTone(status: string) {
  const normalized = status.toUpperCase()
  if (['APPROVED', 'POSTED', 'PAID', 'RECONCILED', 'ACTIVE'].includes(normalized)) return 'good'
  if (['PENDING', 'PENDING_APPROVAL', 'SUBMITTED', 'SCHEDULED', 'IN_PROGRESS'].includes(normalized)) return 'watch'
  if (['REJECTED', 'VOID', 'FAILED', 'CANCELLED', 'OVERDUE'].includes(normalized)) return 'critical'
  return 'neutral'
}

function ToneBadge({ value }: { value: string }) {
  return <span className={`taskit-tone-badge taskit-tone-${statusTone(value)}`}>{value.replaceAll('_', ' ')}</span>
}

function LoadingBlock() {
  return (
    <div className="taskit-empty-state">
      <Loader2 size={20} className="animate-spin text-[var(--accent)]" />
      <p className="taskit-body">Loading finance records</p>
    </div>
  )
}

function EmptyBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="taskit-empty-state">
      <p className="taskit-heading">{title}</p>
      <p className="taskit-body">{body}</p>
    </div>
  )
}

export default function AdminFinancePage() {
  const { locale } = useLocale()
  const [activeTab, setActiveTab] = useState<FinanceTab>('command')
  const [refreshing, setRefreshing] = useState(false)

  const cfo = useSWR<CfoBrief>('/api/finance/cfo/brief', fetchJson)
  const approvals = useSWR<ApiList<ApprovalFlow>>('/api/finance/approvals?pageSize=50', fetchJson)
  const expenses = useSWR<ApiList<Expense>>('/api/finance/expenses?pageSize=50', fetchJson)
  const payroll = useSWR<ApiList<PayrollRun>>('/api/finance/payroll?pageSize=30', fetchJson)
  const treasuryAccounts = useSWR<TreasuryAccount[]>('/api/finance/treasury/accounts', fetchJson)
  const treasuryTransactions = useSWR<ApiList<TreasuryTransaction>>('/api/finance/treasury/transactions?pageSize=30', fetchJson)
  const journals = useSWR<ApiList<JournalEntry>>('/api/finance/journal-entries?pageSize=30', fetchJson)
  const accounts = useSWR<Account[]>('/api/finance/accounts', fetchJson)

  const approvalItems = useMemo(() => approvals.data?.items ?? [], [approvals.data?.items])
  const expenseItems = useMemo(() => expenses.data?.items ?? [], [expenses.data?.items])
  const payrollItems = useMemo(() => payroll.data?.items ?? [], [payroll.data?.items])
  const treasuryAccountItems = useMemo(() => treasuryAccounts.data ?? [], [treasuryAccounts.data])
  const treasuryTransactionItems = useMemo(() => treasuryTransactions.data?.items ?? [], [treasuryTransactions.data?.items])
  const journalItems = useMemo(() => journals.data?.items ?? [], [journals.data?.items])
  const accountItems = useMemo(() => accounts.data ?? [], [accounts.data])

  const loading = [
    cfo.isLoading,
    approvals.isLoading,
    expenses.isLoading,
    payroll.isLoading,
    treasuryAccounts.isLoading,
    treasuryTransactions.isLoading,
    journals.isLoading,
    accounts.isLoading,
  ].some(Boolean)
  const loadError = [
    cfo.error,
    approvals.error,
    expenses.error,
    payroll.error,
    treasuryAccounts.error,
    treasuryTransactions.error,
    journals.error,
    accounts.error,
  ].find(Boolean)

  const metrics = useMemo(() => {
    const openApprovals = approvalItems.filter((item) => ['PENDING', 'ESCALATED'].includes(item.status)).length
    const submittedExpenses = expenseItems.filter((item) => ['SUBMITTED', 'APPROVED'].includes(item.status)).length
    const expenseExposure = expenseItems.reduce((sum, item) => sum + decimal(item.total), 0)
    const payrollExposure = payrollItems
      .filter((item) => !['POSTED', 'PAID', 'VOID'].includes(item.status))
      .reduce((sum, item) => sum + decimal(item.grossPay), 0)
    const cashBalance = treasuryAccountItems.reduce((sum, item) => sum + decimal(item.currentBalance), 0)
    const overdueReceivables = cfo.data?.overdueInvoices.reduce((sum, invoice) => sum + decimal(invoice.total), 0) ?? 0
    const postedJournals = journalItems.filter((item) => item.status === 'POSTED').length

    return {
      openApprovals,
      submittedExpenses,
      expenseExposure,
      payrollExposure,
      cashBalance,
      overdueReceivables,
      postedJournals,
    }
  }, [approvalItems, cfo.data?.overdueInvoices, expenseItems, journalItems, payrollItems, treasuryAccountItems])

  async function refreshAll() {
    setRefreshing(true)
    await Promise.all([
      cfo.mutate(),
      approvals.mutate(),
      expenses.mutate(),
      payroll.mutate(),
      treasuryAccounts.mutate(),
      treasuryTransactions.mutate(),
      journals.mutate(),
      accounts.mutate(),
    ]).finally(() => setRefreshing(false))
  }

  const primaryCurrency = treasuryAccountItems[0]?.currency || expenseItems[0]?.currency || payrollItems[0]?.currency || 'USD'

  return (
    <div className="dashboard-page" style={{ maxWidth: '1180px' }}>
      <div className="dashboard-header-row">
        <div>
          <h1 className="page-heading flex items-center gap-2.5">
            <Landmark size={26} strokeWidth={1.9} style={{ color: 'var(--accent)' }} />
            Finance
          </h1>
          <p className="page-sub">Accounting, cash, payroll, approvals, and delivery-to-cash intelligence.</p>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" onClick={refreshAll} className="btn-secondary" disabled={refreshing}>
            {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
          <Link href="/dashboard/admin/invoices" className="btn-primary">
            <ReceiptText size={16} />
            Invoices
          </Link>
        </div>
      </div>

      {loadError && (
        <div className="mb-6 rounded-lg border border-[rgba(220,38,38,0.24)] bg-[rgba(220,38,38,0.08)] p-4 text-sm font-semibold text-[var(--danger)]">
          {loadError instanceof Error ? loadError.message : 'Finance data could not be loaded.'}
        </div>
      )}

      <section className="dashboard-stat-grid">
        <article className="stat-card">
          <span className="stat-card-label">Cash position</span>
          <strong className="stat-card-value">{formatMoney(metrics.cashBalance, primaryCurrency, locale)}</strong>
          <span className="stat-card-delta">
            <WalletCards size={14} /> {treasuryAccountItems.length} treasury account{treasuryAccountItems.length === 1 ? '' : 's'}
          </span>
        </article>
        <article className="stat-card">
          <span className="stat-card-label">Open approvals</span>
          <strong className="stat-card-value">{metrics.openApprovals}</strong>
          <span className="stat-card-delta">
            <ShieldCheck size={14} /> Finance workflow queue
          </span>
        </article>
        <article className="stat-card">
          <span className="stat-card-label">Expense exposure</span>
          <strong className="stat-card-value">{formatMoney(metrics.expenseExposure, primaryCurrency, locale)}</strong>
          <span className="stat-card-delta">
            <BadgeDollarSign size={14} /> {metrics.submittedExpenses} submitted or approved
          </span>
        </article>
        <article className="stat-card">
          <span className="stat-card-label">Payroll exposure</span>
          <strong className="stat-card-value">{formatMoney(metrics.payrollExposure, primaryCurrency, locale)}</strong>
          <span className="stat-card-delta">
            <BriefcaseBusiness size={14} /> Pending payroll runs
          </span>
        </article>
      </section>

      <section className="taskit-card mb-6 taskit-critical-card">
        <div className="taskit-card-header">
          <div className="taskit-row-main">
            <span className="taskit-label">CFO Copilot</span>
            <h2 className="taskit-heading">Financial operating brief</h2>
          </div>
          <Bot size={22} aria-hidden style={{ color: 'var(--accent)' }} />
        </div>

        {cfo.isLoading ? (
          <LoadingBlock />
        ) : (
          <div className="taskit-alert-list">
            {(cfo.data?.summary ?? ['No finance signals available yet.']).map((line) => (
              <div key={line} className="taskit-alert-row">
                <div className="taskit-row-main">
                  <span className="taskit-body">{line}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`taskit-secondary-action ${activeTab === tab.id ? 'border-[var(--accent)] text-[var(--accent)]' : ''}`}
            aria-pressed={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && activeTab !== 'command' ? <LoadingBlock /> : null}

      {activeTab === 'command' && (
        <section className="taskit-detail-grid">
          <article className="taskit-card">
            <div className="taskit-card-header">
              <div className="taskit-row-main">
                <span className="taskit-label">Delivery to cash</span>
                <h2 className="taskit-heading">Financial control map</h2>
              </div>
              <TrendingUp size={22} aria-hidden />
            </div>
            <div className="taskit-metric-list">
              <div className="taskit-metric-row">
                <span className="taskit-body">Overdue receivables</span>
                <strong className="taskit-heading">{formatMoney(metrics.overdueReceivables, primaryCurrency, locale)}</strong>
              </div>
              <div className="taskit-metric-row">
                <span className="taskit-body">Posted journal entries</span>
                <strong className="taskit-heading">{metrics.postedJournals}</strong>
              </div>
              <div className="taskit-metric-row">
                <span className="taskit-body">Chart accounts</span>
                <strong className="taskit-heading">{accountItems.length}</strong>
              </div>
            </div>
          </article>

          <article className="taskit-card">
            <div className="taskit-card-header">
              <div className="taskit-row-main">
                <span className="taskit-label">Collections</span>
                <h2 className="taskit-heading">Oldest overdue invoices</h2>
              </div>
              <AlertTriangle size={22} aria-hidden />
            </div>
            {!cfo.data?.overdueInvoices.length ? (
              <EmptyBlock title="No overdue invoices" body="Receivables are clear from the current CFO brief." />
            ) : (
              <div className="taskit-activity-list">
                {cfo.data.overdueInvoices.map((invoice) => (
                  <div key={invoice.invoiceNumber} className="taskit-activity-row">
                    <div className="taskit-row-main">
                      <span className="taskit-label">{invoice.invoiceNumber}</span>
                      <span className="taskit-body">{invoice.clientName}</span>
                      <span className="taskit-body">Due {formatDate(invoice.dueDate, locale)}</span>
                    </div>
                    <strong className="taskit-heading">{formatMoney(invoice.total, primaryCurrency, locale)}</strong>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      )}

      {activeTab === 'approvals' && (
        <section className="taskit-card">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">Approval workflows</span>
              <h2 className="taskit-heading">Finance decisions</h2>
            </div>
            <ClipboardCheck size={22} aria-hidden />
          </div>
          {!approvalItems.length ? (
            <EmptyBlock title="No finance approvals" body="New approval chains will appear here once created." />
          ) : (
            <div className="taskit-activity-list">
              {approvalItems.map((flow) => (
                <div key={flow.id} className="taskit-activity-row">
                  <div className="taskit-row-main">
                    <span className="taskit-label">{flow.flowType.replaceAll('_', ' ')}</span>
                    <span className="taskit-body">{flow.summary || `${flow.entityType} approval`}</span>
                    <span className="taskit-body">
                      {flow.steps.length} step{flow.steps.length === 1 ? '' : 's'} / created {formatDate(flow.createdAt, locale)}
                    </span>
                  </div>
                  <ToneBadge value={flow.status} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'expenses' && (
        <section className="taskit-card">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">Expense operations</span>
              <h2 className="taskit-heading">Submitted costs</h2>
            </div>
            <ReceiptText size={22} aria-hidden />
          </div>
          {!expenseItems.length ? (
            <EmptyBlock title="No expenses" body="Submitted expenses will appear here with vendor, project, and approval status." />
          ) : (
            <div className="taskit-activity-list">
              {expenseItems.map((expense) => (
                <div key={expense.id} className="taskit-activity-row">
                  <div className="taskit-row-main">
                    <span className="taskit-label">{expense.title}</span>
                    <span className="taskit-body">{expense.vendor?.name ?? expense.project?.title ?? expense.client?.companyName ?? 'Workspace expense'}</span>
                    <span className="taskit-body">{formatDate(expense.expenseDate, locale)}</span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <strong className="taskit-heading">{formatMoney(expense.total, expense.currency, locale)}</strong>
                    <ToneBadge value={expense.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'payroll' && (
        <section className="taskit-card">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">Payroll</span>
              <h2 className="taskit-heading">Run history</h2>
            </div>
            <Banknote size={22} aria-hidden />
          </div>
          {!payrollItems.length ? (
            <EmptyBlock title="No payroll runs" body="Payroll runs will appear here after processing." />
          ) : (
            <div className="taskit-activity-list">
              {payrollItems.map((run) => (
                <div key={run.id} className="taskit-activity-row">
                  <div className="taskit-row-main">
                    <span className="taskit-label">
                      {formatDate(run.periodStart, locale)} to {formatDate(run.periodEnd, locale)}
                    </span>
                    <span className="taskit-body">{run.items.length} payroll item{run.items.length === 1 ? '' : 's'}</span>
                    <span className="taskit-body">Net {formatMoney(run.netPay, run.currency, locale)}</span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <strong className="taskit-heading">{formatMoney(run.grossPay, run.currency, locale)}</strong>
                    <ToneBadge value={run.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'treasury' && (
        <section className="taskit-detail-grid">
          <article className="taskit-card">
            <div className="taskit-card-header">
              <div className="taskit-row-main">
                <span className="taskit-label">Treasury accounts</span>
                <h2 className="taskit-heading">Cash and bank balances</h2>
              </div>
              <WalletCards size={22} aria-hidden />
            </div>
            {!treasuryAccountItems.length ? (
              <EmptyBlock title="No treasury accounts" body="Bank, cash, wallet, and processor accounts will appear here." />
            ) : (
              <div className="taskit-activity-list">
                {treasuryAccountItems.map((account) => (
                  <div key={account.id} className="taskit-activity-row">
                    <div className="taskit-row-main">
                      <span className="taskit-label">{account.name}</span>
                      <span className="taskit-body">{account.type.replaceAll('_', ' ')}</span>
                      <span className="taskit-body">{account.ledgerAccount ? `${account.ledgerAccount.code} ${account.ledgerAccount.name}` : 'No ledger account linked'}</span>
                    </div>
                    <strong className="taskit-heading">{formatMoney(account.currentBalance, account.currency, locale)}</strong>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="taskit-card">
            <div className="taskit-card-header">
              <div className="taskit-row-main">
                <span className="taskit-label">Payments</span>
                <h2 className="taskit-heading">Scheduled transactions</h2>
              </div>
              <ArrowRight size={22} aria-hidden />
            </div>
            {!treasuryTransactionItems.length ? (
              <EmptyBlock title="No treasury transactions" body="Transfers and payment schedules will appear here." />
            ) : (
              <div className="taskit-activity-list">
                {treasuryTransactionItems.map((transaction) => (
                  <div key={transaction.id} className="taskit-activity-row">
                    <div className="taskit-row-main">
                      <span className="taskit-label">{transaction.direction}</span>
                      <span className="taskit-body">
                        {transaction.fromAccount?.name ?? 'External'} to {transaction.toAccount?.name ?? 'External'}
                      </span>
                      <span className="taskit-body">{formatDate(transaction.scheduledFor, locale)}</span>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <strong className="taskit-heading">{formatMoney(transaction.amount, transaction.currency, locale)}</strong>
                      <ToneBadge value={transaction.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      )}

      {activeTab === 'ledger' && (
        <section className="taskit-detail-grid">
          <article className="taskit-card">
            <div className="taskit-card-header">
              <div className="taskit-row-main">
                <span className="taskit-label">Double-entry ledger</span>
                <h2 className="taskit-heading">Journal entries</h2>
              </div>
              <FileSpreadsheet size={22} aria-hidden />
            </div>
            {!journalItems.length ? (
              <EmptyBlock title="No journal entries" body="Posted and pending entries from accounting workflows will appear here." />
            ) : (
              <div className="taskit-activity-list">
                {journalItems.map((entry) => (
                  <div key={entry.id} className="taskit-activity-row">
                    <div className="taskit-row-main">
                      <span className="taskit-label">{entry.entryNumber}</span>
                      <span className="taskit-body">{entry.sourceType} / {formatDate(entry.transactionDate, locale)}</span>
                      <span className="taskit-body">
                        Debit {formatMoney(entry.totalDebit, entry.currency, locale)} / Credit {formatMoney(entry.totalCredit, entry.currency, locale)}
                      </span>
                    </div>
                    <ToneBadge value={entry.status} />
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="taskit-card">
            <div className="taskit-card-header">
              <div className="taskit-row-main">
                <span className="taskit-label">Chart of accounts</span>
                <h2 className="taskit-heading">Account structure</h2>
              </div>
              <CheckCircle2 size={22} aria-hidden />
            </div>
            {!accountItems.length ? (
              <EmptyBlock title="No accounts" body="Create accounts through the finance API to activate ledger posting." />
            ) : (
              <div className="taskit-activity-list">
                {accountItems.slice(0, 12).map((account) => (
                  <div key={account.id} className="taskit-activity-row">
                    <div className="taskit-row-main">
                      <span className="taskit-label">{account.code} {account.name}</span>
                      <span className="taskit-body">{account.type.replaceAll('_', ' ')} / {account.normalBalance}</span>
                    </div>
                    <ToneBadge value={account.status} />
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      )}
    </div>
  )
}
