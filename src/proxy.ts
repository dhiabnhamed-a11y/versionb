import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Public routes
  if (pathname === '/login' || pathname === '/signup' || pathname === '/') {
    // Redirect logged-in users away from auth pages
    if (session) {
      const role = (session.user as any)?.role
      if (role === 'OWNER' || role === 'MANAGER') {
        return NextResponse.redirect(new URL('/dashboard/admin', req.url))
      }
      return NextResponse.redirect(new URL('/dashboard/employee', req.url))
    }
    return NextResponse.next()
  }

  // Protected routes — must be authenticated
  if (pathname.startsWith('/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    const role = (session.user as any)?.role
    // Employee cannot access admin routes
    if (pathname.startsWith('/dashboard/admin') && role === 'EMPLOYEE') {
      return NextResponse.redirect(new URL('/dashboard/employee', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sounds).*)'],
}
