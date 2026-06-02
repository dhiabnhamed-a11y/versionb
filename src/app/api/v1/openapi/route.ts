import { NextResponse } from 'next/server'
import { openApiV1Spec } from '@/lib/api/openapi'
import { requireSessionUser } from '@/modules/shared/session'

export const runtime = 'nodejs'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production' && !process.env.OPENAPI_PUBLIC) {
    await requireSessionUser(req)
  }
  return NextResponse.json(openApiV1Spec, {
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  })
}
