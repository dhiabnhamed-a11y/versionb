import { NextResponse } from 'next/server'
import { openApiV1Spec } from '@/lib/api/openapi'

export const dynamic = 'force-static'

export function GET() {
  return NextResponse.json(openApiV1Spec, {
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  })
}
