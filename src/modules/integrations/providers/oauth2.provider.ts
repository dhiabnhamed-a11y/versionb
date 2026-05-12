import { capabilityUnavailable, configurationMissing, ProviderError } from '@/modules/integrations/core/errors'
import type {
  ProviderAnalyticsResult,
  ProviderAuthorization,
  ProviderAuthorizationInput,
  ProviderContentResult,
  ProviderRevenueResult,
  ProviderSyncResult,
  ProviderTokenInput,
  ProviderTokenSet,
  ProviderWebhookRegistrationResult,
  SocialCapability,
  SocialProfile,
  SocialProvider,
  SocialProviderCapabilityMap,
  SocialProviderSlug,
} from '@/modules/integrations/core/types'
import { providerFetchJson, providerPostForm } from '@/modules/integrations/services/provider-http-client'

type OAuthTokenResponse = {
  access_token?: string
  refresh_token?: string
  token_type?: string
  scope?: string
  expires_in?: number
  error?: string
  error_description?: string
}

export type OAuth2ProviderConfig = {
  slug: SocialProviderSlug
  displayName: string
  authorizationUrl: string
  tokenUrl: string
  revokeUrl?: string
  clientIdEnv: string | readonly string[]
  clientSecretEnv?: string | readonly string[]
  clientIdParam?: string
  tokenAuth?: 'body' | 'basic'
  requiredScopes: readonly string[]
  optionalScopes: readonly string[]
  capabilities: SocialProviderCapabilityMap
  authorizationParams?: Record<string, string>
}

function expiresAtFromNow(expiresIn?: number | null) {
  if (!expiresIn) return null
  return new Date(Date.now() + Math.max(expiresIn - 60, 1) * 1000)
}

function envKeys(value: string | readonly string[]) {
  return Array.isArray(value) ? value : [value]
}

function cleanEnvValue(value?: string | null) {
  return value?.trim().replace(/^['"]|['"]$/g, '') || undefined
}

function resolveEnvValue(keys: string | readonly string[]) {
  for (const key of envKeys(keys)) {
    const value = cleanEnvValue(process.env[key])
    if (value) return value
  }
  return undefined
}

function envLabel(keys: string | readonly string[]) {
  return envKeys(keys).join(' or ')
}

export abstract class OAuth2SocialProvider implements SocialProvider {
  readonly slug: SocialProviderSlug
  readonly displayName: string
  readonly requiredScopes: readonly string[]
  readonly optionalScopes: readonly string[]
  readonly capabilities: SocialProviderCapabilityMap
  protected readonly config: OAuth2ProviderConfig

  constructor(config: OAuth2ProviderConfig) {
    this.config = config
    this.slug = config.slug
    this.displayName = config.displayName
    this.requiredScopes = config.requiredScopes
    this.optionalScopes = config.optionalScopes
    this.capabilities = config.capabilities
  }

  protected credentials() {
    const clientId = resolveEnvValue(this.config.clientIdEnv)
    if (!clientId) throw configurationMissing(this.slug, envLabel(this.config.clientIdEnv))
    const clientSecret = this.config.clientSecretEnv ? resolveEnvValue(this.config.clientSecretEnv) : undefined
    if (this.config.clientSecretEnv && !clientSecret) throw configurationMissing(this.slug, envLabel(this.config.clientSecretEnv))
    return { clientId, clientSecret }
  }

  async connect(input: ProviderAuthorizationInput): Promise<ProviderAuthorization> {
    const { clientId } = this.credentials()
    const scopes = input.scopes?.length ? input.scopes : [...this.requiredScopes, ...this.optionalScopes]
    const clientIdParam = this.config.clientIdParam ?? 'client_id'
    const params = new URLSearchParams({
      response_type: 'code',
      [clientIdParam]: clientId,
      redirect_uri: input.redirectUri,
      scope: scopes.join(' '),
      state: input.state,
      ...(this.config.authorizationParams ?? {}),
    })

    if (input.codeChallenge) {
      params.set('code_challenge', input.codeChallenge)
      params.set('code_challenge_method', 'S256')
    }

    return {
      url: `${this.config.authorizationUrl}?${params.toString()}`,
      state: input.state,
      scopes,
    }
  }

  async exchangeCode(input: {
    code: string
    codeVerifier?: string | null
    redirectUri: string
    context: Parameters<SocialProvider['exchangeCode']>[0]['context']
  }): Promise<ProviderTokenSet> {
    const { clientId, clientSecret } = this.credentials()
    const clientIdParam = this.config.clientIdParam ?? 'client_id'
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
      [clientIdParam]: clientId,
    })
    if (clientSecret && this.config.tokenAuth !== 'basic') body.set('client_secret', clientSecret)
    if (input.codeVerifier) body.set('code_verifier', input.codeVerifier)

    const headers =
      clientSecret && this.config.tokenAuth === 'basic'
        ? { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}` }
        : undefined

    const payload = await providerPostForm<OAuthTokenResponse>(this.config.tokenUrl, body, {
      context: input.context,
      headers,
    })

    if (!payload.access_token) {
      throw new ProviderError(this.slug, 'OAUTH_EXCHANGE_FAILED', `${this.displayName} did not return an access token.`, payload, 502)
    }

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token ?? null,
      tokenType: payload.token_type ?? 'Bearer',
      scope: payload.scope ?? null,
      scopes: payload.scope?.split(/[,\s]+/).filter(Boolean),
      expiresIn: payload.expires_in ?? null,
      expiresAt: expiresAtFromNow(payload.expires_in),
      raw: payload,
    }
  }

  async refreshToken(input: { tokens: ProviderTokenInput; context: Parameters<SocialProvider['refreshToken']>[0]['context'] }) {
    if (!input.tokens.refreshToken) {
      throw new ProviderError(this.slug, 'TOKEN_REFRESH_FAILED', `${this.displayName} account has no refresh token.`, undefined, 409)
    }

    const { clientId, clientSecret } = this.credentials()
    const clientIdParam = this.config.clientIdParam ?? 'client_id'
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: input.tokens.refreshToken,
      [clientIdParam]: clientId,
    })
    if (clientSecret && this.config.tokenAuth !== 'basic') body.set('client_secret', clientSecret)

    const headers =
      clientSecret && this.config.tokenAuth === 'basic'
        ? { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}` }
        : undefined

    const payload = await providerPostForm<OAuthTokenResponse>(this.config.tokenUrl, body, {
      context: input.context,
      headers,
    })

    if (!payload.access_token) {
      throw new ProviderError(this.slug, 'TOKEN_REFRESH_FAILED', `${this.displayName} did not return a refreshed access token.`, payload, 502)
    }

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token ?? input.tokens.refreshToken,
      tokenType: payload.token_type ?? input.tokens.tokenType ?? 'Bearer',
      scope: payload.scope ?? input.tokens.scope ?? null,
      scopes: payload.scope?.split(/[,\s]+/).filter(Boolean),
      expiresIn: payload.expires_in ?? null,
      expiresAt: expiresAtFromNow(payload.expires_in),
      raw: payload,
    }
  }

  async disconnect(input: { tokens: ProviderTokenInput; context: Parameters<SocialProvider['disconnect']>[0]['context'] }) {
    if (!this.config.revokeUrl) return
    await providerPostForm<unknown>(this.config.revokeUrl, new URLSearchParams({ token: input.tokens.accessToken }), {
      context: input.context,
      expectedStatuses: [200, 204],
    })
  }

  abstract fetchProfile(input: { tokens: ProviderTokenInput; context: Parameters<SocialProvider['fetchProfile']>[0]['context'] }): Promise<SocialProfile>

  async fetchAnalytics(input: Parameters<SocialProvider['fetchAnalytics']>[0]): Promise<ProviderAnalyticsResult> {
    void input
    return this.unsupported('analytics')
  }

  async fetchRevenue(input: Parameters<SocialProvider['fetchRevenue']>[0]): Promise<ProviderRevenueResult> {
    void input
    return this.unsupported('revenue')
  }

  async fetchContent(input: Parameters<SocialProvider['fetchContent']>[0]): Promise<ProviderContentResult> {
    void input
    return this.unsupported('content')
  }

  async registerWebhooks(input: Parameters<SocialProvider['registerWebhooks']>[0]): Promise<ProviderWebhookRegistrationResult> {
    void input
    return this.unsupported('webhooks')
  }

  async sync(input: { tokens: ProviderTokenInput; cursor?: Parameters<SocialProvider['sync']>[0]['cursor']; context: Parameters<SocialProvider['sync']>[0]['context'] }): Promise<ProviderSyncResult> {
    const profile = await this.fetchProfile({ tokens: input.tokens, context: input.context })
    const result: ProviderSyncResult = { profile }

    for (const capability of ['content', 'analytics', 'revenue'] as const) {
      if (!this.capabilities[capability]) continue
      try {
        if (capability === 'content') result.content = await this.fetchContent({ tokens: input.tokens, cursor: input.cursor, context: input.context })
        if (capability === 'analytics') result.analytics = await this.fetchAnalytics({ tokens: input.tokens, cursor: input.cursor, context: input.context })
        if (capability === 'revenue') result.revenue = await this.fetchRevenue({ tokens: input.tokens, cursor: input.cursor, context: input.context })
      } catch (error) {
        if (error instanceof ProviderError && error.reason === 'CAPABILITY_UNAVAILABLE') continue
        throw error
      }
    }

    result.nextCursor = result.analytics?.nextCursor ?? result.content?.nextCursor ?? result.revenue?.nextCursor ?? input.cursor?.cursor ?? null
    return result
  }

  protected unsupported<T>(capability: SocialCapability): T {
    throw capabilityUnavailable(this.slug, capability)
  }

  protected getJson<T>(url: string, input: { tokens: ProviderTokenInput; context: Parameters<SocialProvider['fetchProfile']>[0]['context'] }) {
    return providerFetchJson<T>(url, {
      context: input.context,
      accessToken: input.tokens.accessToken,
    })
  }
}
