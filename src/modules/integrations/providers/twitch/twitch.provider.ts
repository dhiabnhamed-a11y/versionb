import { configurationMissing } from '@/modules/integrations/core/errors'
import { getProviderDefinition } from '@/modules/integrations/core/provider-config'
import type { ProviderRequestContext, ProviderTokenInput, SocialProfile } from '@/modules/integrations/core/types'
import { OAuth2SocialProvider } from '@/modules/integrations/providers/oauth2.provider'
import { providerFetchJson } from '@/modules/integrations/services/provider-http-client'

type TwitchUsersResponse = {
  data?: Array<{
    id: string
    login?: string
    display_name?: string
    profile_image_url?: string
    created_at?: string
    broadcaster_type?: string
    view_count?: number
  }>
}

const definition = getProviderDefinition('twitch')!

export class TwitchProvider extends OAuth2SocialProvider {
  constructor() {
    super({
      slug: 'twitch',
      displayName: definition.displayName,
      authorizationUrl: 'https://id.twitch.tv/oauth2/authorize',
      tokenUrl: 'https://id.twitch.tv/oauth2/token',
      revokeUrl: 'https://id.twitch.tv/oauth2/revoke',
      clientIdEnv: 'TWITCH_CLIENT_ID',
      clientSecretEnv: 'TWITCH_CLIENT_SECRET',
      requiredScopes: definition.requiredScopes,
      optionalScopes: definition.optionalScopes,
      capabilities: definition.capabilities,
    })
  }

  async fetchProfile(input: { tokens: ProviderTokenInput; context: ProviderRequestContext }): Promise<SocialProfile> {
    const clientId = process.env.TWITCH_CLIENT_ID
    if (!clientId) throw configurationMissing('twitch', 'TWITCH_CLIENT_ID')

    const payload = await providerFetchJson<TwitchUsersResponse>('https://api.twitch.tv/helix/users', {
      context: input.context,
      accessToken: input.tokens.accessToken,
      headers: { 'Client-Id': clientId },
    })
    const user = payload.data?.[0]
    if (!user?.id) throw new Error('No Twitch user was returned for this OAuth grant.')

    return {
      providerAccountId: user.id,
      displayName: user.display_name ?? user.login ?? 'Twitch channel',
      handle: user.login ?? null,
      avatarUrl: user.profile_image_url ?? null,
      accountType: 'CHANNEL',
      externalCreatedAt: user.created_at ? new Date(user.created_at) : null,
      metadata: {
        broadcasterType: user.broadcaster_type ?? null,
        viewCount: user.view_count ?? null,
      },
    }
  }
}
