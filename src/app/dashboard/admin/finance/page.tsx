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
  Sparkles,
  TrendingUp,
  Wand2,
  WalletCards,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
  metrics?: ExecutiveFinanceMetrics
  recommendations?: ExecutiveFinanceInsight[]
  overdueInvoices: Array<{
    invoiceNumber: string
    clientName: string
    total: string
    dueDate: string | null
  }>
}

type ExecutiveFinanceMetrics = {
  primaryCurrency: string
  financialHealthScore: number
  cashBalance: string
  openReceivables: string
  overdueReceivables: string
  paidRevenue: string
  draftPipeline: string
  expenseExposure: string
  payrollExposure: string
  openApprovals: number
  postedJournals: number
  grossProfit: string
  netProfit: string
  grossMarginPercent: number
  monthlyBurn: string
  runwayMonths: number | null
  accountsReceivableExposure: string
  accountsPayableExposure: string
  budgetVariance: string
  deliveryToCashDays: number | null
  payrollRevenueRatio: number
  clientConcentrationPercent: number
}

type ExecutiveFinanceInsight = {
  severity: 'INFO' | 'WATCH' | 'CRITICAL'
  title: string
  narrative: string
  recommendation: string
  evidence: Record<string, string | number | null>
}

type FinancialOperatingSystemDashboard = {
  generatedAt: string
  model: string
  metrics: ExecutiveFinanceMetrics
  trends: {
    monthly: Array<{
      label: string
      periodStart: string
      periodEnd: string
      revenue: string
      expenses: string
      payroll: string
      netCashflow: string
    }>
  }
  aging: {
    current: string
    days1To30: string
    days31To60: string
    days61To90: string
    over90: string
  }
  topClients: Array<{
    clientId: string | null
    clientName: string
    revenue: string
    exposure: string
    reliabilityScore: number
  }>
  recommendations: ExecutiveFinanceInsight[]
}

type EnterpriseForecast = {
  generatedAt: string
  model: string
  currency: string
  assumptions: {
    baseRevenue: string
    baseExpenses: string
    basePayroll: string
    openReceivables: string
    overdueReceivables: string
    currentCash: string
  }
  scenarios: Array<{
    id: string
    label: string
    runwayMonths: number | null
    projectedProfitability: string
    confidence: number
    months: Array<{
      label: string
      revenue: string
      collections: string
      expenses: string
      payroll: string
      netCashflow: string
      endingCash: string
    }>
  }>
  explanation: {
    confidence: string
    bottlenecks: string[]
    strategicMove: string
  }
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

type Invoice = {
  id: string
  invoiceNumber: string
  clientName: string
  status: string
  currency: string
  issueDate: string
  dueDate?: string | null
  paidAt?: string | null
  subtotal: MoneyLike
  taxTotal: MoneyLike
  total: MoneyLike
  campaign?: { id: string; title: string } | null
  client?: { id: string; companyName: string } | null
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

type FinanceTab = 'command' | 'billing' | 'approvals' | 'expenses' | 'payroll' | 'treasury' | 'ledger'

const tabs: Array<{ id: FinanceTab; label: string }> = [
  { id: 'command', label: 'Command' },
  { id: 'billing', label: 'Billing' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'treasury', label: 'Treasury' },
  { id: 'ledger', label: 'Accounting' },
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
      <p className="taskit-body">Reading your financial workspace</p>
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

const emptyExecutiveMetrics: ExecutiveFinanceMetrics = {
  primaryCurrency: 'USD',
  financialHealthScore: 0,
  cashBalance: '0',
  openReceivables: '0',
  overdueReceivables: '0',
  paidRevenue: '0',
  draftPipeline: '0',
  expenseExposure: '0',
  payrollExposure: '0',
  openApprovals: 0,
  postedJournals: 0,
  grossProfit: '0',
  netProfit: '0',
  grossMarginPercent: 0,
  monthlyBurn: '0',
  runwayMonths: null,
  accountsReceivableExposure: '0',
  accountsPayableExposure: '0',
  budgetVariance: '0',
  deliveryToCashDays: null,
  payrollRevenueRatio: 0,
  clientConcentrationPercent: 0,
}

function ExecutiveTrendChart({
  data,
  currency,
  locale,
}: {
  data: FinancialOperatingSystemDashboard['trends']['monthly']
  currency: string
  locale: string
}) {
  if (!data.length) {
    return <EmptyBlock title="No trend data yet" body="Invoice, expense, payroll, and treasury activity will build this operating trend." />
  }

  const chartData = data.map((point) => ({
    ...point,
    revenue: decimal(point.revenue),
    expenses: decimal(point.expenses),
    payroll: decimal(point.payroll),
    netCashflow: decimal(point.netCashflow),
  }))

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="financeRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.34} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="financeCosts" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.22} />
              <stop offset="95%" stopColor="var(--danger)" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            tickFormatter={(value) => Intl.NumberFormat(localeForDate(locale), { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value))}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: 'var(--shadow-lg)',
            }}
            formatter={(value, name) => [formatMoney(Number(value), currency, locale), String(name).replace(/([A-Z])/g, ' $1')]}
          />
          <Area type="monotone" dataKey="revenue" stroke="var(--accent)" fill="url(#financeRevenue)" strokeWidth={2.4} />
          <Area type="monotone" dataKey="expenses" stroke="var(--danger)" fill="url(#financeCosts)" strokeWidth={2} />
          <Area type="monotone" dataKey="payroll" stroke="var(--warning)" fill="transparent" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function PremiumEmptyState({
  icon: Icon,
  title,
  body,
  bullets,
  actionLabel,
  onAction,
  actionHref,
  busy = false,
}: {
  icon: typeof Sparkles
  title: string
  body: string
  bullets: string[]
  actionLabel?: string
  onAction?: () => void
  actionHref?: string
  busy?: boolean
}) {
  const actionContent = (
    <>
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
      {actionLabel}
    </>
  )

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--accent)]">
            <Icon size={22} aria-hidden />
          </div>
          <h3 className="taskit-heading">{title}</h3>
          <p className="taskit-body mt-2 max-w-2xl">{body}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {bullets.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
                <CheckCircle2 size={15} className="text-[var(--success)]" aria-hidden />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
        {actionLabel && (
          actionHref ? (
            <Link href={actionHref} className="btn-primary shrink-0">
              {actionContent}
            </Link>
          ) : (
            <button type="button" className="btn-primary shrink-0" onClick={onAction} disabled={busy}>
              {actionContent}
            </button>
          )
        )}
      </div>
    </div>
  )
}

export default function AdminFinancePage() {
  const { locale } = useLocale()
  const [activeTab, setActiveTab] = useState<FinanceTab>('command')
  const [refreshing, setRefreshing] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)

  const cfo = useSWR<CfoBrief>('/api/finance/cfo/brief', fetchJson)
  const operatingSystem = useSWR<FinancialOperatingSystemDashboard>('/api/finance/operating-system', fetchJson)
  const forecast = useSWR<EnterpriseForecast>('/api/finance/forecasting/engine', fetchJson)
  const invoices = useSWR<ApiList<Invoice> & { summary?: { total?: number; count?: number } }>('/api/invoices?pageSize=50', fetchJson)
  const approvals = useSWR<ApiList<ApprovalFlow>>('/api/finance/approvals?pageSize=50', fetchJson)
  const expenses = useSWR<ApiList<Expense>>('/api/finance/expenses?pageSize=50', fetchJson)
  const payroll = useSWR<ApiList<PayrollRun>>('/api/finance/payroll?pageSize=30', fetchJson)
  const treasuryAccounts = useSWR<TreasuryAccount[]>('/api/finance/treasury/accounts', fetchJson)
  const treasuryTransactions = useSWR<ApiList<TreasuryTransaction>>('/api/finance/treasury/transactions?pageSize=30', fetchJson)
  const journals = useSWR<ApiList<JournalEntry>>('/api/finance/journal-entries?pageSize=30', fetchJson)
  const accounts = useSWR<Account[]>('/api/finance/accounts', fetchJson)

  const invoiceItems = useMemo(() => invoices.data?.items ?? [], [invoices.data?.items])
  const approvalItems = useMemo(() => approvals.data?.items ?? [], [approvals.data?.items])
  const expenseItems = useMemo(() => expenses.data?.items ?? [], [expenses.data?.items])
  const payrollItems = useMemo(() => payroll.data?.items ?? [], [payroll.data?.items])
  const treasuryAccountItems = useMemo(() => treasuryAccounts.data ?? [], [treasuryAccounts.data])
  const treasuryTransactionItems = useMemo(() => treasuryTransactions.data?.items ?? [], [treasuryTransactions.data?.items])
  const journalItems = useMemo(() => journals.data?.items ?? [], [journals.data?.items])
  const accountItems = useMemo(() => accounts.data ?? [], [accounts.data])
  const metrics = operatingSystem.data?.metrics ?? emptyExecutiveMetrics
  const recommendations = operatingSystem.data?.recommendations ?? cfo.data?.recommendations ?? []
  const monthlyTrend = operatingSystem.data?.trends.monthly ?? []
  const topClients = operatingSystem.data?.topClients ?? []

  const loading = [
    cfo.isLoading,
    operatingSystem.isLoading,
    forecast.isLoading,
    invoices.isLoading,
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
    operatingSystem.error,
    forecast.error,
    invoices.error,
    approvals.error,
    expenses.error,
    payroll.error,
    treasuryAccounts.error,
    treasuryTransactions.error,
    journals.error,
    accounts.error,
  ].find(Boolean)

  async function refreshAll() {
    setRefreshing(true)
    await Promise.all([
      cfo.mutate(),
      operatingSystem.mutate(),
      forecast.mutate(),
      invoices.mutate(),
      approvals.mutate(),
      expenses.mutate(),
      payroll.mutate(),
      treasuryAccounts.mutate(),
      treasuryTransactions.mutate(),
      journals.mutate(),
      accounts.mutate(),
    ]).finally(() => setRefreshing(false))
  }

  const primaryCurrency = metrics.primaryCurrency || invoiceItems[0]?.currency || treasuryAccountItems[0]?.currency || expenseItems[0]?.currency || payrollItems[0]?.currency || 'USD'
  const workspaceActivated = accountItems.length > 0
  const financialHealthScore = metrics.financialHealthScore || (workspaceActivated ? 58 : 0)

  async function initializeWorkspace() {
    setInitializing(true)
    setSetupMessage(null)
    try {
      const response = await fetch('/api/finance/setup/recommended', { method: 'POST' })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Financial workspace could not be initialized.')
      setSetupMessage(body?.message || 'Your financial workspace is ready.')
      await refreshAll()
    } catch (error) {
      setSetupMessage(error instanceof Error ? error.message : 'Financial workspace could not be initialized.')
    } finally {
      setInitializing(false)
    }
  }

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

      {!loading && !workspaceActivated && (
        <section className="taskit-card mb-6">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">Financial setup assistant</span>
              <h2 className="taskit-heading">Welcome to TASKIT Financial Operations</h2>
            </div>
            <Sparkles size={22} aria-hidden style={{ color: 'var(--accent)' }} />
          </div>
          <PremiumEmptyState
            icon={Landmark}
            title="Your financial workspace is ready to be initialized"
            body="TASKIT can configure the recommended financial foundation for an agency or service business in under two minutes, then connect it to invoices, payroll, spending, cash, and profitability intelligence."
            bullets={[
              'Accounting structure',
              'Payroll foundations',
              'Treasury workspace',
              'Expense categories',
              'Tax-ready accounts',
              'Profitability tracking',
            ]}
            actionLabel="Initialize Financial Workspace"
            onAction={initializeWorkspace}
            busy={initializing}
          />
          {setupMessage && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-sm font-semibold text-[var(--text-primary)]">
              {setupMessage}
            </div>
          )}
        </section>
      )}

      <section className="dashboard-stat-grid">
        <article className="stat-card">
          <span className="stat-card-label">Financial health</span>
          <strong className="stat-card-value">{financialHealthScore}%</strong>
          <span className="stat-card-delta">
            <Sparkles size={14} /> {workspaceActivated ? 'Operating foundation active' : 'Foundation ready to initialize'}
          </span>
        </article>
        <article className="stat-card">
          <span className="stat-card-label">Cash position</span>
          <strong className="stat-card-value">{formatMoney(metrics.cashBalance, primaryCurrency, locale)}</strong>
          <span className="stat-card-delta">
            <WalletCards size={14} /> {treasuryAccountItems.length} treasury account{treasuryAccountItems.length === 1 ? '' : 's'}
          </span>
        </article>
        <article className="stat-card">
          <span className="stat-card-label">Open receivables</span>
          <strong className="stat-card-value">{formatMoney(metrics.openReceivables, primaryCurrency, locale)}</strong>
          <span className="stat-card-delta">
            <ReceiptText size={14} /> {invoiceItems.filter((item) => ['sent', 'viewed', 'partially_paid', 'overdue', 'disputed', 'escalated'].includes(item.status)).length} unpaid invoice{invoiceItems.filter((item) => ['sent', 'viewed', 'partially_paid', 'overdue', 'disputed', 'escalated'].includes(item.status)).length === 1 ? '' : 's'}
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
            <BadgeDollarSign size={14} /> {formatMoney(metrics.accountsPayableExposure, primaryCurrency, locale)} payable exposure
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

      <section className="taskit-detail-grid mb-6">
        <article className="taskit-card">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">Operating intelligence</span>
              <h2 className="taskit-heading">Revenue, cost, and cashflow trend</h2>
            </div>
            <TrendingUp size={22} aria-hidden />
          </div>
          <ExecutiveTrendChart data={monthlyTrend} currency={primaryCurrency} locale={locale} />
        </article>

        <article className="taskit-card">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">Executive recommendations</span>
              <h2 className="taskit-heading">CFO action queue</h2>
            </div>
            <Sparkles size={22} aria-hidden />
          </div>
          {!recommendations.length ? (
            <EmptyBlock title="No recommendations yet" body="TASKIT will surface collection, margin, payroll, budget, and runway actions as financial events accumulate." />
          ) : (
            <div className="taskit-alert-list">
              {recommendations.slice(0, 4).map((insight) => (
                <div key={`${insight.title}-${insight.severity}`} className="taskit-alert-row">
                  <div className="taskit-row-main">
                    <span className="taskit-label">{insight.severity}</span>
                    <span className="taskit-heading">{insight.title}</span>
                    <span className="taskit-body">{insight.narrative}</span>
                    <span className="taskit-body">{insight.recommendation}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
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
                <span className="taskit-body">Paid invoice revenue</span>
                <strong className="taskit-heading">{formatMoney(metrics.paidRevenue, primaryCurrency, locale)}</strong>
              </div>
              <div className="taskit-metric-row">
                <span className="taskit-body">Draft billing pipeline</span>
                <strong className="taskit-heading">{formatMoney(metrics.draftPipeline, primaryCurrency, locale)}</strong>
              </div>
              <div className="taskit-metric-row">
                <span className="taskit-body">Posted financial events</span>
                <strong className="taskit-heading">{metrics.postedJournals}</strong>
              </div>
              <div className="taskit-metric-row">
                <span className="taskit-body">Financial foundation</span>
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

          <article className="taskit-card">
            <div className="taskit-card-header">
              <div className="taskit-row-main">
                <span className="taskit-label">Client exposure</span>
                <h2 className="taskit-heading">Receivables concentration</h2>
              </div>
              <BriefcaseBusiness size={22} aria-hidden />
            </div>
            {!topClients.length ? (
              <EmptyBlock title="No client exposure yet" body="Client-level revenue and receivables risk will appear after invoices are issued." />
            ) : (
              <div className="taskit-activity-list">
                {topClients.slice(0, 6).map((client) => (
                  <div key={`${client.clientId ?? client.clientName}`} className="taskit-activity-row">
                    <div className="taskit-row-main">
                      <span className="taskit-label">{client.clientName}</span>
                      <span className="taskit-body">Reliability score {client.reliabilityScore}</span>
                      <span className="taskit-body">Recognized revenue {formatMoney(client.revenue, primaryCurrency, locale)}</span>
                    </div>
                    <strong className="taskit-heading">{formatMoney(client.exposure, primaryCurrency, locale)}</strong>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="taskit-card">
            <div className="taskit-card-header">
              <div className="taskit-row-main">
                <span className="taskit-label">Forecasting engine</span>
                <h2 className="taskit-heading">Scenario runway</h2>
              </div>
              <TrendingUp size={22} aria-hidden />
            </div>
            {!forecast.data?.scenarios.length ? (
              <EmptyBlock title="Forecast building" body="Scenario planning appears when revenue, payroll, expense, and treasury records are available." />
            ) : (
              <div className="taskit-metric-list">
                {forecast.data.scenarios.map((scenario) => (
                  <div key={scenario.id} className="taskit-metric-row">
                    <span className="taskit-body">{scenario.label}</span>
                    <strong className="taskit-heading">
                      {scenario.runwayMonths === null ? '12+ mo' : `${scenario.runwayMonths} mo`} / {formatMoney(scenario.projectedProfitability, forecast.data?.currency ?? primaryCurrency, locale)}
                    </strong>
                  </div>
                ))}
                <div className="taskit-metric-row">
                  <span className="taskit-body">Forecast confidence</span>
                  <strong className="taskit-heading">{forecast.data.scenarios.find((scenario) => scenario.id === 'realistic')?.confidence ?? 0}%</strong>
                </div>
              </div>
            )}
          </article>

          <article className="taskit-card">
            <div className="taskit-card-header">
              <div className="taskit-row-main">
                <span className="taskit-label">Risk center</span>
                <h2 className="taskit-heading">Operational finance bottlenecks</h2>
              </div>
              <AlertTriangle size={22} aria-hidden />
            </div>
            {!forecast.data?.explanation.bottlenecks.length ? (
              <EmptyBlock title="No bottlenecks detected" body="TASKIT is monitoring collections, payroll burden, margin quality, and delivery-to-cash latency." />
            ) : (
              <div className="taskit-alert-list">
                {forecast.data.explanation.bottlenecks.slice(0, 4).map((bottleneck) => (
                  <div key={bottleneck} className="taskit-alert-row">
                    <div className="taskit-row-main">
                      <span className="taskit-body">{bottleneck}</span>
                    </div>
                  </div>
                ))}
                <div className="taskit-alert-row">
                  <div className="taskit-row-main">
                    <span className="taskit-label">Strategic move</span>
                    <span className="taskit-body">{forecast.data.explanation.strategicMove}</span>
                  </div>
                </div>
              </div>
            )}
          </article>
        </section>
      )}

      {activeTab === 'billing' && (
        <section className="taskit-detail-grid">
          <article className="taskit-card">
            <div className="taskit-card-header">
              <div className="taskit-row-main">
                <span className="taskit-label">Invoice system link</span>
                <h2 className="taskit-heading">Billing and receivables</h2>
              </div>
              <Link href="/dashboard/admin/invoices" className="taskit-secondary-action">
                <ReceiptText size={20} />
                Open invoices
              </Link>
            </div>
            <div className="taskit-metric-list">
              <div className="taskit-metric-row">
                <span className="taskit-body">Invoice total in current view</span>
                <strong className="taskit-heading">{formatMoney(invoices.data?.summary?.total ?? 0, primaryCurrency, locale)}</strong>
              </div>
              <div className="taskit-metric-row">
                <span className="taskit-body">Paid revenue</span>
                <strong className="taskit-heading">{formatMoney(metrics.paidRevenue, primaryCurrency, locale)}</strong>
              </div>
              <div className="taskit-metric-row">
                <span className="taskit-body">Unpaid receivables</span>
                <strong className="taskit-heading">{formatMoney(metrics.openReceivables, primaryCurrency, locale)}</strong>
              </div>
              <div className="taskit-metric-row">
                <span className="taskit-body">Draft pipeline</span>
                <strong className="taskit-heading">{formatMoney(metrics.draftPipeline, primaryCurrency, locale)}</strong>
              </div>
            </div>
          </article>

          <article className="taskit-card">
            <div className="taskit-card-header">
              <div className="taskit-row-main">
                <span className="taskit-label">Recent invoices</span>
                <h2 className="taskit-heading">Client billing feed</h2>
              </div>
              <ReceiptText size={22} aria-hidden />
            </div>
            {!invoiceItems.length ? (
              <EmptyBlock title="No invoices yet" body="Create invoices from the invoice workspace and they will appear in finance." />
            ) : (
              <div className="taskit-activity-list">
                {invoiceItems.slice(0, 12).map((invoice) => (
                  <div key={invoice.id} className="taskit-activity-row">
                    <div className="taskit-row-main">
                      <span className="taskit-label">{invoice.invoiceNumber}</span>
                      <span className="taskit-body">{invoice.client?.companyName ?? invoice.clientName}</span>
                      <span className="taskit-body">
                        {invoice.campaign?.title ? `${invoice.campaign.title} / ` : ''}
                        Issued {formatDate(invoice.issueDate, locale)}
                        {invoice.dueDate ? ` / Due ${formatDate(invoice.dueDate, locale)}` : ''}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <strong className="taskit-heading">{formatMoney(invoice.total, invoice.currency, locale)}</strong>
                      <ToneBadge value={invoice.status} />
                    </div>
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
            <PremiumEmptyState
              icon={ClipboardCheck}
              title="Financial decisions are flowing clearly"
              body="Approvals for spending, payroll, transfers, and invoice exceptions will appear here with decision context and audit history."
              bullets={['Expense approvals', 'Payroll approvals', 'Transfer reviews', 'Invoice controls']}
            />
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
            <PremiumEmptyState
              icon={BadgeDollarSign}
              title="Track operational spending intelligently"
              body="TASKIT will connect expenses to clients, projects, approvals, treasury, and profitability so spending is understood in context."
              bullets={['Project-linked spending', 'Recurring costs', 'Reimbursements', 'Profitability impact']}
              actionLabel="Start Expense Tracking"
              onAction={() => setActiveTab('command')}
            />
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
            <PremiumEmptyState
              icon={Banknote}
              title="Start managing team compensation"
              body="TASKIT Payroll is prepared for salaries, bonuses, deductions, overtime, approvals, compensation history, and ledger-ready posting."
              bullets={['Salaries and hourly pay', 'Bonuses and deductions', 'Approval workflow', 'Payroll analytics']}
              actionLabel={workspaceActivated ? undefined : 'Configure Payroll System'}
              onAction={initializeWorkspace}
              busy={initializing}
            />
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
              <PremiumEmptyState
                icon={WalletCards}
                title="Activate treasury operations"
                body="Connect cash, bank, wallet, and payment processor balances into one operational view for runway, liquidity, and scheduled payments."
                bullets={['Cash accounts', 'Bank balances', 'Internal transfers', 'Payment schedules']}
                actionLabel="Generate Treasury Workspace"
                onAction={initializeWorkspace}
                busy={initializing}
              />
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
              <PremiumEmptyState
                icon={ArrowRight}
                title="Payment activity will appear here"
                body="Scheduled payments, transfers, collections, and reconciliation signals will populate this timeline as your cash operations grow."
                bullets={['Scheduled payments', 'Internal transfers', 'Collections', 'Reconciliation signals']}
              />
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
                <span className="taskit-label">Accounting activity</span>
                <h2 className="taskit-heading">Financial event history</h2>
              </div>
              <FileSpreadsheet size={22} aria-hidden />
            </div>
            {!journalItems.length ? (
              <PremiumEmptyState
                icon={FileSpreadsheet}
                title="Financial history will build automatically"
                body="As invoices, payroll, expenses, treasury movements, and approvals become active, TASKIT will preserve a clear financial event trail."
                bullets={['Invoice activity', 'Payroll posting', 'Expense impact', 'Treasury movements']}
              />
            ) : (
              <div className="taskit-activity-list">
                {journalItems.map((entry) => (
                  <div key={entry.id} className="taskit-activity-row">
                    <div className="taskit-row-main">
                      <span className="taskit-label">{entry.entryNumber}</span>
                      <span className="taskit-body">{entry.sourceType} / {formatDate(entry.transactionDate, locale)}</span>
                      <span className="taskit-body">
                        Balanced movement {formatMoney(entry.totalDebit, entry.currency, locale)}
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
                <span className="taskit-label">Accounting foundation</span>
                <h2 className="taskit-heading">Financial structure</h2>
              </div>
              <CheckCircle2 size={22} aria-hidden />
            </div>
            {!accountItems.length ? (
              <PremiumEmptyState
                icon={Landmark}
                title="Your accounting structure has not been configured yet"
                body="TASKIT can generate the recommended operating structure for revenue, payroll, treasury, expenses, taxes, and profitability without exposing accounting setup complexity."
                bullets={['Operational accounts', 'Revenue accounts', 'Payroll accounts', 'Treasury accounts', 'Tax-ready structure', 'Profitability categories']}
                actionLabel="Generate Recommended Structure"
                onAction={initializeWorkspace}
                busy={initializing}
              />
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
