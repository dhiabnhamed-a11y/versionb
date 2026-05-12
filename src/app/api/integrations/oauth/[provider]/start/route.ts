import { NextRequest, NextResponse } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { isSocialProviderSlug } from '@/modules/integrations/core/provider-registry'
import { badRequest, normalizeError } from '@/modules/shared/errors'
import { prepareOAuthStart } from '@/modules/integrations/services/oauth.service'
import { logger } from '@/modules/shared/logger'
import { logOAuthUrlResolution, resolveOAuthOrigin } from '@/lib/oauth-origin'

function safeReturnTo(value: string | null) {
  if (!value) return '/dashboard/admin/social-analytics'
  if (!value.startsWith('/dashboard')) return '/dashboard/admin/social-analytics'
  return value
}

function providerLabel(provider: string) {
  if (provider === 'youtube') return 'YouTube'
  return provider
}

function oauthErrorMessage(provider: string, code: string, message: string, status: number) {
  if (code === 'SOCIAL_CONFIGURATION_MISSING') return `${providerLabel(provider)} is not configured yet. Add the OAuth client credentials and redeploy.`
  if (status >= 500) return `${providerLabel(provider)} connection could not start. Check the integration configuration and try again.`
  return message
}

function redirectTo(req: NextRequest, path: string) {
  return new URL(path, req.nextUrl.origin)
}

export async function GET(req: NextRequest, ctx: RouteContext<'/api/integrations/oauth/[provider]/start'>) {
  const returnTo = safeReturnTo(req.nextUrl.searchParams.get('returnTo'))

  try {
    const user = await requireSessionUser()
    const { provider } = await ctx.params
    if (!isSocialProviderSlug(provider)) throw badRequest('Unsupported social provider.')

    const originResolution = resolveOAuthOrigin({ req })
    logOAuthUrlResolution('integrations.oauth_start_origin', {
      provider,
      source: originResolution.source,
      requestOrigin: originResolution.requestOrigin,
      resolvedOrigin: originResolution.origin,
      configuredOrigin: originResolution.configuredOrigin,
      allowedOrigins: originResolution.allowedOrigins,
    })

    const prepared = await prepareOAuthStart({
      req,
      user,
      providerSlug: provider,
      returnTo: req.nextUrl.searchParams.get('returnTo'),
    })
    const response = NextResponse.redirect(prepared.authorization.url)
    response.cookies.set(prepared.cookieName, prepared.cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60,
    })
    return response
  } catch (error) {
    const normalized = normalizeError(error)
    const provider = req.nextUrl.pathname.split('/').at(-2) ?? 'social'

    if (normalized.status >= 500) {
      logger.error('integrations.oauth_start_failed', error, { code: normalized.code, provider })
    } else {
      logger.warn('integrations.oauth_start_rejected', { code: normalized.code, provider, status: normalized.status })
    }

    if (normalized.code === 'UNAUTHORIZED') {
      const loginUrl = redirectTo(req, '/login')
      loginUrl.searchParams.set('returnTo', returnTo)
      return NextResponse.redirect(loginUrl)
    }

    const redirectUrl = redirectTo(req, returnTo)
    redirectUrl.searchParams.set('integration_error', oauthErrorMessage(provider, normalized.code, normalized.message, normalized.status))
    redirectUrl.searchParams.set('integration_error_code', normalized.code)
    redirectUrl.searchParams.set('provider', provider)
    return NextResponse.redirect(redirectUrl)
  }
}
