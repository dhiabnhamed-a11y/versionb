import { getProviderDefinition } from '@/modules/integrations/core/provider-config'
import type { ProviderRequestContext, ProviderTokenInput, SocialProfile } from '@/modules/integrations/core/types'
import { OAuth2SocialProvider } from '@/modules/integrations/providers/oauth2.provider'

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

const definition = getProviderDefinition('tiktok')!

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
}
