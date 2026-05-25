import 'server-only'

import type { ERPAccountType, Prisma } from '@prisma/client'
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

type JournalEntryWithAccountLines = Prisma.ERPJournalEntryGetPayload<{
  include: { lines: { include: { account: true } } }
}>

export async function computeHealthScore(workspaceId: string): Promise<HealthScoreResult> {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const yearEntries = await prisma.eRPJournalEntry.findMany({
    where: { workspaceId, status: 'POSTED', isDeleted: false, date: { gte: startOfYear } },
    include: { lines: { include: { account: true } } },
  })

  const revenueCredits = sumLinesByType(yearEntries, 'REVENUE', 'credit')
  const expenseDebits = sumLinesByType(yearEntries, 'EXPENSE', 'debit')
  const cashBalance = await getAccountBalance(workspaceId, '1010')
  const arBalance = await getAccountBalance(workspaceId, '1020')
  const currentAssets = cashBalance + arBalance
  const apBalance = await getAccountBalance(workspaceId, '2010')
  const currentLiabilities = apBalance || 1
  const grossRevenue = revenueCredits
  const grossExpenses = expenseDebits
  const grossProfit = grossRevenue - grossExpenses

  const factors: HealthFactor[] = []
  const currentRatio = currentAssets / currentLiabilities
  factors.push(calcFactor('Current Ratio', currentRatio, 2.0, 'Ratio of current assets to current liabilities. Higher = better liquidity.'))

  const quickRatio = cashBalance / currentLiabilities
  factors.push(calcFactor('Quick Ratio', quickRatio, 1.0, 'Ratio of cash and AR to current liabilities. Higher = better short-term solvency.'))

  const grossMargin = grossRevenue > 0 ? grossProfit / grossRevenue : 0
  factors.push(calcFactor('Gross Margin', grossMargin, 0.5, 'Revenue minus direct costs divided by revenue. Higher = more profitable.'))

  const monthlyBurn = grossExpenses / Math.max(1, now.getMonth() + 1)
  const cashRunway = monthlyBurn > 0 ? cashBalance / monthlyBurn : 12
  factors.push(calcFactor('Cash Runway (months)', cashRunway, 6, 'Months until cash runs out at current burn rate. Higher = more runway.'))

  const budgetAccounts = await prisma.eRPAccount.findMany({
    where: { workspaceId, type: 'EXPENSE', isDeleted: false },
    select: { id: true },
  })
  const budgetScore = budgetAccounts.length > 0 ? 70 : 50
  factors.push(calcFactor('Budget Coverage', budgetScore, 80, 'Percentage of expense accounts with active budgets. Higher = better planning.'))

  const arDays = arBalance > 0 && grossRevenue > 0 ? (arBalance / grossRevenue) * 365 : 0
  factors.push(calcFactor('AR Days', Math.max(0, 30 - arDays), 30, 'Average days to collect payment. Lower = faster collection.'))

  const weights = [0.25, 0.15, 0.2, 0.15, 0.1, 0.15]
  const overall = Math.round(factors.reduce((sum, factor, index) => sum + factor.score * weights[index], 0))
  const sorted = [...factors].sort((a, b) => b.score - a.score)
  const topPositive = sorted.filter((factor) => factor.status === 'good').slice(0, 3).map((factor) => factor.name)
  const topNegative = sorted.filter((factor) => factor.status !== 'good').slice(0, 3).map((factor) => factor.name)
  const weakestFactor = factors[factors.length - 1]

  const improvements: string[] = []
  if (currentRatio < 1.5) improvements.push('Increase current assets or reduce short-term liabilities to improve liquidity.')
  if (quickRatio < 0.8) improvements.push('Build cash reserves or collect outstanding AR faster.')
  if (grossMargin < 0.3) improvements.push('Review pricing strategy or reduce direct costs to improve gross margin.')
  if (cashRunway < 3) improvements.push('Cash runway is below 3 months. Consider financing or aggressive cost reduction.')
  if (weakestFactor?.score < 40) improvements.push(`Improve ${weakestFactor.name}. It is your weakest metric.`)

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
    where: { workspaceId, status: 'POSTED', isDeleted: false },
    include: {
      lines: {
        where: { account: { code } },
      },
    },
  })

  return entries.reduce((sum, entry) => {
    return sum + entry.lines.reduce((lineSum, line) => lineSum + line.debit - line.credit, 0)
  }, 0)
}

function sumLinesByType(
  entries: JournalEntryWithAccountLines[],
  type: ERPAccountType,
  side: 'debit' | 'credit',
): number {
  return entries.reduce((sum, entry) => {
    return sum + entry.lines
      .filter((line) => line.account?.type === type)
      .reduce((lineSum, line) => lineSum + Math.abs(side === 'debit' ? line.debit : line.credit), 0)
  }, 0)
}
