import { capabilityUnavailable } from '@/modules/integrations/core/errors'
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

type SpotifyMeResponse = {
  id: string
  display_name?: string
  email?: string
  images?: Array<{ url?: string }>
  external_urls?: { spotify?: string }
  followers?: { total?: number }
}

type SpotifyTopTracksResponse = {
  items?: Array<{
    id: string
    name: string
    duration_ms?: number
    popularity?: number
    external_urls?: { spotify?: string }
    album?: { images?: Array<{ url?: string }>; release_date?: string }
  }>
}

type SpotifyPartnerAnalyticsResponse = {
  streams?: Array<{ date: string; streams: number; saves?: number; listeners?: number }>
  audience?: unknown
}

const definition = getProviderDefinition('spotify')!

export class SpotifyProvider extends OAuth2SocialProvider {
  constructor() {
    super({
      slug: 'spotify',
      displayName: definition.displayName,
      authorizationUrl: 'https://accounts.spotify.com/authorize',
      tokenUrl: 'https://accounts.spotify.com/api/token',
      clientIdEnv: 'SPOTIFY_CLIENT_ID',
      clientSecretEnv: 'SPOTIFY_CLIENT_SECRET',
      tokenAuth: 'basic',
      requiredScopes: definition.requiredScopes,
      optionalScopes: definition.optionalScopes,
      capabilities: definition.capabilities,
    })
  }

  async fetchProfile(input: { tokens: ProviderTokenInput; context: ProviderRequestContext }): Promise<SocialProfile> {
    const payload = await this.getJson<SpotifyMeResponse>('https://api.spotify.com/v1/me', input)
    return {
      providerAccountId: payload.id,
      displayName: payload.display_name ?? payload.email ?? 'Spotify account',
      handle: payload.external_urls?.spotify ?? null,
      avatarUrl: payload.images?.[0]?.url ?? null,
      accountType: 'ARTIST_OR_USER',
      metadata: {
        email: payload.email ?? null,
        followers: payload.followers?.total ?? null,
        spotifyUrl: payload.external_urls?.spotify ?? null,
      },
    }
  }

  async fetchContent(input: { tokens: ProviderTokenInput; context: ProviderRequestContext }): Promise<ProviderContentResult> {
    const payload = await this.getJson<SpotifyTopTracksResponse>('https://api.spotify.com/v1/me/top/tracks?limit=25&time_range=medium_term', input)
    const content: SocialContentItem[] =
      payload.items?.map((track) => ({
        providerContentId: track.id,
        contentType: 'TRACK',
        title: track.name,
        url: track.external_urls?.spotify ?? null,
        thumbnailUrl: track.album?.images?.[0]?.url ?? null,
        publishedAt: track.album?.release_date ? new Date(track.album.release_date) : null,
        durationSeconds: track.duration_ms ? Math.round(track.duration_ms / 1000) : null,
        metrics: { popularity: track.popularity ?? null },
      })) ?? []
    return { content, raw: payload }
  }

  async fetchAnalytics(input: { tokens: ProviderTokenInput; context: ProviderRequestContext }): Promise<ProviderAnalyticsResult> {
    const analyticsBaseUrl = process.env.SPOTIFY_ANALYTICS_API_BASE_URL
    if (!analyticsBaseUrl) {
      throw capabilityUnavailable('spotify', 'artist analytics', {
        required: 'Configure SPOTIFY_ANALYTICS_API_BASE_URL for a Spotify for Artists or approved partner analytics proxy.',
      })
    }

    const payload = await this.getJson<SpotifyPartnerAnalyticsResponse>(`${analyticsBaseUrl.replace(/\/$/, '')}/analytics`, input)
    const engagement: SocialEngagementMetric[] =
      payload.streams?.map((row) => ({
        metricDate: new Date(`${row.date}T00:00:00.000Z`),
        granularity: 'day',
        scope: 'account',
        views: row.streams,
        saves: row.saves ?? 0,
        impressions: row.listeners ?? 0,
        fingerprint: stableHash({ provider: 'spotify', row }),
        metadata: { listeners: row.listeners ?? null },
      })) ?? []

    return {
      engagement,
      snapshots: engagement.map((metric) => ({
        metricDate: metric.metricDate,
        granularity: 'day',
        metrics: {
          streams: Number(metric.views ?? 0),
          saves: Number(metric.saves ?? 0),
          listeners: Number(metric.impressions ?? 0),
        },
        fingerprint: metric.fingerprint,
      })),
      raw: payload,
    }
  }
}
