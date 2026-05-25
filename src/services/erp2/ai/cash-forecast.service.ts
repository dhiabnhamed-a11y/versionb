import 'server-only'

import { prisma } from '@/lib/db'

export type CashForecastDay = {
  date: string
  expected: number
  optimistic: number
  pessimistic: number
  inflows: number
  outflows: number
}

export type CashForecastResult = {
  today: string
  projectedDays: CashForecastDay[]
  currentCash: number
  minBalance: number
  minBalanceDate: string | null
  crisisDetected: boolean
  crisisDate: string | null
  recommendations: string[]
}

export async function computeCashForecast(workspaceId: string, days = 90, cashBankCode = '1010'): Promise<CashForecastResult> {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1)

  const [openAR, openAP, historicalEntries] = await Promise.all([
    prisma.eRPARLedger.findMany({
      where: {
        workspaceId,
        isDeleted: false,
        status: { in: ['OPEN', 'PARTIAL', 'OVERDUE'] },
      },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.eRPAPBill.findMany({
      where: {
        workspaceId,
        isDeleted: false,
        status: { in: ['PENDING', 'APPROVED', 'OVERDUE'] },
      },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.eRPJournalEntry.findMany({
      where: {
        workspaceId,
        status: 'POSTED',
        isDeleted: false,
        date: { gte: twelveMonthsAgo },
      },
      include: { lines: { include: { account: true } } },
    }),
  ])

  const currentCash = historicalEntries.reduce((sum, entry) => {
    return sum + entry.lines
      .filter((line) => line.account?.code === cashBankCode)
      .reduce((lineSum, line) => lineSum + line.debit - line.credit, 0)
  }, 0)

  const monthlyNets: number[] = []
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 11 + m, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - 11 + m + 1, 0, 23, 59, 59, 999)
    const monthEntries = historicalEntries.filter((entry) => entry.date >= monthStart && entry.date <= monthEnd)
    const net = monthEntries.reduce((sum, entry) => {
      const cashLineTotal = entry.lines
        .filter((line) => line.account?.code === cashBankCode)
        .reduce((lineSum, line) => lineSum + line.debit - line.credit, 0)
      return sum + cashLineTotal
    }, 0)
    monthlyNets.push(net)
  }

  const avgMonthlyNet = monthlyNets.length > 0
    ? monthlyNets.reduce((sum, net) => sum + net, 0) / monthlyNets.length
    : 0

  const arInflowsPerDay = openAR.length > 0
    ? openAR.reduce((sum, item) => sum + Math.max(0, item.amount - item.amountPaid), 0) / 30
    : 0

  const apOutflowsPerDay = openAP.length > 0
    ? openAP.reduce((sum, item) => sum + Math.max(0, item.amount - item.amountPaid), 0) / 30
    : 0

  const dailyBaseFlow = avgMonthlyNet / 30
  const avgDeviation = monthlyNets.length > 0
    ? monthlyNets.reduce((sum, net) => sum + Math.abs(net - avgMonthlyNet), 0) / monthlyNets.length
    : 0
  const scenarioSpread = Math.max(Math.abs(dailyBaseFlow) * 0.3, avgDeviation / 30)
  const projected: CashForecastDay[] = []
  let runningCash = currentCash
  let minBalance = runningCash
  let minBalanceDate: string | null = null
  let crisisDetected = false
  let crisisDate: string | null = null

  for (let d = 0; d < days; d++) {
    const date = new Date(startOfToday.getTime() + d * 86400000)
    const dateStr = date.toISOString().split('T')[0]
    const inflows = arInflowsPerDay
    const outflows = apOutflowsPerDay + Math.max(0, dailyBaseFlow)
    const netDay = inflows - outflows
    const weekdayFactor = date.getDay() === 0 || date.getDay() === 6 ? -0.08 : 0.03
    const deterministicAdjustment = netDay * weekdayFactor

    runningCash += netDay + deterministicAdjustment

    if (runningCash < minBalance) {
      minBalance = runningCash
      minBalanceDate = dateStr
    }
    if (runningCash < 0 && !crisisDetected) {
      crisisDetected = true
      crisisDate = dateStr
    }

    projected.push({
      date: dateStr,
      expected: Math.round(runningCash),
      optimistic: Math.round(runningCash + Math.abs(scenarioSpread)),
      pessimistic: Math.round(runningCash - Math.abs(scenarioSpread)),
      inflows: Math.round(inflows),
      outflows: Math.round(outflows),
    })
  }

  const recommendations: string[] = []
  if (crisisDetected) {
    recommendations.push(`Cash crisis projected on ${crisisDate}. Consider collecting outstanding AR or reducing discretionary spending.`)
  }
  if (minBalance < currentCash * 0.2) {
    recommendations.push(`Cash balance may drop to ${(minBalance / 100).toFixed(0)} below 20% of current. Review upcoming payables.`)
  }
  if (arInflowsPerDay > 0) {
    recommendations.push(`Collecting AR faster by 10 days would add ~$${Math.round(arInflowsPerDay * 10 / 100)} to cash position.`)
  }

  return {
    today: startOfToday.toISOString().split('T')[0],
    projectedDays: projected,
    currentCash,
    minBalance,
    minBalanceDate,
    crisisDetected,
    crisisDate,
    recommendations,
  }
}
