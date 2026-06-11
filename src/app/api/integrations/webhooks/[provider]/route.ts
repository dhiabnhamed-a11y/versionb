import { NextRequest, NextResponse } from 'next/server'
import { isSocialProviderSlug } from '@/modules/integrations/core/provider-registry'
import { receiveSocialWebhook } from '@/modules/integrations/webhooks/webhook.service'
import { badRequest } from '@/modules/shared/errors'
import { withApiError } from '@/modules/shared/api'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
const { provider } = await params
if (!isSocialProviderSlug(provider)) return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 })

const challenge = req.nextUrl.searchParams.get('hub.challenge') ?? req.nextUrl.searchParams.get('challenge')
const verifyToken = req.nextUrl.searchParams.get('hub.verify_token') ?? req.nextUrl.searchParams.get('verify_token')
const expected = process.env[`SOCIAL_WEBHOOK_VERIFY_TOKEN_${provider.toUpperCase()}`] || process.env.SOCIAL_WEBHOOK_VERIFY_TOKEN

if (challenge && expected && verifyToken === expected) {
return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
}

return NextResponse.json({ ok: true, provider })
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return withApiError(req, async () => {
const { provider } = await params
if (!isSocialProviderSlug(provider)) throw badRequest('Unsupported social provider.')

const rawBody = await req.text()
let payload: unknown = {}
try {
  payload = rawBody ? JSON.parse(rawBody) : {}
} catch {
  throw badRequest('Webhook payload must be valid JSON.')
}
const challenge = payload && typeof payload === 'object' && 'challenge' in payload ? (payload as { challenge?: unknown }).challenge : null
if (typeof challenge === 'string') {
  return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
}

const result = await receiveSocialWebhook({
  providerSlug: provider,
  rawBody,
  payload,
  headers: req.headers,
})

return NextResponse.json({ ok: true, received: true, signatureValid: result.signatureValid })
}, {
rateLimit: {
  namespace: 'integrations.webhooks',
  windowMs: 60_000,
  max: 120,
},
})
}, { auth: 'required' });
