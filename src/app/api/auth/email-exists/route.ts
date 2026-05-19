import { NextRequest, NextResponse } from 'next/server'
import { withApiError } from '@/modules/shared/api'
import { prisma } from '@/lib/db'
import { enforceAuthRateLimit } from '@/lib/security/brute-force'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  return withApiError(
    req,
    async () => {
      const body = (await req.json().catch(() => ({}))) as { email?: unknown }
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

      if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 })

      if (process.env.NODE_ENV === 'production' && process.env.ALLOW_LOGIN_CHECK !== 'true') {
        // In production we may disable this endpoint to avoid account enumeration unless explicitly enabled
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const authRate = await enforceAuthRateLimit(req, 'auth.email_exists')
      if (!authRate.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, accountStatus: true, companyId: true } })
      if (!user) return NextResponse.json({ exists: false })

      return NextResponse.json({ exists: true, accountStatus: user.accountStatus ?? null, companyId: user.companyId ?? null })
    },
    {
      rateLimit: {
        namespace: 'auth.email_exists',
        windowMs: 60_000,
        max: 12,
      },
      route: '/api/auth/email-exists',
    }
  )
}
