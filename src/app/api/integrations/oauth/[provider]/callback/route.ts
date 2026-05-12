import { NextRequest, NextResponse } from 'next/server'
import { isSocialProviderSlug } from '@/modules/integrations/core/provider-registry'
import { completeOAuthCallback } from '@/modules/integrations/services/oauth.service'
import { oauthCookieName } from '@/modules/integrations/security/oauth-state'

export async function GET(req: NextRequest, ctx: RouteContext<'/api/integrations/oauth/[provider]/callback'>) {
  const { provider } = await ctx.params
  const fallback = new URL('/dashboard/admin/social-analytics?error=oauth', req.url)
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
  } catch {
    const response = NextResponse.redirect(fallback)
    response.cookies.set(oauthCookieName(provider), '', { path: '/', maxAge: 0 })
    return response
  }
}
