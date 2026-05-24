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
  const projectionEnd = new Date(startOfToday.getTime() + days * 86400000)
  const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1)

  // Current cash balance from the cash/bank account
  const bankAccount = await prisma.eRPAccount.findFirst({
    where: { workspaceId, code: cashBankCode, isDeleted: false } as any,
    select: { id: true, name: true },
  })
  const currentCash = 0 // Starting balance — would come from opening balances

  // Open AR: money coming in (credit lines on AR account)
  const openAR = await prisma.eRPJournalEntry.findMany({
    where: {
      workspaceId,
      status: 'POSTED',
      isDeleted: false,
      lines: {
        some: { account: { code: '1020' } },
      },
    } as any,
    include: { lines: { include: { account: true } } },
    orderBy: { date: 'asc' },
  })

  // Open AP: money going out
  const openAP = await prisma.eRPJournalEntry.findMany({
    where: {
      workspaceId,
      status: 'POSTED',
      isDeleted: false,
      lines: {
        some: { account: { code: '2010' } },
      },
    } as any,
    include: { lines: { include: { account: true } } },
    orderBy: { date: 'asc' },
  })

  // Historical monthly net cash flow (for pattern detection)
  const historicalEntries = await prisma.eRPJournalEntry.findMany({
    where: {
      workspaceId,
      status: 'POSTED',
      isDeleted: false,
      date: { gte: twelveMonthsAgo },
    } as any,
    include: { lines: true },
  })

  // Calculate monthly net cash flow from history
  const monthlyNets: number[] = []
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 11 + m, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - 11 + m + 1, 0, 23, 59, 59, 999)
    const monthEntries = historicalEntries.filter(e => e.date >= monthStart && e.date <= monthEnd)
    const net = monthEntries.reduce((sum, e) => {
      const lineTotal = e.lines.reduce((s, l) => s + (l as any).amount * ((l as any).side === 'debit' ? 1 : -1), 0)
      return sum + lineTotal
    }, 0)
    monthlyNets.push(net)
  }

  const avgMonthlyNet = monthlyNets.length > 0
    ? monthlyNets.reduce((s, n) => s + n, 0) / monthlyNets.length
    : 0

  // Build day-by-day projection
  const projected: CashForecastDay[] = []
  let runningCash = currentCash

  // AR inflows per day (simplified: spread evenly across 30 days from post date)
  const arInflowsPerDay = openAR.length > 0
    ? openAR.reduce((sum, e) => sum + e.lines.reduce((s, l) => s + Math.abs((l as any).amount), 0), 0) / 30
    : 0

  // AP outflows per day
  const apOutflowsPerDay = openAP.length > 0
    ? openAP.reduce((sum, e) => sum + e.lines.reduce((s, l) => s + Math.abs((l as any).amount), 0), 0) / 30
    : 0

  const dailyBaseFlow = avgMonthlyNet / 30
  const volatility = Math.abs(dailyBaseFlow) * 0.3 // 30% volatility band

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
    const noise = (Math.random() - 0.5) * volatility

    runningCash += netDay + noise

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
      optimistic: Math.round(runningCash + Math.abs(volatility)),
      pessimistic: Math.round(runningCash - Math.abs(volatility)),
      inflows: Math.round(inflows),
      outflows: Math.round(outflows),
    })
  }

  const recommendations: string[] = []
  if (crisisDetected) {
    recommendations.push(`Cash crisis projected on ${crisisDate}. Consider collecting outstanding AR or reducing discretionary spending.`)
  }
  if (minBalance < currentCash * 0.2) {
    recommendations.push(`Cash balance may drop to ${(minBalance / 100).toFixed(0)} — below 20% of current. Review upcoming payables.`)
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
