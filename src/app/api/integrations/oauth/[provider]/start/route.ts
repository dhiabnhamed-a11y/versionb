import { NextRequest, NextResponse } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { withApiError } from '@/modules/shared/api'
import { isSocialProviderSlug } from '@/modules/integrations/core/provider-registry'
import { badRequest } from '@/modules/shared/errors'
import { prepareOAuthStart } from '@/modules/integrations/services/oauth.service'

export async function GET(req: NextRequest, ctx: RouteContext<'/api/integrations/oauth/[provider]/start'>) {
  return withApiError(async () => {
    const user = await requireSessionUser()
    const { provider } = await ctx.params
    if (!isSocialProviderSlug(provider)) throw badRequest('Unsupported social provider.')

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
  })
}
