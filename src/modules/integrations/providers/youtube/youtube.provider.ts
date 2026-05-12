import { OAuth2SocialProvider } from '@/modules/integrations/providers/oauth2.provider'
import type {
  ProviderAnalyticsResult,
  ProviderContentResult,
  ProviderRevenueResult,
  ProviderRequestContext,
  ProviderTokenInput,
  SocialContentItem,
  SocialEngagementMetric,
  SocialProfile,
  SocialRevenueMetric,
} from '@/modules/integrations/core/types'
import { getProviderDefinition } from '@/modules/integrations/core/provider-config'
import { stableHash } from '@/modules/integrations/utils/hash'
import { addUtcDays, startOfUtcDay } from '@/modules/integrations/utils/dates'

type YouTubeChannelsResponse = {
  items?: Array<{
    id: string
    snippet?: {
      title?: string
      customUrl?: string
      thumbnails?: { default?: { url?: string }; high?: { url?: string } }
      publishedAt?: string
    }
    statistics?: Record<string, string>
    contentDetails?: unknown
  }>
}

type YouTubeReportsResponse = {
  columnHeaders?: Array<{ name: string }>
  rows?: Array<Array<string | number>>
}

type YouTubeSearchResponse = {
  nextPageToken?: string
  items?: Array<{
    id?: { videoId?: string }
    snippet?: {
      title?: string
      description?: string
      publishedAt?: string
      thumbnails?: { default?: { url?: string }; high?: { url?: string } }
    }
  }>
}

const definition = getProviderDefinition('youtube')!

function compactDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function rowObject(headers: Array<{ name: string }> | undefined, row: Array<string | number>) {
  const names = headers?.map((header) => header.name) ?? []
  return Object.fromEntries(row.map((value, index) => [names[index] ?? `col_${index}`, value]))
}

export class YouTubeProvider extends OAuth2SocialProvider {
  constructor() {
    super({
      slug: 'youtube',
      displayName: definition.displayName,
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      revokeUrl: 'https://oauth2.googleapis.com/revoke',
      clientIdEnv: ['YOUTUBE_CLIENT_ID', 'GOOGLE_CLIENT_ID'],
      clientSecretEnv: ['YOUTUBE_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET'],
      requiredScopes: definition.requiredScopes,
      optionalScopes: definition.optionalScopes,
      capabilities: definition.capabilities,
      authorizationParams: {
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
      },
    })
  }

  async fetchProfile(input: { tokens: ProviderTokenInput; context: ProviderRequestContext }): Promise<SocialProfile> {
    const payload = await this.getJson<YouTubeChannelsResponse>(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true',
      input
    )
    const channel = payload.items?.[0]
    if (!channel?.id) throw new Error('No YouTube channel was returned for this OAuth grant.')

    return {
      providerAccountId: channel.id,
      displayName: channel.snippet?.title ?? 'YouTube channel',
      handle: channel.snippet?.customUrl ?? null,
      avatarUrl: channel.snippet?.thumbnails?.high?.url ?? channel.snippet?.thumbnails?.default?.url ?? null,
      accountType: 'CHANNEL',
      externalCreatedAt: channel.snippet?.publishedAt ? new Date(channel.snippet.publishedAt) : null,
      metadata: {
        statistics: channel.statistics ?? {},
        contentDetails: channel.contentDetails ?? null,
      },
    }
  }

  async fetchAnalytics(input: {
    tokens: ProviderTokenInput
    cursor?: { since?: Date | null; until?: Date | null; cursor?: string | null }
    context: ProviderRequestContext
  }): Promise<ProviderAnalyticsResult> {
    const end = startOfUtcDay(input.cursor?.until ?? new Date())
    const start = startOfUtcDay(input.cursor?.since ?? addUtcDays(end, -30))
    const params = new URLSearchParams({
      ids: 'channel==MINE',
      startDate: compactDate(start),
      endDate: compactDate(end),
      dimensions: 'day',
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,likes,comments,shares,subscribersGained,subscribersLost',
      sort: 'day',
    })
    const payload = await this.getJson<YouTubeReportsResponse>(`https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`, input)

    const engagement: SocialEngagementMetric[] =
      payload.rows?.map((row) => {
        const record = rowObject(payload.columnHeaders, row)
        const metricDate = new Date(`${String(record.day)}T00:00:00.000Z`)
        const views = Number(record.views ?? 0)
        const likes = Number(record.likes ?? 0)
        const comments = Number(record.comments ?? 0)
        const shares = Number(record.shares ?? 0)
        const impressions = 0
        return {
          metricDate,
          granularity: 'day',
          scope: 'account',
          views,
          impressions,
          likes,
          comments,
          shares,
          watchTimeSeconds: Math.round(Number(record.estimatedMinutesWatched ?? 0) * 60),
          averageViewDuration: Number(record.averageViewDuration ?? 0),
          engagementRate: views > 0 ? Number(((likes + comments + shares) / views).toFixed(6)) : null,
          fingerprint: stableHash({ provider: 'youtube', type: 'engagement', metricDate, record }),
          metadata: {
            subscribersGained: Number(record.subscribersGained ?? 0),
            subscribersLost: Number(record.subscribersLost ?? 0),
          },
        }
      }) ?? []

    return {
      engagement,
      snapshots: engagement.map((metric) => ({
        metricDate: metric.metricDate,
        granularity: 'day',
        metrics: {
          views: Number(metric.views ?? 0),
          likes: Number(metric.likes ?? 0),
          comments: Number(metric.comments ?? 0),
          shares: Number(metric.shares ?? 0),
          watchTimeSeconds: Number(metric.watchTimeSeconds ?? 0),
          averageViewDuration: metric.averageViewDuration ?? null,
          engagementRate: metric.engagementRate ?? null,
        },
        fingerprint: metric.fingerprint,
      })),
      raw: payload,
    }
  }

  async fetchRevenue(input: {
    tokens: ProviderTokenInput
    cursor?: { since?: Date | null; until?: Date | null; cursor?: string | null }
    context: ProviderRequestContext
  }): Promise<ProviderRevenueResult> {
    const end = startOfUtcDay(input.cursor?.until ?? new Date())
    const start = startOfUtcDay(input.cursor?.since ?? addUtcDays(end, -30))
    const params = new URLSearchParams({
      ids: 'channel==MINE',
      startDate: compactDate(start),
      endDate: compactDate(end),
      dimensions: 'day',
      metrics: 'estimatedRevenue,estimatedAdRevenue,grossRevenue,cpm,playbackBasedCpm',
      sort: 'day',
    })
    const payload = await this.getJson<YouTubeReportsResponse>(`https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`, input)
    const revenue: SocialRevenueMetric[] =
      payload.rows?.map((row) => {
        const record = rowObject(payload.columnHeaders, row)
        const metricDate = new Date(`${String(record.day)}T00:00:00.000Z`)
        return {
          metricDate,
          granularity: 'day',
          currency: 'USD',
          grossRevenue: Number(record.grossRevenue ?? 0),
          estimatedRevenue: Number(record.estimatedRevenue ?? 0),
          adRevenue: Number(record.estimatedAdRevenue ?? 0),
          rpm: Number(record.playbackBasedCpm ?? record.cpm ?? 0),
          cpm: Number(record.cpm ?? 0),
          fingerprint: stableHash({ provider: 'youtube', type: 'revenue', metricDate, record }),
          metadata: record,
        }
      }) ?? []

    return { revenue, raw: payload }
  }

  async fetchContent(input: {
    tokens: ProviderTokenInput
    cursor?: { cursor?: string | null }
    context: ProviderRequestContext
  }): Promise<ProviderContentResult> {
    const params = new URLSearchParams({
      part: 'snippet',
      forMine: 'true',
      type: 'video',
      maxResults: '25',
    })
    if (input.cursor?.cursor) params.set('pageToken', input.cursor.cursor)
    const payload = await this.getJson<YouTubeSearchResponse>(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, input)
    const content: SocialContentItem[] =
      payload.items
        ?.filter((item) => item.id?.videoId)
        .map((item) => ({
          providerContentId: item.id!.videoId!,
          contentType: 'VIDEO',
          title: item.snippet?.title ?? 'Untitled video',
          description: item.snippet?.description ?? null,
          url: `https://www.youtube.com/watch?v=${item.id!.videoId}`,
          thumbnailUrl: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
          publishedAt: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : null,
          metrics: {},
        })) ?? []
    return { content, nextCursor: payload.nextPageToken ?? null, raw: payload }
  }
}
