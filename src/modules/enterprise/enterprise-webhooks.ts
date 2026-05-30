import { enterpriseRepositoryPrisma } from '@/modules/enterprise/enterprise.repository'
import { recordEnterpriseAudit } from '@/modules/enterprise/enterprise-audit'
import { badRequest, notFound } from '@/modules/shared/errors'
import { logger } from '@/modules/shared/logger'
import type { SessionUser } from '@/modules/shared/session'

function company(user: SessionUser) {
  if (!user.companyId) throw badRequest('No company found.')
  return user.companyId
}

// ── Webhook Config Management ────────────────────────────────────

export async function listWebhookConfigs(user: SessionUser) {
  const cid = company(user)
  const prefs = await enterpriseRepositoryPrisma.notificationPreference.findFirst({
    where: { userId: user.id },
  })
  const muted = (prefs?.mutedEntities as Record<string, unknown>) || {}
  return (muted.enterpriseWebhooks as Record<string, unknown>[]) || []
}

export async function createWebhookConfig(
  user: SessionUser,
  input: {
    name: string
    url: string
    events: string[]
    secret?: string | null
    isActive?: boolean
  }
) {
  const cid = company(user)

  if (!input.url.startsWith('https://')) {
    throw badRequest('Webhook URL must use HTTPS.')
  }

  let prefs = await enterpriseRepositoryPrisma.notificationPreference.findFirst({
    where: { userId: user.id },
  })

  if (!prefs) {
    prefs = await enterpriseRepositoryPrisma.notificationPreference.create({
      data: { userId: user.id, mutedEntities: { enterpriseWebhooks: [] } },
    })
  }

  const existing = (prefs.mutedEntities as Record<string, unknown>) || {}
  const webhooks = (existing.enterpriseWebhooks as Record<string, unknown>[]) || []

  const config = {
    id: `wh_${Date.now()}`,
    name: input.name,
    url: input.url,
    events: input.events,
    secret: input.secret || null,
    isActive: input.isActive ?? true,
    createdAt: new Date().toISOString(),
  }

  webhooks.push(config)

  await enterpriseRepositoryPrisma.notificationPreference.update({
    where: { id: prefs.id },
    data: { mutedEntities: { ...existing, enterpriseWebhooks: webhooks } as any },
  })

  return config
}

export async function deleteWebhookConfig(user: SessionUser, webhookId: string) {
  const prefs = await enterpriseRepositoryPrisma.notificationPreference.findFirst({
    where: { userId: user.id },
  })
  if (!prefs) throw notFound('No webhook configs found.')

  const existing = (prefs.mutedEntities as Record<string, unknown>) || {}
  const webhooks = (existing.enterpriseWebhooks as Record<string, unknown>[]) || []
  const filtered = webhooks.filter((w: any) => w.id !== webhookId)

  if (filtered.length === webhooks.length) {
    throw notFound('Webhook config not found.')
  }

  await enterpriseRepositoryPrisma.notificationPreference.update({
    where: { id: prefs.id },
    data: { mutedEntities: { ...existing, enterpriseWebhooks: filtered } as any },
  })

  return { deleted: true }
}

// ── Webhook Delivery ─────────────────────────────────────────────

export async function deliverWebhook(
  companyId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ delivered: number; failed: number }> {
  let delivered = 0
  let failed = 0

  const prefsList = await enterpriseRepositoryPrisma.notificationPreference.findMany({
    where: { user: { companyId } },
    select: { mutedEntities: true },
  })

  const webhooks: Record<string, unknown>[] = []
  for (const p of prefsList) {
    const muted = (p.mutedEntities as Record<string, unknown>) || {}
    const hooks = (muted.enterpriseWebhooks as Record<string, unknown>[]) || []
    webhooks.push(...hooks)
  }

  const matched = webhooks.filter((w: any) => w.isActive !== false && w.events?.includes(eventType))

  for (const config of matched) {
    try {
      const url = (config as any).url
      const secret = (config as any).secret

      const body = JSON.stringify({ event: eventType, payload, sentAt: new Date().toISOString() })
      const signature = secret ? await createHmacSignature(secret, body) : undefined

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(signature ? { 'X-Enterprise-Signature-256': signature } : {}),
          'X-Enterprise-Event': eventType,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      })

      if (response.ok) {
        delivered++
      } else {
        failed++
        logger.warn('enterprise.webhook_delivery_failed', { url, eventType, status: response.status })
      }
    } catch (err: any) {
      failed++
      logger.error('enterprise.webhook_delivery_error', err, { eventType, webhookId: (config as any).id })
    }
  }

  return { delivered, failed }
}

async function createHmacSignature(secret: string, body: string): Promise<string> {
  const { createHmac } = await import('crypto')
  return createHmac('sha256', secret).update(body).digest('hex')
}

export async function deliverEnterpriseEvent(
  companyId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  const result = await deliverWebhook(companyId, eventType, payload)

  await recordEnterpriseAudit({
    companyId,
    actorId: null,
    action: 'enterprise.webhook.delivery',
    entityType: 'enterprise_webhook_event',
    entityId: eventType,
    after: { eventType, delivered: result.delivered, failed: result.failed },
  })

  return result
}
