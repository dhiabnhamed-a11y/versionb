import { NextResponse } from 'next/server'
import { collectPublicHealth } from '@/lib/infra/health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const snapshot = await collectPublicHealth()
  return NextResponse.json(snapshot, {
    status: snapshot.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
