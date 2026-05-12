import { getProviderDefinition } from '@/modules/integrations/core/provider-config'
import type { ProviderRequestContext, ProviderTokenInput, SocialProfile } from '@/modules/integrations/core/types'
import { OAuth2SocialProvider } from '@/modules/integrations/providers/oauth2.provider'

type TwitterMeResponse = {
  data?: {
    id: string
    name?: string
    username?: string
    profile_image_url?: string
    created_at?: string
    public_metrics?: Record<string, number>
  }
}

const definition = getProviderDefinition('twitter')!

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
    const payload = await this.getJson<TwitterMeResponse>('https://api.twitter.com/2/users/me?user.fields=profile_image_url,username,public_metrics,created_at', input)
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
}
