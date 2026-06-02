import { getProviderDefinition } from '@/modules/integrations/core/provider-config'
import type {
  ProviderAnalyticsResult,
  ProviderContentResult,
  ProviderRequestContext,
  ProviderTokenInput,
  SocialContentItem,
  SocialEngagementMetric,
  SocialProfile,
} from '@/modules/integrations/core/types'
import { OAuth2SocialProvider } from '@/modules/integrations/providers/oauth2.provider'
import { stableHash } from '@/modules/integrations/utils/hash'
import { addUtcDays, startOfUtcDay } from '@/modules/integrations/utils/dates'

type TikTokUserInfoResponse = {
  data?: {
    user?: {
      open_id?: string
      union_id?: string
      avatar_url?: string
      display_name?: string
      username?: string
    }
  }
}

// TikTok Video API v2 — available for all connected creator accounts
type TikTokVideoListResponse = {
  data?: {
    videos?: Array<{
      id: string
      title?: string
      cover_image_url?: string
      share_url?: string
      create_time?: number
      like_count?: number
      comment_count?: number
      share_count?: number
      view_count?: number
      play_count?: number
      duration?: number
    }>
    cursor?: number
    has_more?: boolean
  }
  error?: { code: string; message: string }
}

type TikTokCreatorInfoResponse = {
  data?: {
    creator_avatar_url?: string
    creator_username?: string
    creator_nickname?: string
    profile_deep_link?: string
    is_verified?: boolean
    follower_count?: number
    following_count?: number
    likes_count?: number
    video_count?: number
  }
}

const definition = getProviderDefinition('tiktok')!

function compactDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export class TikTokProvider extends OAuth2SocialProvider {
  constructor() {
    super({
      slug: 'tiktok',
      displayName: definition.displayName,
      authorizationUrl: 'https://www.tiktok.com/v2/auth/authorize/',
      tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
      clientIdEnv: 'TIKTOK_CLIENT_KEY',
      clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
      clientIdParam: 'client_key',
      requiredScopes: definition.requiredScopes,
      optionalScopes: definition.optionalScopes,
      capabilities: definition.capabilities,
    })
  }

  async fetchProfile(input: { tokens: ProviderTokenInput; context: ProviderRequestContext }): Promise<SocialProfile> {
    const payload = await this.getJson<TikTokUserInfoResponse>(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username',
      input
    )
    const user = payload.data?.user
    if (!user?.open_id) throw new Error('No TikTok user was returned for this OAuth grant.')

    return {
      providerAccountId: user.open_id,
      displayName: user.display_name ?? user.username ?? 'TikTok account',
      handle: user.username ?? null,
      avatarUrl: user.avatar_url ?? null,
      accountType: 'CREATOR',
      metadata: { unionId: user.union_id ?? null },
    }
  }

  async fetchAnalytics(input: {
    tokens: ProviderTokenInput
    cursor?: { since?: Date | null; until?: Date | null; cursor?: string | null }
    context: ProviderRequestContext
  }): Promise<ProviderAnalyticsResult> {
    const end = startOfUtcDay(input.cursor?.until ?? new Date())
    const start = startOfUtcDay(input.cursor?.since ?? addUtcDays(end, -30))

    // Fetch video list to aggregate engagement metrics
    const videoPayload = await this.getJson<TikTokVideoListResponse>(
      'https://open.tiktokapis.com/v2/video/list/?fields=id,title,like_count,comment_count,share_count,view_count,play_count,create_time',
      input
    )
    const videos = videoPayload.data?.videos ?? []

    // Aggregate per-day metrics from videos published in the window
    const dayMap = new Map<string, {
      views: number; likes: number; comments: number; shares: number; videoCount: number
    }>()

    for (const v of videos) {
      const ts = v.create_time ? new Date(v.create_time * 1000) : null
      if (!ts || ts < start || ts > end) continue
      const key = compactDate(startOfUtcDay(ts))
      const existing = dayMap.get(key) ?? { views: 0, likes: 0, comments: 0, shares: 0, videoCount: 0 }
      dayMap.set(key, {
        views: existing.views + (v.play_count ?? v.view_count ?? 0),
        likes: existing.likes + (v.like_count ?? 0),
        comments: existing.comments + (v.comment_count ?? 0),
        shares: existing.shares + (v.share_count ?? 0),
        videoCount: existing.videoCount + 1,
      })
    }

    // Also try to get creator-level account stats as a snapshot
    let creatorMeta: Record<string, unknown> = {}
    try {
      const creatorPayload = await this.getJson<TikTokCreatorInfoResponse>(
        'https://open.tiktokapis.com/v2/creator/info/?fields=creator_avatar_url,creator_username,follower_count,following_count,likes_count,video_count',
        input
      )
      creatorMeta = {
        followerCount: creatorPayload.data?.follower_count ?? null,
        followingCount: creatorPayload.data?.following_count ?? null,
        totalLikes: creatorPayload.data?.likes_count ?? null,
        videoCount: creatorPayload.data?.video_count ?? null,
      }
    } catch {
      // Creator Info API requires extra scope — skip gracefully
    }

    const engagement: SocialEngagementMetric[] = []
    for (const [dayStr, agg] of dayMap.entries()) {
      const metricDate = new Date(`${dayStr}T00:00:00.000Z`)
      const total = agg.likes + agg.comments + agg.shares
      engagement.push({
        metricDate,
        granularity: 'day',
        scope: 'account',
        views: agg.views,
        likes: agg.likes,
        comments: agg.comments,
        shares: agg.shares,
        engagementRate: agg.views > 0 ? Number((total / agg.views).toFixed(6)) : null,
        fingerprint: stableHash({ provider: 'tiktok', type: 'engagement', metricDate: dayStr, agg }),
        metadata: { videoCount: agg.videoCount },
      })
    }

    // If no per-day data (all videos outside window or no videos), return totals as single snapshot
    if (engagement.length === 0 && videos.length > 0) {
      const totals = videos.reduce(
        (acc, v) => ({
          views: acc.views + (v.play_count ?? v.view_count ?? 0),
          likes: acc.likes + (v.like_count ?? 0),
          comments: acc.comments + (v.comment_count ?? 0),
          shares: acc.shares + (v.share_count ?? 0),
        }),
        { views: 0, likes: 0, comments: 0, shares: 0 }
      )
      const metricDate = start
      const total = totals.likes + totals.comments + totals.shares
      engagement.push({
        metricDate,
        granularity: 'day',
        scope: 'account',
        views: totals.views,
        likes: totals.likes,
        comments: totals.comments,
        shares: totals.shares,
        engagementRate: totals.views > 0 ? Number((total / totals.views).toFixed(6)) : null,
        fingerprint: stableHash({ provider: 'tiktok', type: 'engagement_totals', start: compactDate(start), totals }),
        metadata: { ...creatorMeta, videoCount: videos.length, aggregatedPeriod: true },
      })
    }

    return {
      engagement,
      snapshots: engagement.map((m) => ({
        metricDate: m.metricDate,
        granularity: m.granularity ?? 'day',
        metrics: {
          views: Number(m.views ?? 0),
          likes: Number(m.likes ?? 0),
          comments: Number(m.comments ?? 0),
          shares: Number(m.shares ?? 0),
          engagementRate: m.engagementRate ?? null,
          ...creatorMeta,
        },
        fingerprint: m.fingerprint,
      })),
      raw: { videos: videos.length, dayBreakdown: Object.fromEntries(dayMap) },
    }
  }

  async fetchContent(input: {
    tokens: ProviderTokenInput
    cursor?: { cursor?: string | null }
    context: ProviderRequestContext
  }): Promise<ProviderContentResult> {
    const params = new URLSearchParams({
      fields: 'id,title,cover_image_url,share_url,create_time,like_count,comment_count,share_count,play_count,duration',
      max_count: '20',
    })
    if (input.cursor?.cursor) params.set('cursor', input.cursor.cursor)

    const payload = await this.getJson<TikTokVideoListResponse>(
      `https://open.tiktokapis.com/v2/video/list/?${params.toString()}`,
      input
    )
    const videos = payload.data?.videos ?? []
    const content: SocialContentItem[] = videos.map((v) => ({
      providerContentId: v.id,
      contentType: 'VIDEO',
      title: v.title ?? 'TikTok video',
      description: null,
      url: v.share_url ?? `https://www.tiktok.com/video/${v.id}`,
      thumbnailUrl: v.cover_image_url ?? null,
      publishedAt: v.create_time ? new Date(v.create_time * 1000) : null,
      metrics: {
        views: v.play_count ?? v.view_count ?? 0,
        likes: v.like_count ?? 0,
        comments: v.comment_count ?? 0,
        shares: v.share_count ?? 0,
        durationSeconds: v.duration ?? null,
      },
    }))

    const nextCursor = payload.data?.has_more && payload.data?.cursor != null
      ? String(payload.data.cursor)
      : null

    return { content, nextCursor, raw: payload }
  }
}
