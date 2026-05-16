import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/db'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import { assertTimestampTolerance, storeReplayNonce } from '@/modules/security/request-signature'
import { getSocialProvider, isSocialProviderSlug } from '@/modules/integrations/core/provider-registry'
import type { SocialProviderSlug } from '@/modules/integrations/core/types'
import { enqueueSocialIntegrationJob } from '@/modules/integrations/jobs/social-job-queue'
import { recordIntegrationActivity } from '@/modules/integrations/security/audit'
import { toJsonValue } from '@/modules/shared/json'
import { badRequest, notFound, unauthorized } from '@/modules/shared/errors'
import { stableHash } from '@/modules/integrations/utils/hash'

function webhookSecret(providerSlug: SocialProviderSlug) {
  return (
    process.env[`SOCIAL_WEBHOOK_SECRET_${providerSlug.toUpperCase()}`] ||
    process.env.SOCIAL_WEBHOOK_SECRET ||
    ''
  )
}

function safeCompare(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function cleanSignature(value: string | null) {
  return value?.trim().replace(/^sha256=/i, '') ?? ''
}

export function verifyWebhookSignature(providerSlug: SocialProviderSlug, headers: Headers, rawBody: string) {
  const secret = webhookSecret(providerSlug)
  if (!secret) throw unauthorized('Webhook signing secret is not configured.')

  if (providerSlug === 'twitch') {
    const messageId = headers.get('x-twitch-eventsub-message-id')
    const timestamp = headers.get('x-twitch-eventsub-message-timestamp')
    const signature = cleanSignature(headers.get('x-twitch-eventsub-message-signature'))
    if (!messageId || !timestamp || !signature) return false
    const expected = createHmac('sha256', secret).update(`${messageId}${timestamp}${rawBody}`).digest('hex')
    return safeCompare(signature, expected)
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const signatures = [
    headers.get('x-hub-signature-256')?.replace(/^sha256=/, ''),
    headers.get('x-signature'),
    headers.get('x-tiktok-signature'),
    headers.get('x-twitter-webhooks-signature')?.replace(/^sha256=/, ''),
    headers.get('x-twitch-eventsub-message-signature')?.replace(/^sha256=/, ''),
  ].filter((value): value is string => Boolean(value))

  return signatures.some((signature) => safeCompare(signature, expected))
}

function timestampFromWebhook(headers: Headers, payload: unknown) {
  const headerTimestamp =
    headers.get('x-taskit-timestamp') ??
    headers.get('x-signature-timestamp') ??
    headers.get('x-timestamp') ??
    headers.get('x-twitch-eventsub-message-timestamp') ??
    headers.get('x-tiktok-timestamp')

  if (headerTimestamp) return headerTimestamp

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    for (const key of ['timestamp', 'created_at', 'createdAt', 'created_time']) {
      if (typeof record[key] === 'string' || typeof record[key] === 'number') return String(record[key])
    }
  }

  return null
}

function headerJson(headers: Headers) {
  return Object.fromEntries(
    Array.from(headers.entries())
      .filter(([key]) => key.startsWith('x-') || key === 'user-agent')
      .slice(0, 40)
  )
}

function eventIdFromPayload(headers: Headers, payload: unknown) {
  if (headers.get('x-twitch-eventsub-message-id')) return headers.get('x-twitch-eventsub-message-id')
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (typeof record.id === 'string') return record.id
    if (typeof record.event_id === 'string') return record.event_id
    if (typeof record.webhook_event_id === 'string') return record.webhook_event_id
  }
  return null
}

function eventTypeFromPayload(headers: Headers, payload: unknown) {
  if (headers.get('x-twitch-eventsub-subscription-type')) return headers.get('x-twitch-eventsub-subscription-type')!
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (typeof record.type === 'string') return record.type
    if (typeof record.event === 'string') return record.event
    if (typeof record.object === 'string') return record.object
  }
  return 'unknown'
}

function providerAccountIdFromPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>
  for (const key of ['providerAccountId', 'provider_account_id', 'account_id', 'channel_id', 'broadcaster_user_id']) {
    if (typeof record[key] === 'string') return record[key] as string
  }
  return null
}

export async function receiveSocialWebhook(input: {
  providerSlug: string
  rawBody: string
  payload: unknown
  headers: Headers
}) {
  if (!isSocialProviderSlug(input.providerSlug)) throw badRequest('Unsupported webhook provider.')
  const provider = getSocialProvider(input.providerSlug)
  const signatureValid = verifyWebhookSignature(provider.slug, input.headers, input.rawBody)
  if (!signatureValid) throw unauthorized('Invalid webhook signature.')

  const providerEventId = eventIdFromPayload(input.headers, input.payload)
  const timestamp = assertTimestampTolerance(timestampFromWebhook(input.headers, input.payload), 10 * 60 * 1000)
  const replayNonce = providerEventId ?? stableHash({ provider: provider.slug, rawBody: input.rawBody }).slice(0, 64)
  await storeReplayNonce({
    namespace: `webhook:${provider.slug}`,
    nonce: replayNonce,
    expiresAt: new Date(timestamp.getTime() + 10 * 60 * 1000),
  })

  const eventType = eventTypeFromPayload(input.headers, input.payload)
  const providerAccountId = providerAccountIdFromPayload(input.payload)
  const account = providerAccountId
    ? await prisma.connectedAccount.findFirst({
        where: { platformSlug: provider.slug, providerAccountId, status: 'CONNECTED' },
        select: { id: true, companyId: true },
      })
    : null

  const event = await prisma.socialWebhookEvent.upsert({
    where: {
      providerSlug_providerEventId: {
        providerSlug: provider.slug,
        providerEventId: providerEventId ?? stableHash({ provider: provider.slug, rawBody: input.rawBody }).slice(0, 48),
      },
    },
    update: {
      signatureValid,
      processingStatus: 'RECEIVED',
      payload: toJsonValue(input.payload)!,
      headers: toJsonValue(headerJson(input.headers)),
      companyId: account?.companyId ?? null,
      connectedAccountId: account?.id ?? null,
    },
    create: {
      providerSlug: provider.slug,
      eventType,
      providerEventId: providerEventId ?? stableHash({ provider: provider.slug, rawBody: input.rawBody }).slice(0, 48),
      signatureValid,
      processingStatus: 'RECEIVED',
      payload: toJsonValue(input.payload)!,
      headers: toJsonValue(headerJson(input.headers)),
      companyId: account?.companyId ?? null,
      connectedAccountId: account?.id ?? null,
    },
  })

  if (account?.companyId) {
    await enqueueSocialIntegrationJob({
      name: 'social.webhook.process',
      companyId: account.companyId,
      providerSlug: provider.slug,
      connectedAccountId: account.id,
      entityType: 'webhook_event',
      entityId: event.id,
      payload: { webhookEventId: event.id },
      priority: 5,
      maxAttempts: 5,
    })
  }

  return { event, signatureValid }
}

export async function processSocialWebhookEvent(input: { webhookEventId: string; attempts?: number }) {
  const event = await prisma.socialWebhookEvent.findUnique({ where: { id: input.webhookEventId } })
  if (!event) throw notFound('Webhook event not found.')
  if (!event.companyId || !event.connectedAccountId) {
    await prisma.socialWebhookEvent.update({
      where: { id: event.id },
      data: { processingStatus: 'IGNORED', processedAt: new Date(), error: 'Webhook could not be matched to a connected account.' },
    })
    return { ignored: true }
  }
  const provider = getSocialProvider(event.providerSlug)

  await prisma.socialWebhookEvent.update({ where: { id: event.id }, data: { processingStatus: 'PROCESSING' } })
  await enqueueSocialIntegrationJob({
    name: 'social.analytics.sync',
    companyId: event.companyId,
    providerSlug: provider.slug,
    connectedAccountId: event.connectedAccountId,
    payload: { mode: 'incremental', sourceWebhookEventId: event.id },
    priority: 5,
    maxAttempts: 5,
  })
  await prisma.socialWebhookEvent.update({ where: { id: event.id }, data: { processingStatus: 'PROCESSED', processedAt: new Date() } })
  await recordIntegrationActivity({
    companyId: event.companyId,
    connectedAccountId: event.connectedAccountId,
    action: 'social.webhook.processed',
    metadata: { provider: provider.slug, webhookEventId: event.id, eventType: event.eventType },
  })
  emitCompanyRealtime(event.companyId, 'social_webhook_processed', { webhookEventId: event.id, provider: provider.slug })
  return { processed: true }
}
