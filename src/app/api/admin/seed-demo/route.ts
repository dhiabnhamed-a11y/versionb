import { NextRequest, NextResponse } from 'next/server'
import { runDemoSeed } from '@/lib/demo-seed'
import { logger } from '@/modules/shared/logger'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Seed can take 30-60 seconds on a cold DB
export const maxDuration = 120

function getSecret() {
  return process.env.DEMO_SEED_SECRET?.trim()
}

function isAuthorized(req: NextRequest): boolean {
  const secret = getSecret()
  if (!secret) return false

  const authHeader = req.headers.get('authorization') ?? ''
  const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const tokenFromQuery = new URL(req.url).searchParams.get('secret') ?? ''

  return tokenFromHeader === secret || tokenFromQuery === secret
}

export const POST = withApiHandler(async ({ req, params }) => {
if (!isAuthorized(req)) {
return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
}

const { searchParams } = new URL(req.url)
const reset = searchParams.get('reset') === 'true'

logger.info('demo_seed.start', { reset })

try {
const result = await runDemoSeed(reset)
logger.info('demo_seed.complete', { workspaces: result.workspaces.length })
return NextResponse.json({ ok: true, ...result })
} catch (error) {
logger.error('demo_seed.failed', error)
const message = error instanceof Error ? error.message : String(error)
return NextResponse.json({ error: 'Seed failed.', detail: message }, { status: 500 })
}
}, { auth: 'required' });

// GET — returns status without running seed
export const GET = withApiHandler(async ({ req, params }) => {
if (!isAuthorized(req)) {
return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
}

const secret = getSecret()
return NextResponse.json({
configured: Boolean(secret),
endpoint: 'POST /api/admin/seed-demo',
params: { reset: 'true | false (default false) — wipe existing demo data before seeding' },
auth: 'Authorization: Bearer <DEMO_SEED_SECRET>',
})
}, { auth: 'required' });
