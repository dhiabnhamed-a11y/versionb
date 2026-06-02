import { getProviderDefinition } from '@/modules/integrations/core/provider-config'
import type {
  ProviderAnalyticsResult,
  ProviderContentResult,
  ProviderRequestContext,
  ProviderTokenInput,
  SocialContentItem,
  SocialEngagementMetric,
  SocialProfile,
  SocialProviderSlug,
} from '@/modules/integrations/core/types'
import { OAuth2SocialProvider } from '@/modules/integrations/providers/oauth2.provider'
import { stableHash } from '@/modules/integrations/utils/hash'
import { addUtcDays, startOfUtcDay } from '@/modules/integrations/utils/dates'

type GraphMeResponse = {
  id?: string
  name?: string
  username?: string
  picture?: { data?: { url?: string } }
}

// Meta Graph API Insights — available for Business/Creator Instagram accounts and FB Pages
type GraphInsightsResponse = {
  data?: Array<{
    name: string
    period: string
    values: Array<{ value: number; end_time: string }>
  }>
  error?: { code: number; message: string }
}

type GraphMediaResponse = {
  data?: Array<{
    id: string
    caption?: string
    media_type?: string
    media_url?: string
    thumbnail_url?: string
    permalink?: string
    timestamp?: string
    like_count?: number
    comments_count?: number
  }>
  paging?: { cursors?: { after?: string }; next?: string }
}

type GraphPageInsightsResponse = {
  data?: Array<{
    name: string
    period: string
    values: Array<{ value: number; end_time: string }>
    id: string
  }>
}

function compactDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

// Instagram Business/Creator Analytics metrics available via Graph API v20
const INSTAGRAM_INSIGHT_METRICS = [
  'impressions',
  'reach',
  'profile_views',
  'website_clicks',
  'email_contacts',
  'get_directions_clicks',
  'follower_count',
].join(',')

// Facebook Page metrics available via Graph API v20
const FACEBOOK_PAGE_METRICS = [
  'page_impressions',
  'page_reach',
  'page_engaged_users',
  'page_post_engagements',
  'page_fan_adds_unique',
  'page_views_total',
].join(',')

export class MetaProvider extends OAuth2SocialProvider {
  constructor(slug: Extract<SocialProviderSlug, 'instagram' | 'facebook'>) {
    const definition = getProviderDefinition(slug)!
    super({
      slug,
      displayName: definition.displayName,
      authorizationUrl: 'https://www.facebook.com/v20.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v20.0/oauth/access_token',
      clientIdEnv: slug === 'instagram' ? 'INSTAGRAM_CLIENT_ID' : 'FACEBOOK_CLIENT_ID',
      clientSecretEnv: slug === 'instagram' ? 'INSTAGRAM_CLIENT_SECRET' : 'FACEBOOK_CLIENT_SECRET',
      requiredScopes: definition.requiredScopes,
      optionalScopes: definition.optionalScopes,
      capabilities: definition.capabilities,
    })
  }

  async fetchProfile(input: { tokens: ProviderTokenInput; context: ProviderRequestContext }): Promise<SocialProfile> {
    const payload = await this.getJson<GraphMeResponse>(
      'https://graph.facebook.com/v20.0/me?fields=id,name,picture,username',
      input
    )
    if (!payload.id) throw new Error(`No ${this.displayName} profile was returned for this OAuth grant.`)

    return {
      providerAccountId: payload.id,
      displayName: payload.name ?? payload.username ?? `${this.displayName} account`,
      handle: payload.username ?? null,
      avatarUrl: payload.picture?.data?.url ?? null,
      accountType: this.slug === 'instagram' ? 'BUSINESS_OR_CREATOR' : 'PAGE_OR_PROFILE',
      metadata: { graphApiVersion: 'v20.0' },
    }
  }

  async fetchAnalytics(input: {
    tokens: ProviderTokenInput
    cursor?: { since?: Date | null; until?: Date | null; cursor?: string | null }
    context: ProviderRequestContext
  }): Promise<ProviderAnalyticsResult> {
    const end = startOfUtcDay(input.cursor?.until ?? new Date())
    const start = startOfUtcDay(input.cursor?.since ?? addUtcDays(end, -30))

    if (this.slug === 'instagram') {
      return this.fetchInstagramAnalytics(input.tokens, input.context, start, end)
    }
    return this.fetchFacebookAnalytics(input.tokens, input.context, start, end)
  }

  private async fetchInstagramAnalytics(
    tokens: ProviderTokenInput,
    context: ProviderRequestContext,
    start: Date,
    end: Date
  ): Promise<ProviderAnalyticsResult> {
    // Get connected Instagram Business Account
    const profile = await this.getJson<GraphMeResponse>(
      'https://graph.facebook.com/v20.0/me?fields=id,name',
      { tokens, context }
    )
    const accountId = profile.id
    if (!accountId) return { engagement: [], snapshots: [], raw: {} }

    const since = Math.floor(start.getTime() / 1000)
    const until = Math.floor(end.getTime() / 1000)

    const insightUrl = `https://graph.facebook.com/v20.0/${accountId}/insights?` +
      `metric=${INSTAGRAM_INSIGHT_METRICS}&period=day&since=${since}&until=${until}`

    let insightData: GraphInsightsResponse = {}
    try {
      insightData = await this.getJson<GraphInsightsResponse>(insightUrl, { tokens, context })
    } catch {
      // Account may be personal (not Business/Creator) — insights not available
      return { engagement: [], snapshots: [], raw: { note: 'Instagram Insights require a Business or Creator account' } }
    }

    const metricsMap = new Map<string, Record<string, number>>()
    for (const metric of insightData.data ?? []) {
      for (const point of metric.values ?? []) {
        const dayKey = compactDate(new Date(point.end_time))
        const existing = metricsMap.get(dayKey) ?? {}
        metricsMap.set(dayKey, { ...existing, [metric.name]: point.value })
      }
    }

    const engagement: SocialEngagementMetric[] = []
    for (const [dayStr, metrics] of metricsMap.entries()) {
      const metricDate = new Date(`${dayStr}T00:00:00.000Z`)
      const impressions = metrics.impressions ?? 0
      const reach = metrics.reach ?? 0
      engagement.push({
        metricDate,
        granularity: 'day',
        scope: 'account',
        impressions,
        views: reach,
        engagementRate: impressions > 0
          ? Number(((metrics.profile_views ?? 0) / impressions).toFixed(6))
          : null,
        fingerprint: stableHash({ provider: 'instagram', type: 'insights', metricDate: dayStr, metrics }),
        metadata: {
          profileViews: metrics.profile_views ?? 0,
          websiteClicks: metrics.website_clicks ?? 0,
          emailContacts: metrics.email_contacts ?? 0,
          followerCount: metrics.follower_count ?? null,
        },
      })
    }

    return {
      engagement,
      snapshots: engagement.map((m) => ({
        metricDate: m.metricDate,
        granularity: 'day',
        metrics: {
          impressions: Number(m.impressions ?? 0),
          reach: Number(m.views ?? 0),
          engagementRate: m.engagementRate ?? null,
          ...(m.metadata ?? {}),
        },
        fingerprint: m.fingerprint,
      })),
      raw: { insightMetrics: metricsMap.size },
    }
  }

  private async fetchFacebookAnalytics(
    tokens: ProviderTokenInput,
    context: ProviderRequestContext,
    start: Date,
    end: Date
  ): Promise<ProviderAnalyticsResult> {
    const profile = await this.getJson<GraphMeResponse>(
      'https://graph.facebook.com/v20.0/me?fields=id',
      { tokens, context }
    )
    const pageId = profile.id
    if (!pageId) return { engagement: [], snapshots: [], raw: {} }

    const since = Math.floor(start.getTime() / 1000)
    const until = Math.floor(end.getTime() / 1000)
    const insightUrl = `https://graph.facebook.com/v20.0/${pageId}/insights?` +
      `metric=${FACEBOOK_PAGE_METRICS}&period=day&since=${since}&until=${until}`

    let insightData: GraphPageInsightsResponse = {}
    try {
      insightData = await this.getJson<GraphPageInsightsResponse>(insightUrl, { tokens, context })
    } catch {
      return { engagement: [], snapshots: [], raw: { note: 'Facebook Page Insights require Page admin access' } }
    }

    const metricsMap = new Map<string, Record<string, number>>()
    for (const metric of insightData.data ?? []) {
      for (const point of metric.values ?? []) {
        const dayKey = compactDate(new Date(point.end_time))
        const existing = metricsMap.get(dayKey) ?? {}
        metricsMap.set(dayKey, { ...existing, [metric.name]: point.value })
      }
    }

    const engagement: SocialEngagementMetric[] = []
    for (const [dayStr, metrics] of metricsMap.entries()) {
      const metricDate = new Date(`${dayStr}T00:00:00.000Z`)
      const impressions = metrics.page_impressions ?? 0
      const reach = metrics.page_reach ?? 0
      const engagements = metrics.page_post_engagements ?? 0
      engagement.push({
        metricDate,
        granularity: 'day',
        scope: 'account',
        impressions,
        views: reach,
        engagementRate: impressions > 0 ? Number((engagements / impressions).toFixed(6)) : null,
        fingerprint: stableHash({ provider: 'facebook', type: 'page_insights', metricDate: dayStr, metrics }),
        metadata: {
          engagedUsers: metrics.page_engaged_users ?? 0,
          fanAddsUnique: metrics.page_fan_adds_unique ?? 0,
          pageViewsTotal: metrics.page_views_total ?? 0,
        },
      })
    }

    return {
      engagement,
      snapshots: engagement.map((m) => ({
        metricDate: m.metricDate,
        granularity: 'day',
        metrics: {
          impressions: Number(m.impressions ?? 0),
          reach: Number(m.views ?? 0),
          engagementRate: m.engagementRate ?? null,
          ...(m.metadata ?? {}),
        },
        fingerprint: m.fingerprint,
      })),
      raw: { insightMetrics: metricsMap.size },
    }
  }

  async fetchContent(input: {
    tokens: ProviderTokenInput
    cursor?: { cursor?: string | null }
    context: ProviderRequestContext
  }): Promise<ProviderContentResult> {
    if (this.slug !== 'instagram') {
      // Facebook page posts via Graph API
      const profile = await this.getJson<GraphMeResponse>('https://graph.facebook.com/v20.0/me?fields=id', { tokens: input.tokens, context: input.context })
      const pageId = profile.id
      if (!pageId) return { content: [], nextCursor: null, raw: {} }

      const params = new URLSearchParams({ fields: 'id,message,story,full_picture,permalink_url,created_time,reactions.summary(total_count),comments.summary(total_count)', limit: '20' })
      if (input.cursor?.cursor) params.set('after', input.cursor.cursor)
      const payload = await this.getJson<{ data?: any[]; paging?: any }>(
        `https://graph.facebook.com/v20.0/${pageId}/posts?${params.toString()}`,
        { tokens: input.tokens, context: input.context }
      )
      const posts = payload.data ?? []
      const content: SocialContentItem[] = posts.map((p: any) => ({
        providerContentId: p.id,
        contentType: 'POST',
        title: p.message?.slice(0, 100) ?? p.story ?? 'Facebook post',
        description: p.message ?? null,
        url: p.permalink_url ?? `https://www.facebook.com/${p.id}`,
        thumbnailUrl: p.full_picture ?? null,
        publishedAt: p.created_time ? new Date(p.created_time) : null,
        metrics: {
          likes: p.reactions?.summary?.total_count ?? 0,
          comments: p.comments?.summary?.total_count ?? 0,
        },
      }))
      return { content, nextCursor: payload.paging?.cursors?.after ?? null, raw: payload }
    }

    // Instagram media
    const profile = await this.getJson<GraphMeResponse>('https://graph.facebook.com/v20.0/me?fields=id', { tokens: input.tokens, context: input.context })
    const accountId = profile.id
    if (!accountId) return { content: [], nextCursor: null, raw: {} }

    const params = new URLSearchParams({
      fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
      limit: '20',
    })
    if (input.cursor?.cursor) params.set('after', input.cursor.cursor)

    const payload = await this.getJson<GraphMediaResponse>(
      `https://graph.facebook.com/v20.0/${accountId}/media?${params.toString()}`,
      { tokens: input.tokens, context: input.context }
    )
    const media = payload.data ?? []
    const content: SocialContentItem[] = media.map((m) => ({
      providerContentId: m.id,
      contentType: m.media_type === 'VIDEO' ? 'VIDEO' : 'IMAGE',
      title: m.caption?.slice(0, 100) ?? 'Instagram post',
      description: m.caption ?? null,
      url: m.permalink ?? `https://www.instagram.com/p/${m.id}`,
      thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
      publishedAt: m.timestamp ? new Date(m.timestamp) : null,
      metrics: {
        likes: m.like_count ?? 0,
        comments: m.comments_count ?? 0,
      },
    }))

    return { content, nextCursor: payload.paging?.cursors?.after ?? null, raw: payload }
  }
}
