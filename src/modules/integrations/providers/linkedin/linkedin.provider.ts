import { getProviderDefinition } from '@/modules/integrations/core/provider-config'
import type { ProviderRequestContext, ProviderTokenInput, SocialProfile } from '@/modules/integrations/core/types'
import { OAuth2SocialProvider } from '@/modules/integrations/providers/oauth2.provider'

type LinkedInUserInfoResponse = {
  sub?: string
  name?: string
  given_name?: string
  family_name?: string
  email?: string
  picture?: string
}

const definition = getProviderDefinition('linkedin')!

export class LinkedInProvider extends OAuth2SocialProvider {
  constructor() {
    super({
      slug: 'linkedin',
      displayName: definition.displayName,
      authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
      clientIdEnv: 'LINKEDIN_CLIENT_ID',
      clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
      requiredScopes: definition.requiredScopes,
      optionalScopes: definition.optionalScopes,
      capabilities: definition.capabilities,
    })
  }

  async fetchProfile(input: { tokens: ProviderTokenInput; context: ProviderRequestContext }): Promise<SocialProfile> {
    const payload = await this.getJson<LinkedInUserInfoResponse>('https://api.linkedin.com/v2/userinfo', input)
    if (!payload.sub) throw new Error('No LinkedIn profile was returned for this OAuth grant.')

    return {
      providerAccountId: payload.sub,
      displayName: payload.name ?? ([payload.given_name, payload.family_name].filter(Boolean).join(' ') || 'LinkedIn profile'),
      handle: payload.email ?? null,
      avatarUrl: payload.picture ?? null,
      accountType: 'PROFILE',
      metadata: { email: payload.email ?? null },
    }
  }
}
