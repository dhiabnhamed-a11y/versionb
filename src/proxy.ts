import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isPublicApiPath } from '@/lib/security/config'

function securityHeaders(req: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production'
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' blob:${isDev ? " 'unsafe-eval'" : ''}`,
    "script-src-elem 'self' 'unsafe-inline' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' data: blob: https:",
    "connect-src 'self' https: wss: ws:",
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
    'Cross-Origin-Resource-Policy': 'same-site',
    'Origin-Agent-Cluster': '?1',
    'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-Permitted-Cross-Domain-Policies': 'none',
  }

  if (req.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production') {
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload'
  }

  return headers
}

function applySecurityHeaders(response: NextResponse, req: NextRequest) {
  Object.entries(securityHeaders(req)).forEach(([key, value]) => response.headers.set(key, value))
  return response
}

function hasAuthSessionCookie(req: NextRequest) {
  return req.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name === 'authjs.session-token' ||
        cookie.name === '__Secure-authjs.session-token' ||
        cookie.name.startsWith('authjs.session-token.') ||
        cookie.name.startsWith('__Secure-authjs.session-token.')
    )
}

function rejectUnauthorizedApi(req: NextRequest) {
  return applySecurityHeaders(
    NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 }),
    req
  )
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const hasSessionCookie = hasAuthSessionCookie(req)

  if (pathname.startsWith('/api')) {
    if (isPublicApiPath(pathname)) {
      return applySecurityHeaders(NextResponse.next(), req)
    }
    if (!hasSessionCookie) {
      return rejectUnauthorizedApi(req)
    }
  }

  if (pathname === '/login' || pathname === '/signup' || pathname === '/') {
    if (hasSessionCookie) {
      return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard', req.url)), req)
    }
    return applySecurityHeaders(NextResponse.next(), req)
  }

  if (pathname.startsWith('/dashboard')) {
    if (!hasSessionCookie) {
      return applySecurityHeaders(NextResponse.redirect(new URL('/login', req.url)), req)
    }
  }

  return applySecurityHeaders(NextResponse.next(), req)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sounds).*)'],
}
