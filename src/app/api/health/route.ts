import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isRealtimeRedisConfigured } from '@/modules/realtime/adapters/redis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  let dbOk = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
  } catch {
    dbOk = false
  }

  const ok = dbOk
  return NextResponse.json(
    {
      ok,
      db: dbOk ? 'up' : 'down',
      redis: isRealtimeRedisConfigured() ? 'configured' : 'optional',
      at: new Date().toISOString(),
    },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  )
}
