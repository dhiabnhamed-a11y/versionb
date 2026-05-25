import 'server-only'

import type { ERPAlertSeverity, ERPAlertType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

export type AnomalyResult = {
  id: string
  type: string
  severity: string
  title: string
  description: string
  entityType: string
  entityId: string
  aiConfidence: number
  createdAt: Date
}

export async function listAlerts(workspaceId: string, unresolvedOnly = false): Promise<AnomalyResult[]> {
  const where: Prisma.ERPAlertWhereInput = { workspaceId }
  if (unresolvedOnly) where.isResolved = false

  const alerts = await prisma.eRPAlert.findMany({
    where,
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
  })

  return alerts.map(a => ({
    id: a.id,
    type: a.type,
    severity: a.severity,
    title: a.title,
    description: a.description,
    entityType: a.entityType,
    entityId: a.entityId,
    aiConfidence: a.aiConfidence,
    createdAt: a.createdAt,
  }))
}

export async function getAlertCounts(workspaceId: string) {
  const [total, unresolved, critical] = await Promise.all([
    prisma.eRPAlert.count({ where: { workspaceId } }),
    prisma.eRPAlert.count({ where: { workspaceId, isResolved: false } }),
    prisma.eRPAlert.count({ where: { workspaceId, isResolved: false, severity: 'CRITICAL' } }),
  ])

  return { total, unresolved, critical }
}

export async function resolveAlert(alertId: string) {
  return prisma.eRPAlert.update({
    where: { id: alertId },
    data: { isResolved: true, resolvedAt: new Date() },
  })
}

export async function markAlertRead(alertId: string) {
  return prisma.eRPAlert.update({
    where: { id: alertId },
    data: { isRead: true },
  })
}

export async function runAnomalyDetection(workspaceId: string): Promise<number> {
  const sevenDaysAgo = daysAgo(7)
  let alertCount = 0

  const recentEntries = await prisma.eRPJournalEntry.findMany({
    where: { workspaceId, date: { gte: sevenDaysAgo }, isDeleted: false },
    include: { lines: true },
    orderBy: { date: 'desc' },
  })

  // 1. Duplicate transactions
  const descAmountMap = new Map<string, typeof recentEntries>()
  for (const entry of recentEntries) {
    const total = journalEntryMagnitude(entry.lines)
    const key = `${entry.description}|${total}`
    const existing = descAmountMap.get(key) || []
    existing.push(entry)
    descAmountMap.set(key, existing)
  }

  for (const [, entries] of descAmountMap) {
    if (entries.length >= 2) {
      alertCount++
      await createAlert(workspaceId, 'DUPLICATE_TRANSACTION', 'WARNING',
        'Duplicate transaction detected',
        `${entries.length} entries matching "${entries[0].description}" with same total within 7 days`,
        'ERPJournalEntry', entries.map(e => e.id).join(','), 0.85)
    }
  }

  // 2. Round-number transactions
  for (const entry of recentEntries) {
    const total = journalEntryMagnitude(entry.lines)
    if (total > 0 && total % 50000 === 0) {
      alertCount++
      await createAlert(workspaceId, 'ROUND_NUMBER', 'INFO',
        'Round-number transaction',
        `Entry "${entry.description}" has exactly ${(total / 100).toFixed(0)} total`,
        'ERPJournalEntry', entry.id, 0.4)
    }
  }

  // 3. Weekend posting
  for (const entry of recentEntries) {
    const day = entry.date.getDay()
    if (day === 0 || day === 6) {
      alertCount++
      await createAlert(workspaceId, 'WEEKEND_POSTING', 'INFO',
        'Weekend journal entry',
        `Entry "${entry.description}" was posted on a ${day === 0 ? 'Sunday' : 'Saturday'}`,
        'ERPJournalEntry', entry.id, 0.3)
    }
  }

  // 4. Missing reference
  const noRefEntries = recentEntries.filter(e => !e.reference)
  if (noRefEntries.length > 5) {
    alertCount++
    await createAlert(workspaceId, 'MISSING_REFERENCE', 'WARNING',
      `${noRefEntries.length} entries missing reference numbers`,
      `${noRefEntries.length} journal entries in the last 7 days have no reference number`,
      'ERPJournalEntry', noRefEntries.map(e => e.id).join(','), 0.7)
  }

  return alertCount
}

async function createAlert(
  workspaceId: string,
  type: ERPAlertType,
  severity: ERPAlertSeverity,
  title: string,
  description: string,
  entityType: string,
  entityId: string,
  aiConfidence: number,
) {
  await prisma.eRPAlert.create({
    data: {
      workspaceId,
      type,
      severity,
      title,
      description,
      entityType,
      entityId,
      aiConfidence,
    },
  }).catch(() => {})
}

function journalEntryMagnitude(lines: Array<{ debit: number; credit: number }>) {
  const debit = lines.reduce((sum, line) => sum + Math.abs(line.debit), 0)
  const credit = lines.reduce((sum, line) => sum + Math.abs(line.credit), 0)
  return Math.max(debit, credit)
}
