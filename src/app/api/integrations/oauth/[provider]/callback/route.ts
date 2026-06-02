import { NextRequest, NextResponse } from 'next/server'
import { isSocialProviderSlug } from '@/modules/integrations/core/provider-registry'
import { completeOAuthCallback } from '@/modules/integrations/services/oauth.service'
import { oauthCookieName } from '@/modules/integrations/security/oauth-state'
import { normalizeError } from '@/modules/shared/errors'
import { logger } from '@/modules/shared/logger'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, ctx: RouteContext<'/api/integrations/oauth/[provider]/callback'>) {
  const { provider } = await ctx.params
  const fallback = new URL('/dashboard/admin/social-analytics', req.url)
  fallback.searchParams.set('integration_error', 'OAuth callback could not be completed. Please start the connection again.')
  fallback.searchParams.set('provider', provider)
  if (!isSocialProviderSlug(provider)) return NextResponse.redirect(fallback)

  try {
    const result = await completeOAuthCallback({
      req,
      providerSlug: provider,
      state: req.nextUrl.searchParams.get('state'),
      code: req.nextUrl.searchParams.get('code'),
      error: req.nextUrl.searchParams.get('error'),
      cookieValue: req.cookies.get(oauthCookieName(provider))?.value,
    })
    const response = NextResponse.redirect(new URL(result.returnTo, req.url))
    response.cookies.set(result.clearCookieName, '', { path: '/', maxAge: 0 })
    return response
  } catch (error) {
    const normalized = normalizeError(error)
    logger.warn('integrations.oauth_callback_failed', {
      provider,
      code: normalized.code,
      status: normalized.status,
      message: normalized.message,
      requestOrigin: req.nextUrl.origin,
    })
    fallback.searchParams.set('integration_error_code', normalized.code)
    const response = NextResponse.redirect(fallback)
    response.cookies.set(oauthCookieName(provider), '', { path: '/', maxAge: 0 })
    return response
  }
}
