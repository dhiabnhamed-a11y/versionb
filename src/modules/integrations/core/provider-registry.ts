import { badRequest } from '@/modules/shared/errors'
import { SOCIAL_PROVIDER_SLUGS, type SocialProvider, type SocialProviderSlug } from '@/modules/integrations/core/types'
import { YouTubeProvider } from '@/modules/integrations/providers/youtube/youtube.provider'
import { SpotifyProvider } from '@/modules/integrations/providers/spotify/spotify.provider'
import { TikTokProvider } from '@/modules/integrations/providers/tiktok/tiktok.provider'
import { MetaProvider } from '@/modules/integrations/providers/meta/meta.provider'
import { TwitterProvider } from '@/modules/integrations/providers/twitter/twitter.provider'
import { TwitchProvider } from '@/modules/integrations/providers/twitch/twitch.provider'
import { LinkedInProvider } from '@/modules/integrations/providers/linkedin/linkedin.provider'

const providers = new Map<SocialProviderSlug, SocialProvider>([
  ['youtube', new YouTubeProvider()],
  ['spotify', new SpotifyProvider()],
  ['tiktok', new TikTokProvider()],
  ['instagram', new MetaProvider('instagram')],
  ['facebook', new MetaProvider('facebook')],
  ['twitter', new TwitterProvider()],
  ['twitch', new TwitchProvider()],
  ['linkedin', new LinkedInProvider()],
])

export function isSocialProviderSlug(value: string): value is SocialProviderSlug {
  return SOCIAL_PROVIDER_SLUGS.includes(value as SocialProviderSlug)
}

export function getSocialProvider(slug: string) {
  if (!isSocialProviderSlug(slug)) throw badRequest('Unsupported social provider.')
  const provider = providers.get(slug)
  if (!provider) throw badRequest('Unsupported social provider.')
  return provider
}

export function listSocialProviders() {
  return Array.from(providers.values())
}
