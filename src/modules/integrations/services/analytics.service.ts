import { prisma } from '@/lib/db'
import type { SessionUser } from '@/modules/shared/session'
import { assertCanReadIntegrations, requireIntegrationCompany } from '@/modules/integrations/security/rbac'
import type { AnalyticsQueryInput } from '@/modules/integrations/services/integration.validation'
import { getCachedJson, setCachedJson } from '@/modules/integrations/cache/integration-cache'
import { addUtcDays, startOfUtcDay } from '@/modules/integrations/utils/dates'

function number(value: unknown) {
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && typeof value.toString === 'function') return Number(value.toString())
  return Number(value ?? 0) || 0
}

function dayKey(date: Date) {
  return startOfUtcDay(date).toISOString().slice(0, 10)
}

function compactAccount(account: {
  id: string
  platformSlug: string
  displayName: string
  handle: string | null
  avatarUrl: string | null
  status: string
  healthStatus: string
  lastSyncAt: Date | null
  updatedAt: Date
  platform: { displayName: string }
  creatorProfile: { id: string; displayName: string; avatarUrl: string | null; status: string } | null
}) {
  return {
    id: account.id,
    platform: account.platformSlug,
    platformName: account.platform.displayName,
    displayName: account.displayName,
    handle: account.handle,
    avatarUrl: account.avatarUrl,
    status: account.status,
    healthStatus: account.healthStatus,
    lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
    updatedAt: account.updatedAt.toISOString(),
    creator: account.creatorProfile,
  }
}

export async function getSocialAnalyticsDashboard(user: SessionUser, query: AnalyticsQueryInput) {
  assertCanReadIntegrations(user)
  const companyId = requireIntegrationCompany(user)
  const cacheKey = `dashboard:${companyId}:${query.provider ?? 'all'}:${query.days}`
  const cached = await getCachedJson<unknown>(cacheKey)
  if (cached) return cached

  const end = startOfUtcDay(addUtcDays(new Date(), 1))
  const start = addUtcDays(end, -query.days)
  const providerWhere = query.provider ? { platformSlug: query.provider } : {}

  const [accounts, engagementRows, revenueRows, audienceRows, realtimeRows, contentRows, insights, syncJobs, creators] =
    await Promise.all([
      prisma.connectedAccount.findMany({
        where: { companyId, status: { not: 'DISCONNECTED' }, ...providerWhere },
        select: {
          id: true,
          platformSlug: true,
          displayName: true,
          handle: true,
          avatarUrl: true,
          status: true,
          healthStatus: true,
          lastSyncAt: true,
          updatedAt: true,
          platform: { select: { displayName: true } },
          creatorProfile: { select: { id: true, displayName: true, avatarUrl: true, status: true } },
        },
        orderBy: [{ platformSlug: 'asc' }, { displayName: 'asc' }],
      }),
      prisma.engagementMetric.findMany({
        where: { companyId, metricDate: { gte: start, lt: end }, ...providerWhere },
        select: {
          metricDate: true,
          platformSlug: true,
          connectedAccountId: true,
          views: true,
          impressions: true,
          likes: true,
          comments: true,
          shares: true,
          saves: true,
          clicks: true,
          watchTimeSeconds: true,
          engagementRate: true,
          retentionRate: true,
          ctr: true,
        },
      }),
      prisma.revenueMetric.findMany({
        where: { companyId, metricDate: { gte: start, lt: end }, ...providerWhere },
        select: {
          metricDate: true,
          platformSlug: true,
          connectedAccountId: true,
          currency: true,
          grossRevenue: true,
          estimatedRevenue: true,
          adRevenue: true,
          subscriptionRevenue: true,
          affiliateRevenue: true,
          rpm: true,
          cpm: true,
        },
      }),
      prisma.audienceDemographic.findMany({
        where: { companyId, metricDate: { gte: start, lt: end }, ...providerWhere },
        select: {
          platformSlug: true,
          dimension: true,
          segment: true,
          value: true,
          percentage: true,
          metricDate: true,
        },
        orderBy: [{ metricDate: 'desc' }],
        take: 100,
      }),
      prisma.realtimeMetric.findMany({
        where: { companyId, observedAt: { gte: addUtcDays(new Date(), -2) }, ...providerWhere },
        select: { platformSlug: true, metricKey: true, value: true, unit: true, observedAt: true, connectedAccountId: true },
        orderBy: { observedAt: 'desc' },
        take: 80,
      }),
      prisma.contentPerformance.findMany({
        where: { companyId, ...providerWhere },
        select: {
          id: true,
          connectedAccountId: true,
          platformSlug: true,
          providerContentId: true,
          contentType: true,
          title: true,
          url: true,
          thumbnailUrl: true,
          publishedAt: true,
          metrics: true,
          revenue: true,
          lastSyncedAt: true,
        },
        orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        take: 50,
      }),
      prisma.socialAiInsight.findMany({
        where: { companyId, status: 'OPEN', ...(query.provider ? { connectedAccount: { platformSlug: query.provider } } : {}) },
        select: {
          id: true,
          connectedAccountId: true,
          insightType: true,
          severity: true,
          title: true,
          summary: true,
          recommendation: true,
          confidence: true,
          generatedAt: true,
          evidence: true,
        },
        orderBy: { generatedAt: 'desc' },
        take: 20,
      }),
      prisma.socialSyncJob.findMany({
        where: { companyId, ...(query.provider ? { providerSlug: query.provider } : {}) },
        select: {
          id: true,
          connectedAccountId: true,
          providerSlug: true,
          jobType: true,
          status: true,
          attempts: true,
          maxAttempts: true,
          scheduledFor: true,
          startedAt: true,
          completedAt: true,
          error: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.creatorProfile.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          status: true,
          connectedAccounts: {
            where: { status: { not: 'DISCONNECTED' }, ...(query.provider ? { platformSlug: query.provider } : {}) },
            select: { id: true, platformSlug: true, displayName: true, healthStatus: true },
          },
        },
        orderBy: { displayName: 'asc' },
        take: 50,
      }),
    ])

  const seriesMap = new Map<string, { date: string; views: number; impressions: number; engagement: number; revenue: number }>()
  for (let cursor = start; cursor < end; cursor = addUtcDays(cursor, 1)) {
    const key = dayKey(cursor)
    seriesMap.set(key, { date: key, views: 0, impressions: 0, engagement: 0, revenue: 0 })
  }

  const platformMap = new Map<string, { platform: string; views: number; impressions: number; engagementActions: number; revenue: number }>()
  for (const row of engagementRows) {
    const key = dayKey(row.metricDate)
    const series = seriesMap.get(key)
    const views = number(row.views)
    const impressions = number(row.impressions)
    const actions = number(row.likes) + number(row.comments) + number(row.shares) + number(row.saves) + number(row.clicks)
    if (series) {
      series.views += views
      series.impressions += impressions
      series.engagement += actions
    }
    const platform = platformMap.get(row.platformSlug) ?? { platform: row.platformSlug, views: 0, impressions: 0, engagementActions: 0, revenue: 0 }
    platform.views += views
    platform.impressions += impressions
    platform.engagementActions += actions
    platformMap.set(row.platformSlug, platform)
  }

  for (const row of revenueRows) {
    const amount = number(row.estimatedRevenue) || number(row.grossRevenue)
    const series = seriesMap.get(dayKey(row.metricDate))
    if (series) series.revenue += amount
    const platform = platformMap.get(row.platformSlug) ?? { platform: row.platformSlug, views: 0, impressions: 0, engagementActions: 0, revenue: 0 }
    platform.revenue += amount
    platformMap.set(row.platformSlug, platform)
  }

  const totals = {
    connectedAccounts: accounts.length,
    creators: creators.length,
    contentItems: contentRows.length,
    views: engagementRows.reduce((total, row) => total + number(row.views), 0),
    impressions: engagementRows.reduce((total, row) => total + number(row.impressions), 0),
    engagementActions: engagementRows.reduce(
      (total, row) => total + number(row.likes) + number(row.comments) + number(row.shares) + number(row.saves) + number(row.clicks),
      0
    ),
    watchTimeSeconds: engagementRows.reduce((total, row) => total + number(row.watchTimeSeconds), 0),
    revenue: revenueRows.reduce((total, row) => total + (number(row.estimatedRevenue) || number(row.grossRevenue)), 0),
    openInsights: insights.length,
  }

  const dashboard = {
    generatedAt: new Date().toISOString(),
    range: { start: start.toISOString(), end: end.toISOString(), days: query.days },
    totals: {
      ...totals,
      engagementRate: totals.views > 0 ? totals.engagementActions / totals.views : 0,
      revenuePerMille: totals.views > 0 ? (totals.revenue / totals.views) * 1000 : 0,
    },
    accounts: accounts.map(compactAccount),
    creators: creators.map((creator) => ({
      ...creator,
      accountCount: creator.connectedAccounts.length,
    })),
    growthSeries: Array.from(seriesMap.values()),
    platformBreakdown: Array.from(platformMap.values()).map((item) => ({
      ...item,
      engagementRate: item.views > 0 ? item.engagementActions / item.views : 0,
    })),
    audience: audienceRows.map((row) => ({
      platform: row.platformSlug,
      dimension: row.dimension,
      segment: row.segment,
      value: number(row.value),
      percentage: row.percentage === null ? null : number(row.percentage),
      metricDate: row.metricDate.toISOString(),
    })),
    realtime: realtimeRows.map((row) => ({
      platform: row.platformSlug,
      accountId: row.connectedAccountId,
      metricKey: row.metricKey,
      value: number(row.value),
      unit: row.unit,
      observedAt: row.observedAt.toISOString(),
    })),
    content: contentRows.map((row) => ({
      id: row.id,
      accountId: row.connectedAccountId,
      platform: row.platformSlug,
      providerContentId: row.providerContentId,
      contentType: row.contentType,
      title: row.title,
      url: row.url,
      thumbnailUrl: row.thumbnailUrl,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      metrics: row.metrics,
      revenue: row.revenue,
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    })),
    insights: insights.map((insight) => ({
      ...insight,
      generatedAt: insight.generatedAt.toISOString(),
    })),
    syncHealth: syncJobs.map((job) => ({
      ...job,
      scheduledFor: job.scheduledFor.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
    })),
  }

  await setCachedJson(cacheKey, dashboard, 60)
  return dashboard
}
