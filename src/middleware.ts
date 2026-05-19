import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'

const BILLING_EXEMPT_PREFIXES = [
  '/billing',
  '/auth',
  '/login',
  '/register',
  '/invite',
  '/api/webhooks',
  '/api/auth',
  '/api/billing/webhook',
  '/_next',
  '/favicon',
  '/icons',
  '/sounds',
  '/manifest.json',
  '/firebase-messaging-sw.js',
]

function isBillingExempt(pathname: string): boolean {
  return BILLING_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function checkBillingAccess(
  subscriptionStatus: string | null | undefined,
  trialEndsAt: string | null | undefined,
): 'allowed' | 'trial_expired' | 'payment_required' {
  if (!subscriptionStatus) return 'allowed'
  if (subscriptionStatus === 'ACTIVE') return 'allowed'
  if (subscriptionStatus === 'PAUSED') return 'payment_required'
  if (subscriptionStatus === 'CANCELED') return 'payment_required'
  if (subscriptionStatus === 'PAST_DUE') return 'payment_required'

  if (subscriptionStatus === 'TRIAL') {
    if (!trialEndsAt) return 'allowed'
    const trialEnd = new Date(trialEndsAt)
    if (trialEnd > new Date()) return 'allowed'
    return 'trial_expired'
  }

  return 'allowed'
}

export default auth(function middleware(req) {
  const { pathname } = req.nextUrl
  const session: Session | null = req.auth

  if (isBillingExempt(pathname)) {
    return NextResponse.next()
  }

  if (!session?.user?.companyId) {
    return NextResponse.next()
  }

  const access = checkBillingAccess(
    session.user.subscriptionStatus,
    session.user.trialEndsAt,
  )

  if (access === 'trial_expired' || access === 'payment_required') {
    const upgradeUrl = new URL('/billing/upgrade', req.url)
    upgradeUrl.searchParams.set('reason', access)
    return NextResponse.redirect(upgradeUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|sounds/|manifest.json|firebase-messaging-sw.js).*)',
  ],
}

