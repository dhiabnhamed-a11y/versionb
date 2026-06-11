import { NextResponse } from 'next/server'
import { collectInfraHealth } from '@/lib/infra/health'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(req: Request) {
  const token = process.env.OPS_HEALTH_TOKEN?.trim()
  if (!token) return process.env.NODE_ENV !== 'production'
  const header = req.headers.get('authorization')
  return header === `Bearer ${token}`
}

export const GET = withApiHandler(async ({ req, params }) => {
if (!authorized(req)) {
return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
}
const snapshot = await collectInfraHealth()
const ready = snapshot.ok && snapshot.redis.configured
return NextResponse.json(
{ ready, db: snapshot.db, redis: snapshot.redis, queues: snapshot.queues },
{ status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
)
}, { auth: 'required' });
