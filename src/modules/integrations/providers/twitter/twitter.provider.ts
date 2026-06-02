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

type TwitterMeResponse = {
  data?: {
    id: string
    name?: string
    username?: string
    profile_image_url?: string
    created_at?: string
    public_metrics?: {
      followers_count?: number
      following_count?: number
      tweet_count?: number
      listed_count?: number
    }
  }
}

type TwitterTweetsResponse = {
  data?: Array<{
    id: string
    text: string
    created_at?: string
    public_metrics?: {
      retweet_count?: number
      reply_count?: number
      like_count?: number
      quote_count?: number
      impression_count?: number
      bookmark_count?: number
    }
    attachments?: { media_keys?: string[] }
    note_tweet?: { text: string }
  }>
  meta?: {
    newest_id?: string
    oldest_id?: string
    result_count?: number
    next_token?: string
  }
}

const definition = getProviderDefinition('twitter')!

function compactDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export class TwitterProvider extends OAuth2SocialProvider {
  constructor() {
    super({
      slug: 'twitter',
      displayName: definition.displayName,
      authorizationUrl: 'https://twitter.com/i/oauth2/authorize',
      tokenUrl: 'https://api.twitter.com/2/oauth2/token',
      clientIdEnv: 'TWITTER_CLIENT_ID',
      clientSecretEnv: 'TWITTER_CLIENT_SECRET',
      tokenAuth: 'basic',
      requiredScopes: definition.requiredScopes,
      optionalScopes: definition.optionalScopes,
      capabilities: definition.capabilities,
    })
  }

  async fetchProfile(input: { tokens: ProviderTokenInput; context: ProviderRequestContext }): Promise<SocialProfile> {
    const payload = await this.getJson<TwitterMeResponse>(
      'https://api.twitter.com/2/users/me?user.fields=profile_image_url,username,public_metrics,created_at',
      input
    )
    const user = payload.data
    if (!user?.id) throw new Error('No X/Twitter user was returned for this OAuth grant.')

    return {
      providerAccountId: user.id,
      displayName: user.name ?? user.username ?? 'X account',
      handle: user.username ?? null,
      avatarUrl: user.profile_image_url ?? null,
      accountType: 'PROFILE',
      externalCreatedAt: user.created_at ? new Date(user.created_at) : null,
      metadata: { publicMetrics: user.public_metrics ?? {} },
    }
  }

  async fetchAnalytics(input: {
    tokens: ProviderTokenInput
    cursor?: { since?: Date | null; until?: Date | null; cursor?: string | null }
    context: ProviderRequestContext
  }): Promise<ProviderAnalyticsResult> {
    const end = startOfUtcDay(input.cursor?.until ?? new Date())
    const start = startOfUtcDay(input.cursor?.since ?? addUtcDays(end, -30))

    // Get user ID and follower count first
    const profilePayload = await this.getJson<TwitterMeResponse>(
      'https://api.twitter.com/2/users/me?user.fields=public_metrics',
      { tokens: input.tokens, context: input.context }
    )
    const userId = profilePayload.data?.id
    const publicMetrics = profilePayload.data?.public_metrics ?? {}

    if (!userId) return { engagement: [], snapshots: [], raw: {} }

    // Fetch tweets in the window with public_metrics (requires tweet.read scope)
    const params = new URLSearchParams({
      'tweet.fields': 'created_at,public_metrics',
      'max_results': '100',
      'start_time': start.toISOString(),
      'end_time': end.toISOString(),
    })
    if (input.cursor?.cursor) params.set('pagination_token', input.cursor.cursor)

    let tweetsPayload: TwitterTweetsResponse = {}
    try {
      tweetsPayload = await this.getJson<TwitterTweetsResponse>(
        `https://api.twitter.com/2/users/${userId}/tweets?${params.toString()}`,
        { tokens: input.tokens, context: input.context }
      )
    } catch {
      // tweet.read may not be granted — return follower snapshot only
    }

    const tweets = tweetsPayload.data ?? []

    // Aggregate metrics per day
    const dayMap = new Map<string, {
      impressions: number; likes: number; retweets: number; replies: number; quotes: number; tweetCount: number
    }>()

    for (const tweet of tweets) {
      const ts = tweet.created_at ? new Date(tweet.created_at) : null
      if (!ts) continue
      const dayKey = compactDate(startOfUtcDay(ts))
      const m = tweet.public_metrics ?? {}
      const existing = dayMap.get(dayKey) ?? { impressions: 0, likes: 0, retweets: 0, replies: 0, quotes: 0, tweetCount: 0 }
      dayMap.set(dayKey, {
        impressions: existing.impressions + (m.impression_count ?? 0),
        likes: existing.likes + (m.like_count ?? 0),
        retweets: existing.retweets + (m.retweet_count ?? 0),
        replies: existing.replies + (m.reply_count ?? 0),
        quotes: existing.quotes + (m.quote_count ?? 0),
        tweetCount: existing.tweetCount + 1,
      })
    }

    const engagement: SocialEngagementMetric[] = []
    for (const [dayStr, agg] of dayMap.entries()) {
      const metricDate = new Date(`${dayStr}T00:00:00.000Z`)
      const impressions = agg.impressions
      const total = agg.likes + agg.retweets + agg.replies + agg.quotes
      engagement.push({
        metricDate,
        granularity: 'day',
        scope: 'account',
        impressions,
        likes: agg.likes,
        shares: agg.retweets,
        comments: agg.replies,
        engagementRate: impressions > 0 ? Number((total / impressions).toFixed(6)) : null,
        fingerprint: stableHash({ provider: 'twitter', type: 'tweets', metricDate: dayStr, agg }),
        metadata: { tweetCount: agg.tweetCount, quotes: agg.quotes },
      })
    }

    // Add a follower-count snapshot for today even if no tweets
    const todayKey = compactDate(startOfUtcDay(new Date()))
    if (!dayMap.has(todayKey) && publicMetrics.followers_count != null) {
      const metricDate = new Date(`${todayKey}T00:00:00.000Z`)
      engagement.push({
        metricDate,
        granularity: 'day',
        scope: 'account',
        impressions: 0,
        fingerprint: stableHash({ provider: 'twitter', type: 'follower_snapshot', metricDate: todayKey, publicMetrics }),
        metadata: {
          followersCount: publicMetrics.followers_count ?? null,
          followingCount: publicMetrics.following_count ?? null,
          tweetCount: publicMetrics.tweet_count ?? null,
          listedCount: publicMetrics.listed_count ?? null,
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
          likes: Number(m.likes ?? 0),
          retweets: Number(m.shares ?? 0),
          replies: Number(m.comments ?? 0),
          engagementRate: m.engagementRate ?? null,
          ...(m.metadata ?? {}),
        },
        fingerprint: m.fingerprint,
      })),
      raw: { tweetCount: tweets.length, nextToken: tweetsPayload.meta?.next_token },
    }
  }

  async fetchContent(input: {
    tokens: ProviderTokenInput
    cursor?: { cursor?: string | null }
    context: ProviderRequestContext
  }): Promise<ProviderContentResult> {
    const profilePayload = await this.getJson<TwitterMeResponse>(
      'https://api.twitter.com/2/users/me?user.fields=id',
      { tokens: input.tokens, context: input.context }
    )
    const userId = profilePayload.data?.id
    if (!userId) return { content: [], nextCursor: null, raw: {} }

    const params = new URLSearchParams({
      'tweet.fields': 'created_at,public_metrics,text',
      'max_results': '25',
    })
    if (input.cursor?.cursor) params.set('pagination_token', input.cursor.cursor)

    const payload = await this.getJson<TwitterTweetsResponse>(
      `https://api.twitter.com/2/users/${userId}/tweets?${params.toString()}`,
      { tokens: input.tokens, context: input.context }
    )

    const tweets = payload.data ?? []
    const content: SocialContentItem[] = tweets.map((t) => ({
      providerContentId: t.id,
      contentType: 'POST',
      title: t.text.slice(0, 100),
      description: t.text,
      url: `https://x.com/i/web/status/${t.id}`,
      thumbnailUrl: null,
      publishedAt: t.created_at ? new Date(t.created_at) : null,
      metrics: {
        impressions: t.public_metrics?.impression_count ?? 0,
        likes: t.public_metrics?.like_count ?? 0,
        retweets: t.public_metrics?.retweet_count ?? 0,
        replies: t.public_metrics?.reply_count ?? 0,
        bookmarks: t.public_metrics?.bookmark_count ?? 0,
      },
    }))

    return { content, nextCursor: payload.meta?.next_token ?? null, raw: payload }
  }
}
