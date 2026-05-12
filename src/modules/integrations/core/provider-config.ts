import type { SocialProviderCapabilityMap, SocialProviderSlug } from '@/modules/integrations/core/types'

export type ProviderDefinition = {
  slug: SocialProviderSlug
  displayName: string
  category: string
  requiredScopes: string[]
  optionalScopes: string[]
  capabilities: SocialProviderCapabilityMap
}

const fullReadCapabilities = {
  profile: true,
  analytics: true,
  revenue: false,
  content: true,
  realtime: true,
  webhooks: true,
} satisfies SocialProviderCapabilityMap

export const SOCIAL_PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    slug: 'youtube',
    displayName: 'YouTube',
    category: 'video',
    requiredScopes: ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/yt-analytics.readonly'],
    optionalScopes: ['https://www.googleapis.com/auth/yt-analytics-monetary.readonly'],
    capabilities: { ...fullReadCapabilities, revenue: true },
  },
  {
    slug: 'spotify',
    displayName: 'Spotify',
    category: 'audio',
    requiredScopes: ['user-read-private', 'user-read-email'],
    optionalScopes: ['user-top-read'],
    capabilities: { profile: true, analytics: true, revenue: false, content: true, realtime: false, webhooks: false },
  },
  {
    slug: 'tiktok',
    displayName: 'TikTok',
    category: 'short_video',
    requiredScopes: ['user.info.basic', 'video.list'],
    optionalScopes: ['video.insights'],
    capabilities: fullReadCapabilities,
  },
  {
    slug: 'instagram',
    displayName: 'Instagram',
    category: 'social',
    requiredScopes: ['instagram_basic', 'pages_show_list'],
    optionalScopes: ['instagram_manage_insights'],
    capabilities: fullReadCapabilities,
  },
  {
    slug: 'facebook',
    displayName: 'Facebook',
    category: 'social',
    requiredScopes: ['public_profile', 'pages_show_list'],
    optionalScopes: ['read_insights'],
    capabilities: fullReadCapabilities,
  },
  {
    slug: 'twitter',
    displayName: 'X / Twitter',
    category: 'social',
    requiredScopes: ['tweet.read', 'users.read', 'offline.access'],
    optionalScopes: ['follows.read'],
    capabilities: fullReadCapabilities,
  },
  {
    slug: 'twitch',
    displayName: 'Twitch',
    category: 'streaming',
    requiredScopes: ['user:read:email', 'analytics:read:games', 'analytics:read:extensions'],
    optionalScopes: ['channel:read:subscriptions'],
    capabilities: { ...fullReadCapabilities, revenue: true },
  },
  {
    slug: 'linkedin',
    displayName: 'LinkedIn',
    category: 'professional',
    requiredScopes: ['openid', 'profile', 'email'],
    optionalScopes: ['w_member_social'],
    capabilities: { profile: true, analytics: true, revenue: false, content: true, realtime: false, webhooks: true },
  },
]

export function getProviderDefinition(slug: SocialProviderSlug) {
  return SOCIAL_PROVIDER_DEFINITIONS.find((provider) => provider.slug === slug)
}
