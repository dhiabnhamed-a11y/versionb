import type { NextRequest } from 'next/server'
import { getSocialProvider } from '@/modules/integrations/core/provider-registry'
import type { SocialProviderSlug } from '@/modules/integrations/core/types'
import { badRequest } from '@/modules/shared/errors'
import type { SessionUser } from '@/modules/shared/session'
import { assertCanManageIntegrations, requireIntegrationCompany } from '@/modules/integrations/security/rbac'
import {
  createOAuthState,
  createPkcePair,
  encodeOAuthCookie,
  oauthCookieName,
  verifyOAuthCookie,
  verifyOAuthState,
  type OAuthCookiePayload,
} from '@/modules/integrations/security/oauth-state'
import { upsertConnectedAccount } from '@/modules/integrations/repositories/integration.repository'
import { enqueueSocialIntegrationJob } from '@/modules/integrations/jobs/social-job-queue'
import { recordIntegrationActivity } from '@/modules/integrations/security/audit'
import { logger } from '@/modules/shared/logger'

function getBaseUrl(req: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.NEXTAUTH_URL
  if (configured) return configured.replace(/\/$/, '')
  if (req.nextUrl.origin && req.nextUrl.origin !== 'null') return req.nextUrl.origin.replace(/\/$/, '')

  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (!host) throw badRequest('Unable to resolve application URL for OAuth.')
  return `${proto}://${host}`
}

export function oauthRedirectUri(req: NextRequest, providerSlug: SocialProviderSlug) {
  return `${getBaseUrl(req)}/api/integrations/oauth/${providerSlug}/callback`
}

function safeReturnTo(value: string | null) {
  if (!value) return '/dashboard/admin/social-analytics'
  if (!value.startsWith('/dashboard')) return '/dashboard/admin/social-analytics'
  return value
}

export async function prepareOAuthStart(input: {
  req: NextRequest
  user: SessionUser
  providerSlug: SocialProviderSlug
  returnTo?: string | null
}) {
  assertCanManageIntegrations(input.user)
  const companyId = requireIntegrationCompany(input.user)
  const userId = input.user.id
  const provider = getSocialProvider(input.providerSlug)
  const { codeVerifier, codeChallenge } = createPkcePair()
  const { payload, state } = createOAuthState({
    provider: input.providerSlug,
    companyId,
    userId,
    returnTo: safeReturnTo(input.returnTo ?? input.req.nextUrl.searchParams.get('returnTo')),
  })
  const cookiePayload: OAuthCookiePayload = {
    nonce: payload.nonce,
    provider: input.providerSlug,
    companyId,
    userId,
    codeVerifier,
    issuedAt: payload.issuedAt,
  }
  const redirectUri = oauthRedirectUri(input.req, input.providerSlug)
  const authorization = await provider.connect({ state, codeChallenge, redirectUri })

  await recordIntegrationActivity({
    companyId,
    actorId: userId,
    action: 'social.oauth.started',
    metadata: { provider: input.providerSlug, scopes: authorization.scopes },
  })

  return {
    authorization,
    cookieName: oauthCookieName(input.providerSlug),
    cookieValue: encodeOAuthCookie(cookiePayload),
  }
}

export async function completeOAuthCallback(input: {
  req: NextRequest
  providerSlug: SocialProviderSlug
  state: string | null
  code: string | null
  error?: string | null
  cookieValue?: string | null
}) {
  if (input.error) throw badRequest(`OAuth provider returned an error: ${input.error}`)
  if (!input.state || !input.code) throw badRequest('OAuth callback is missing code or state.')
  if (!input.cookieValue) throw badRequest('OAuth session cookie was not found.')

  const state = verifyOAuthState(input.state)
  const cookie = verifyOAuthCookie(input.cookieValue)
  if (state.provider !== input.providerSlug || cookie.provider !== input.providerSlug) throw badRequest('OAuth provider mismatch.')
  if (state.nonce !== cookie.nonce) throw badRequest('OAuth state mismatch.')
  if (state.companyId !== cookie.companyId || state.userId !== cookie.userId) throw badRequest('OAuth tenant mismatch.')

  const provider = getSocialProvider(input.providerSlug)
  const context = {
    companyId: state.companyId,
    userId: state.userId,
    providerSlug: input.providerSlug,
  }
  const redirectUri = oauthRedirectUri(input.req, input.providerSlug)
  const tokenSet = await provider.exchangeCode({
    code: input.code,
    codeVerifier: cookie.codeVerifier,
    redirectUri,
    context,
  })
  const tokens = {
    accessToken: tokenSet.accessToken,
    refreshToken: tokenSet.refreshToken ?? null,
    tokenType: tokenSet.tokenType ?? 'Bearer',
    scope: tokenSet.scope ?? null,
    expiresAt: tokenSet.expiresAt ?? null,
  }
  const profile = await provider.fetchProfile({ tokens, context })
  const scopes = tokenSet.scopes?.length ? tokenSet.scopes : tokenSet.scope?.split(/[,\s]+/).filter(Boolean) ?? [...provider.requiredScopes]
  const account = await upsertConnectedAccount({
    companyId: state.companyId,
    connectedById: state.userId,
    providerSlug: input.providerSlug,
    profile,
    tokenSet,
    scopes,
  })

  await recordIntegrationActivity({
    companyId: state.companyId,
    connectedAccountId: account.id,
    actorId: state.userId,
    action: 'social.account.connected',
    metadata: { provider: input.providerSlug, providerAccountId: profile.providerAccountId, scopes },
  })

  await enqueueSocialIntegrationJob({
    name: 'social.analytics.sync',
    companyId: state.companyId,
    providerSlug: input.providerSlug,
    connectedAccountId: account.id,
    payload: { mode: 'initial' },
    priority: 20,
    maxAttempts: 5,
  })

  if (provider.capabilities.webhooks) {
    try {
      const callbackUrl = `${getBaseUrl(input.req)}/api/integrations/webhooks/${input.providerSlug}`
      const registration = await provider.registerWebhooks({ tokens, account: profile, callbackUrl, context: { ...context, accountId: account.id } })
      await recordIntegrationActivity({
        companyId: state.companyId,
        connectedAccountId: account.id,
        actorId: state.userId,
        action: 'social.webhook.registration',
        metadata: { provider: input.providerSlug, registration },
      })
    } catch (error) {
      logger.warn('integrations.webhook_registration_failed', {
        provider: input.providerSlug,
        accountId: account.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    account,
    returnTo: `${safeReturnTo(state.returnTo)}?connected=${input.providerSlug}`,
    clearCookieName: oauthCookieName(input.providerSlug),
  }
}
