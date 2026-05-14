import { NextRequest, NextResponse } from 'next/server'

import { validateCredentialsForLogin } from '@/lib/auth'
import { getDatabaseConfigHint } from '@/lib/db'
import { withApiError } from '@/modules/shared/api'
import { logger } from '@/modules/shared/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LoginCheckBody = {
  email?: unknown
  password?: unknown
}

export async function POST(req: NextRequest) {
  return withApiError(
    req,
    async () => {
      const body = (await req.json().catch(() => null)) as LoginCheckBody | null
      const email = typeof body?.email === 'string' ? body.email.trim() : ''
      const password = typeof body?.password === 'string' ? body.password : ''

      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
      }

      try {
        const result = await validateCredentialsForLogin(email, password)
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 401 })
        }

        return NextResponse.json({ success: true })
      } catch (error) {
        logger.error('auth.login_check_failed', error)

        return NextResponse.json(
          {
            error: 'Unable to verify credentials right now. Please try again shortly.',
            hint: process.env.NODE_ENV === 'production' ? undefined : getDatabaseConfigHint(),
          },
          { status: 503 }
        )
      }
    },
    {
      rateLimit: {
        namespace: 'auth.login_check',
        windowMs: 60_000,
        max: 10,
      },
    }
  )
}
