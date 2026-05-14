import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

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

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const hasSessionCookie = hasAuthSessionCookie(req)

  if (pathname === '/login' || pathname === '/signup' || pathname === '/') {
    if (hasSessionCookie) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  }

  if (pathname.startsWith('/dashboard')) {
    if (!hasSessionCookie) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sounds).*)'],
}
