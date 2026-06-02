import { NextRequest, NextResponse } from 'next/server'
import { WebhookIngestionService } from '@/lib/ems/integration'
import { enforceDistributedRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const rl = await enforceDistributedRateLimit(req, { namespace: 'ems.webhook', windowMs: 60_000, max: 300 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } })
  }
  const { provider } = await params
  const path = `/api/ems/integrations/webhooks/${provider}`
  const headers: Record<string, string | string[] | undefined> = {}
  req.headers.forEach((value, key) => { headers[key] = value })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const service = await WebhookIngestionService.findByPath(path)
  if (!service) {
    return NextResponse.json({ error: 'No webhook configuration found for this path' }, { status: 404 })
  }

  const result = await service.ingest({
    method: req.method,
    path,
    headers,
    body,
    query: Object.fromEntries(req.nextUrl.searchParams.entries()),
    sourceIp: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
  })

  return NextResponse.json(
    result.body ? { status: result.body } : {},
    { status: result.statusCode }
  )
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  const path = `/api/ems/integrations/webhooks/${provider}`
  const service = await WebhookIngestionService.findByPath(path)
  if (!service) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, provider })
}
