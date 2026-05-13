import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { canAuthenticateAuthState, getRoleHomePath, isAuthorizedSuperAdminIdentity } from '@/lib/security'

type SessionUser = {
  id?: string
  email?: string | null
  role?: string | null
  companyId?: string | null
  accountStatus?: string | null
  companyStatus?: string | null
}

function getAuthSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'taskforce-super-secret-key-2024-change-in-production'
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = await getToken({
    req,
    secret: getAuthSecret(),
    secureCookie: req.nextUrl.protocol === 'https:' || process.env.VERCEL === '1',
  })
  const user = token
    ? ({
        id: typeof token.id === 'string' ? token.id : undefined,
        email: typeof token.email === 'string' ? token.email : null,
        role: typeof token.role === 'string' ? token.role : null,
        companyId: typeof token.companyId === 'string' ? token.companyId : null,
        accountStatus: typeof token.accountStatus === 'string' ? token.accountStatus : null,
        companyStatus: typeof token.companyStatus === 'string' ? token.companyStatus : null,
      } satisfies SessionUser)
    : undefined
  const isLoggedIn = Boolean(user?.email)
  const isApprovedSession = user ? canAuthenticateAuthState(user) : false
  const isSuperAdmin = user ? isAuthorizedSuperAdminIdentity(user) : false

  if (pathname === '/login' || pathname === '/signup' || pathname === '/') {
    if (isLoggedIn && isApprovedSession) {
      return NextResponse.redirect(new URL(getRoleHomePath(user?.role), req.url))
    }

    return NextResponse.next()
  }

  if (pathname.startsWith('/dashboard')) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    if (!isApprovedSession) {
      return NextResponse.redirect(new URL('/login?reason=inactive', req.url))
    }

    if (pathname.startsWith('/dashboard/super-admin')) {
      if (!isSuperAdmin) {
        return NextResponse.redirect(new URL(getRoleHomePath(user?.role), req.url))
      }

      return NextResponse.next()
    }

    if (isSuperAdmin) {
      return NextResponse.redirect(new URL('/dashboard/super-admin', req.url))
    }

    if (pathname.startsWith('/dashboard/admin') && user?.role === 'EMPLOYEE') {
      return NextResponse.redirect(new URL('/dashboard/employee', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sounds).*)'],
}
