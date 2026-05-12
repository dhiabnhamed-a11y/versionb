import { prisma } from '@/lib/db'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import { toJsonValue } from '@/modules/shared/json'
import { findConnectedAccountForCompany } from '@/modules/integrations/repositories/integration.repository'
import { recordIntegrationActivity } from '@/modules/integrations/security/audit'
import { addUtcDays, startOfUtcDay } from '@/modules/integrations/utils/dates'
import { notFound } from '@/modules/shared/errors'

type InsightDraft = {
  insightType: string
  severity: 'INFO' | 'OPPORTUNITY' | 'WARNING' | 'CRITICAL'
  title: string
  summary: string
  recommendation: string
  confidence: number
  evidence: Record<string, unknown>
}

function sumBigInt(values: Array<bigint | number | null | undefined>) {
  return values.reduce<number>((total, value) => total + Number(value ?? 0), 0)
}

function percentChange(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function avg(values: number[]) {
  if (!values.length) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}

function buildInsightDrafts(input: {
  accountName: string
  provider: string
  currentViews: number
  previousViews: number
  currentRevenue: number
  previousRevenue: number
  currentEngagementRate: number
  previousEngagementRate: number
  publishedLast14Days: number
  topContentTitle?: string | null
}) {
  const drafts: InsightDraft[] = []
  const viewDelta = percentChange(input.currentViews, input.previousViews)
  const revenueDelta = percentChange(input.currentRevenue, input.previousRevenue)
  const engagementDelta = percentChange(input.currentEngagementRate, input.previousEngagementRate)

  if (viewDelta <= -20 && input.previousViews > 0) {
    drafts.push({
      insightType: 'growth_anomaly',
      severity: viewDelta <= -40 ? 'CRITICAL' : 'WARNING',
      title: `${input.provider} reach is down ${Math.abs(Math.round(viewDelta))}%`,
      summary: `${input.accountName} generated ${input.currentViews.toLocaleString()} recent views versus ${input.previousViews.toLocaleString()} in the prior window.`,
      recommendation: 'Review publishing cadence, traffic sources, and thumbnails/titles for the last high-performing content before scheduling the next release.',
      confidence: 0.82,
      evidence: { viewDelta, currentViews: input.currentViews, previousViews: input.previousViews },
    })
  }

  if (viewDelta >= 25 && input.currentViews > 0) {
    drafts.push({
      insightType: 'viral_pattern',
      severity: 'OPPORTUNITY',
      title: `${input.provider} momentum is accelerating`,
      summary: `${input.accountName} is up ${Math.round(viewDelta)}% in the current window. ${input.topContentTitle ? `${input.topContentTitle} is a likely creative signal.` : 'Recent content is outperforming the prior baseline.'}`,
      recommendation: 'Clone the winning format quickly: publish a follow-up, repurpose it into short clips, and route paid amplification only after organic retention holds.',
      confidence: 0.78,
      evidence: { viewDelta, currentViews: input.currentViews, previousViews: input.previousViews, topContentTitle: input.topContentTitle ?? null },
    })
  }

  if (engagementDelta <= -15 && input.previousEngagementRate > 0) {
    drafts.push({
      insightType: 'engagement_quality',
      severity: 'WARNING',
      title: 'Engagement quality is softening',
      summary: `Average engagement moved from ${(input.previousEngagementRate * 100).toFixed(2)}% to ${(input.currentEngagementRate * 100).toFixed(2)}%.`,
      recommendation: 'Tighten the first hook, add explicit save/comment prompts, and compare retention curves before changing distribution strategy.',
      confidence: 0.74,
      evidence: { engagementDelta, currentEngagementRate: input.currentEngagementRate, previousEngagementRate: input.previousEngagementRate },
    })
  }

  if (revenueDelta <= -20 && input.previousRevenue > 0) {
    drafts.push({
      insightType: 'revenue_trend',
      severity: 'WARNING',
      title: 'Revenue efficiency is declining',
      summary: `Estimated revenue changed ${Math.round(revenueDelta)}% against the prior window.`,
      recommendation: 'Separate content mix from monetization mechanics: inspect RPM/CPM, geography mix, ad suitability, and sponsorship timing.',
      confidence: 0.77,
      evidence: { revenueDelta, currentRevenue: input.currentRevenue, previousRevenue: input.previousRevenue },
    })
  }

  if (input.publishedLast14Days === 0) {
    drafts.push({
      insightType: 'publishing_frequency',
      severity: 'INFO',
      title: 'Publishing cadence is currently unmeasured',
      summary: 'No recently published content is stored for this account in the last 14 days.',
      recommendation: 'Run a full sync and set a release rhythm target so growth and retention analysis can separate creative quality from cadence.',
      confidence: 0.68,
      evidence: { publishedLast14Days: input.publishedLast14Days },
    })
  }

  if (!drafts.length) {
    drafts.push({
      insightType: 'operating_health',
      severity: 'INFO',
      title: 'No major social anomalies detected',
      summary: 'Recent growth, engagement, and monetization signals are within the current operating baseline.',
      recommendation: 'Keep syncing daily and use the next release cycle to gather enough content-level data for stronger recommendations.',
      confidence: 0.64,
      evidence: {
        currentViews: input.currentViews,
        previousViews: input.previousViews,
        currentRevenue: input.currentRevenue,
        previousRevenue: input.previousRevenue,
      },
    })
  }

  return drafts
}

export async function generateSocialInsights(input: { companyId: string; connectedAccountId: string }) {
  const account = await findConnectedAccountForCompany(input.companyId, input.connectedAccountId)
  if (!account) throw notFound('Connected account not found.')

  const today = startOfUtcDay(new Date())
  const currentStart = addUtcDays(today, -7)
  const previousStart = addUtcDays(today, -14)

  const [engagement, revenue, recentContent, topContent] = await Promise.all([
    prisma.engagementMetric.findMany({
      where: { connectedAccountId: account.id, metricDate: { gte: previousStart, lt: today } },
      select: { metricDate: true, views: true, likes: true, comments: true, shares: true, saves: true, engagementRate: true },
    }),
    prisma.revenueMetric.findMany({
      where: { connectedAccountId: account.id, metricDate: { gte: previousStart, lt: today } },
      select: { metricDate: true, estimatedRevenue: true, grossRevenue: true },
    }),
    prisma.contentPerformance.count({
      where: { connectedAccountId: account.id, publishedAt: { gte: previousStart, lt: today } },
    }),
    prisma.contentPerformance.findFirst({
      where: { connectedAccountId: account.id },
      orderBy: { updatedAt: 'desc' },
      select: { title: true },
    }),
  ])

  const currentEngagement = engagement.filter((item) => item.metricDate >= currentStart)
  const previousEngagement = engagement.filter((item) => item.metricDate < currentStart)
  const currentRevenueRows = revenue.filter((item) => item.metricDate >= currentStart)
  const previousRevenueRows = revenue.filter((item) => item.metricDate < currentStart)

  const drafts = buildInsightDrafts({
    accountName: account.displayName,
    provider: account.platform.displayName,
    currentViews: sumBigInt(currentEngagement.map((item) => item.views)),
    previousViews: sumBigInt(previousEngagement.map((item) => item.views)),
    currentRevenue: currentRevenueRows.reduce((total, item) => total + Number(item.estimatedRevenue || item.grossRevenue || 0), 0),
    previousRevenue: previousRevenueRows.reduce((total, item) => total + Number(item.estimatedRevenue || item.grossRevenue || 0), 0),
    currentEngagementRate: avg(currentEngagement.map((item) => Number(item.engagementRate ?? 0)).filter(Boolean)),
    previousEngagementRate: avg(previousEngagement.map((item) => Number(item.engagementRate ?? 0)).filter(Boolean)),
    publishedLast14Days: recentContent,
    topContentTitle: topContent?.title ?? null,
  })

  const expiresAt = addUtcDays(today, 7)
  const created = await Promise.all(
    drafts.map((draft) =>
      prisma.socialAiInsight.create({
        data: {
          companyId: input.companyId,
          creatorProfileId: account.creatorProfileId ?? null,
          connectedAccountId: account.id,
          insightType: draft.insightType,
          severity: draft.severity,
          title: draft.title,
          summary: draft.summary,
          recommendation: draft.recommendation,
          confidence: draft.confidence,
          evidence: toJsonValue(draft.evidence),
          expiresAt,
        },
      })
    )
  )

  await recordIntegrationActivity({
    companyId: input.companyId,
    connectedAccountId: account.id,
    action: 'social.ai_insights.generated',
    metadata: { count: created.length },
  })
  emitCompanyRealtime(input.companyId, 'social_insight_created', { accountId: account.id, count: created.length })
  return created
}
