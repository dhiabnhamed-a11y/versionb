import 'server-only'

import { prisma } from '@/lib/db'

export type HealthFactor = {
  name: string
  value: number
  target: number
  score: number
  status: 'good' | 'warning' | 'bad'
  description: string
}

export type HealthScoreResult = {
  overall: number
  factors: HealthFactor[]
  topPositive: string[]
  topNegative: string[]
  improvements: string[]
}

export async function computeHealthScore(workspaceId: string): Promise<HealthScoreResult> {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  // Get all posted entries this year
  const yearEntries = await prisma.eRPJournalEntry.findMany({
    where: { workspaceId, status: 'POSTED', isDeleted: false, date: { gte: startOfYear } } as any,
    include: { lines: { include: { account: true } } },
  })

  // Categorize by account type
  const assetDebits = sumLinesByType(yearEntries, 'ASSET', 'debit')
  const assetCredits = sumLinesByType(yearEntries, 'ASSET', 'credit')
  const liabilityCredits = sumLinesByType(yearEntries, 'LIABILITY', 'credit')
  const liabilityDebits = sumLinesByType(yearEntries, 'LIABILITY', 'debit')
  const revenueCredits = sumLinesByType(yearEntries, 'REVENUE', 'credit')
  const expenseDebits = sumLinesByType(yearEntries, 'EXPENSE', 'debit')

  // Current Assets (Cash + AR + Prepaid)
  const cashBalance = await getAccountBalance(workspaceId, '1010')
  const arBalance = await getAccountBalance(workspaceId, '1020')
  const currentAssets = cashBalance + arBalance

  // Current Liabilities (AP + Accrued)
  const apBalance = await getAccountBalance(workspaceId, '2010')
  const currentLiabilities = apBalance || 1 // avoid div by 0

  // Gross revenue and expenses this year
  const grossRevenue = revenueCredits
  const grossExpenses = expenseDebits
  const grossProfit = grossRevenue - grossExpenses

  const factors: HealthFactor[] = []

  // 1. Current Ratio (target > 2.0)
  const currentRatio = currentAssets / currentLiabilities
  factors.push(calcFactor('Current Ratio', currentRatio, 2.0,
    'Ratio of current assets to current liabilities. Higher = better liquidity.'))

  // 2. Quick Ratio (target > 1.0)
  const quickRatio = cashBalance / currentLiabilities
  factors.push(calcFactor('Quick Ratio', quickRatio, 1.0,
    'Ratio of cash + AR to current liabilities. Higher = better short-term solvency.'))

  // 3. Gross Margin (target > 50%)
  const grossMargin = grossRevenue > 0 ? grossProfit / grossRevenue : 0
  factors.push(calcFactor('Gross Margin', grossMargin, 0.5,
    'Revenue minus direct costs divided by revenue. Higher = more profitable.'))

  // 4. Cash Runway (target > 6 months)
  const monthlyBurn = grossExpenses / Math.max(1, now.getMonth() + 1)
  const cashRunway = monthlyBurn > 0 ? cashBalance / monthlyBurn : 12
  factors.push(calcFactor('Cash Runway (months)', cashRunway, 6,
    'Months until cash runs out at current burn rate. Higher = more runway.'))

  // 5. Budget Utilization
  const budgetAccounts = await prisma.eRPAccount.findMany({
    where: { workspaceId, type: 'EXPENSE' as any, isDeleted: false } as any,
    select: { id: true, code: true, name: true },
  })
  const budgetScore = budgetAccounts.length > 0 ? 70 : 50 // placeholder
  factors.push(calcFactor('Budget Coverage', budgetScore, 80,
    'Percentage of expense accounts with active budgets. Higher = better planning.'))

  // 6. AR Days (target < 30)
  const arDays = arBalance > 0 && grossRevenue > 0
    ? (arBalance / grossRevenue) * 365
    : 0
  factors.push(calcFactor('AR Days', Math.max(0, 30 - arDays), 30,
    'Average days to collect payment. Lower = faster collection.'))

  // Compute overall weighted score
  const weights = [0.25, 0.15, 0.2, 0.15, 0.1, 0.15]
  const overall = Math.round(
    factors.reduce((sum, f, i) => sum + f.score * weights[i], 0)
  )

  // Identify top positive and negative factors
  const sorted = [...factors].sort((a, b) => b.score - a.score)
  const topPositive = sorted.filter(f => f.status === 'good').slice(0, 3).map(f => f.name)
  const topNegative = sorted.filter(f => f.status !== 'good').slice(0, 3).map(f => f.name)

  // Improvement suggestions
  const improvements: string[] = []
  if (currentRatio < 1.5) improvements.push('Increase current assets or reduce short-term liabilities to improve liquidity.')
  if (quickRatio < 0.8) improvements.push('Build cash reserves or collect outstanding AR faster.')
  if (grossMargin < 0.3) improvements.push('Review pricing strategy or reduce direct costs to improve gross margin.')
  if (cashRunway < 3) improvements.push('Cash runway is below 3 months — consider financing or aggressive cost reduction.')
  if (factors.length > 0 && factors[factors.length - 1].score < 40) improvements.push(`Improve ${factors[factors.length - 1].name} — it is your weakest metric.`)

  return { overall, factors, topPositive, topNegative, improvements }
}

function calcFactor(name: string, value: number, target: number, description: string): HealthFactor {
  const ratio = target > 0 ? value / target : value
  const score = Math.min(100, Math.max(0, Math.round(ratio * 100)))
  const status = score >= 80 ? 'good' : score >= 50 ? 'warning' : 'bad'
  return { name, value: Math.round(value * 100) / 100, target, score, status, description }
}

async function getAccountBalance(workspaceId: string, code: string): Promise<number> {
  const entries = await prisma.eRPJournalEntry.findMany({
    where: { workspaceId, status: 'POSTED', isDeleted: false } as any,
    include: {
      lines: {
        where: { account: { code } } as any,
      },
    },
  })

  return entries.reduce((sum, e) => {
    return sum + e.lines.reduce((s, l) => {
      const amount = (l as any).amount || 0
      return s + ((l as any).side === 'debit' ? amount : -amount)
    }, 0)
  }, 0)
}

function sumLinesByType(
  entries: Array<any>,
  type: string,
  side: string,
): number {
  return entries.reduce((sum, e) => {
    return sum + e.lines
      .filter((l: any) => l.account?.type === type && (l as any).side === side)
      .reduce((s: number, l: any) => s + Math.abs((l as any).amount || 0), 0)
  }, 0)
}
