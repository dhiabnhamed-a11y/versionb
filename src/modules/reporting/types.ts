export type MoneyPoint = {
  label: string
  periodStart: string
  periodEnd: string
  revenue: string
  expenses: string
  payroll: string
  netCashflow: string
}

export type ExecutiveFinanceMetrics = {
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

export type ExecutiveFinanceInsight = {
  severity: 'INFO' | 'WATCH' | 'CRITICAL'
  title: string
  narrative: string
  recommendation: string
  evidence: Record<string, string | number | null>
}

export type FinancialOperatingSystemDashboard = {
  generatedAt: string
  model: 'taskit-financial-operating-system-v1'
  metrics: ExecutiveFinanceMetrics
  trends: {
    monthly: MoneyPoint[]
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

export type FinancialReportKind =
  | 'profit-and-loss'
  | 'balance-sheet'
  | 'cash-flow'
  | 'general-ledger'
  | 'trial-balance'
  | 'tax-summary'
  | 'budget-vs-actual'

export type FinancialReportLine = {
  key: string
  label: string
  accountCode?: string
  accountName?: string
  debit: string
  credit: string
  balance: string
}

export type FinancialReport = {
  kind: FinancialReportKind
  generatedAt: string
  currency: string
  periodStart: string | null
  periodEnd: string | null
  totals: Record<string, string>
  lines: FinancialReportLine[]
}
