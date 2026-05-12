import { getProviderDefinition } from '@/modules/integrations/core/provider-config'
import type { ProviderRequestContext, ProviderTokenInput, SocialProfile, SocialProviderSlug } from '@/modules/integrations/core/types'
import { OAuth2SocialProvider } from '@/modules/integrations/providers/oauth2.provider'

type GraphMeResponse = {
  id?: string
  name?: string
  username?: string
  picture?: { data?: { url?: string } }
}

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
    const payload = await this.getJson<GraphMeResponse>('https://graph.facebook.com/v20.0/me?fields=id,name,picture,username', input)
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
}
