import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getAuthSecret } from '@/lib/env'
import { isPublicApiPath } from '@/lib/security/config'
import { getWorkspaceHomePath, getWorkspaceRouteRedirect } from '@/lib/workspace-routing'

function securityHeaders(req: NextRequest) {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:`,
    "script-src-elem 'self' 'unsafe-inline' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "media-src 'self' data: blob: https: http:",
    "connect-src 'self' https: http: wss: ws:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')

  const headers: Record<string, string> = {
    'Content-Security-Policy': csp,
    'X-DNS-Prefetch-Control': 'on',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Origin-Agent-Cluster': '?1',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Vary': 'Accept-Encoding',
  }

  if (req.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production') {
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload'
  }

  return headers
}

function applySecurityHeaders(response: NextResponse, req: NextRequest) {
  try {
    Object.entries(securityHeaders(req)).forEach(([key, value]) => response.headers.set(key, value))
  } catch {
    // headers already sent, skip
  }
  return response
}

function hasAuthSessionCookie(req: NextRequest) {
  try {
    return req.cookies
      .getAll()
      .some(
        (cookie) =>
          cookie.name === 'authjs.session-token' ||
          cookie.name === '__Secure-authjs.session-token' ||
          cookie.name.startsWith('authjs.session-token.') ||
          cookie.name.startsWith('__Secure-authjs.session-token.')
      )
  } catch {
    return false
  }
}

function rejectUnauthorizedApi(req: NextRequest) {
  return applySecurityHeaders(
    NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 }),
    req
  )
}

const BILLING_EXEMPT_PREFIXES = [
  '/billing', '/erp', '/auth', '/login', '/register', '/invite',
  '/api/webhooks', '/api/auth', '/api/billing/webhook',
  '/_next', '/favicon', '/icons', '/sounds',
  '/manifest.json', '/firebase-messaging-sw.js',
]

function isBillingExempt(pathname: string): boolean {
  return BILLING_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function checkBillingAccess(
  subscriptionStatus: unknown,
  trialEndsAt: unknown,
): 'allowed' | 'trial_expired' | 'payment_required' {
  if (!subscriptionStatus) return 'allowed'
  if (subscriptionStatus === 'ACTIVE') return 'allowed'
  if (subscriptionStatus === 'PAUSED') return 'payment_required'
  if (subscriptionStatus === 'CANCELED') return 'payment_required'
  if (subscriptionStatus === 'PAST_DUE') return 'payment_required'
  if (subscriptionStatus === 'TRIAL') {
    if (!trialEndsAt) return 'allowed'
    try {
      const trialEnd = new Date(trialEndsAt as string)
      if (trialEnd > new Date()) return 'allowed'
    } catch {
      return 'allowed'
    }
    return 'trial_expired'
  }
  return 'allowed'
}

export async function proxy(req: NextRequest) {
  try {
    const { pathname } = req.nextUrl

    // Always allow static assets and Next.js internals
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon') ||
      pathname.startsWith('/icons') ||
      pathname.startsWith('/sounds') ||
      pathname.startsWith('/manifest') ||
      pathname.startsWith('/firebase-messaging') ||
      pathname.startsWith('/sw.js') ||
      pathname === '/'
    ) {
      return applySecurityHeaders(NextResponse.next(), req)
    }

    const hasSessionCookie = hasAuthSessionCookie(req)
    const token = hasSessionCookie
      ? await getToken({
          req,
          secret: getAuthSecret('proxy'),
          secureCookie: process.env.NODE_ENV === 'production',
        }).catch(() => null)
      : null

    if (pathname.startsWith('/api')) {
      if (isPublicApiPath(pathname)) {
        return applySecurityHeaders(NextResponse.next(), req)
      }
      if (!hasSessionCookie) {
        return rejectUnauthorizedApi(req)
      }
    }

    if (pathname === '/login' || pathname === '/signup') {
      if (hasSessionCookie && token) {
        try {
          const destination = getWorkspaceHomePath({
            role: typeof token.role === 'string' ? token.role : null,
            companyType: typeof token.companyType === 'string' ? token.companyType : null,
          })
          return applySecurityHeaders(NextResponse.redirect(new URL(destination, req.url)), req)
        } catch {
          return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard', req.url)), req)
        }
      }
      return applySecurityHeaders(NextResponse.next(), req)
    }

    if (pathname.startsWith('/dashboard') || pathname.startsWith('/erp')) {
      if (!hasSessionCookie) {
        return applySecurityHeaders(NextResponse.redirect(new URL('/login', req.url)), req)
      }

      if (token) {
        try {
          const routeRedirect = getWorkspaceRouteRedirect(pathname, {
            role: typeof token.role === 'string' ? token.role : null,
            companyType: typeof token.companyType === 'string' ? token.companyType : null,
          })
          if (routeRedirect) {
            return applySecurityHeaders(NextResponse.redirect(new URL(routeRedirect.destination, req.url)), req)
          }
        } catch {
          // workspace routing failed, proceed normally
        }
      }
    }

    if (!isBillingExempt(pathname) && token?.companyId) {
      try {
        const access = checkBillingAccess(token.subscriptionStatus, token.trialEndsAt)
        if (access === 'trial_expired' || access === 'payment_required') {
          const upgradeUrl = new URL('/billing/upgrade', req.url)
          upgradeUrl.searchParams.set('reason', access)
          return applySecurityHeaders(NextResponse.redirect(upgradeUrl), req)
        }
      } catch {
        // billing check failed, proceed
      }
    }

    return applySecurityHeaders(NextResponse.next(), req)
  } catch {
    // Absolute last resort: never crash middleware
    try {
      return NextResponse.next()
    } catch {
      return new Response('OK', { status: 200 })
    }
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sounds|sw.js|manifest.json|firebase-messaging-sw.js).*)'],
}
