import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { FieldMappingService } from './FieldMappingService'

interface WebhookRequest {
  method: string
  path: string
  headers: Record<string, string | string[] | undefined>
  body: unknown
  query: Record<string, string | string[] | undefined>
  sourceIp?: string
}

interface WebhookResult {
  accepted: boolean
  statusCode: number
  body?: string
  eventId?: string
  error?: string
}

export class WebhookIngestionService {
  private companyId: string
  private integrationId: string
  private configId: string

  constructor(companyId: string, integrationId: string, configId: string) {
    this.companyId = companyId
    this.integrationId = integrationId
    this.configId = configId
  }

  static async findByPath(path: string): Promise<WebhookIngestionService | null> {
    const config = await prisma.emsWebhookConfig.findFirst({
      where: { path, isEnabled: true },
      include: { integration: true },
    })
    if (!config || !config.integration.isEnabled) return null
    return new WebhookIngestionService(config.companyId, config.integrationId, config.id)
  }

  async ingest(req: WebhookRequest): Promise<WebhookResult> {
    const config = await prisma.emsWebhookConfig.findUnique({
      where: { id: this.configId },
      include: { integration: true },
    })
    if (!config || !config.isEnabled) {
      return { accepted: false, statusCode: 404, error: 'Webhook not found or disabled' }
    }

    // IP whitelist check
    if (config.allowedIps && req.sourceIp) {
      const allowed = config.allowedIps.split(',').map(ip => ip.trim())
      if (!allowed.includes(req.sourceIp)) {
        await this.logRejected('IP not allowed')
        return { accepted: false, statusCode: 403, error: 'Forbidden' }
      }
    }

    // Signature verification
    if (config.secretToken) {
      const signature = this.extractSignature(req.headers)
      if (!signature || !this.verifySignature(req.body, signature, config.secretToken)) {
        await this.logRejected('Invalid signature')
        return { accepted: false, statusCode: 401, error: 'Invalid signature' }
      }
    }

    // Create event record
    const event = await prisma.emsIntegrationEvent.create({
      data: {
        companyId: this.companyId,
        integrationId: this.integrationId,
        webhookConfigId: this.configId,
        eventType: this.detectEventType(req),
        source: config.sourceSystem || 'webhook',
        direction: 'inbound',
        rawPayload: req.body as any,
        headers: req.headers as any,
        status: 'received',
        receivedAt: new Date(),
      },
    })

    // Queue async processing via BullMQ
    try {
      const { Queue } = await import('bullmq')
      const { getRedisConnection } = await import('@/lib/redis')
      const queue = new Queue('ems:webhook-processing', { connection: getRedisConnection() })
      await queue.add('process-webhook', {
        eventId: event.id,
        companyId: this.companyId,
        integrationId: this.integrationId,
        webhookConfigId: this.configId,
        entityType: this.detectEntityType(req),
      }, {
        attempts: config.maxRetries || 3,
        backoff: { type: 'exponential', delay: 5000 },
      })
    } catch {
      // BullMQ not configured - process inline
      this.processEventInline(event.id, req).catch(() => {})
    }

    // Determine response
    if (config.ackMode === '202_ACCEPTED') {
      return { accepted: true, statusCode: 202, eventId: event.id, body: config.ackBody || 'Accepted' }
    }
    return { accepted: true, statusCode: 200, eventId: event.id, body: config.ackBody || 'OK' }
  }

  private extractSignature(headers: Record<string, string | string[] | undefined>): string | null {
    return (headers['x-hub-signature-256'] as string) ||
           (headers['x-signature'] as string) ||
           (headers['x-webhook-signature'] as string) ||
           null
  }

  private verifySignature(body: unknown, signature: string, secret: string): boolean {
    const payload = typeof body === 'string' ? body : JSON.stringify(body)
    const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  }

  private detectEventType(req: WebhookRequest): string {
    const eventHeader = (req.headers['x-event-type'] as string) ||
                        (req.headers['x-github-event'] as string) ||
                        (req.headers['x-webhook-event'] as string)
    if (eventHeader) return eventHeader.toLowerCase().replace(/\s+/g, '_')
    if (req.body && typeof req.body === 'object') {
      const body = req.body as Record<string, unknown>
      return (body.event_type as string) || (body.type as string) || (body.event as string) || 'unknown'
    }
    return 'unknown'
  }

  private detectEntityType(req: WebhookRequest): string {
    const path = req.path.toLowerCase()
    if (path.includes('incident')) return 'incident'
    if (path.includes('patient')) return 'patient'
    if (path.includes('unit') || path.includes('vehicle')) return 'unit'
    if (path.includes('dispatch')) return 'dispatch'
    if (path.includes('hospital')) return 'hospital'
    return 'unknown'
  }

  private async logRejected(reason: string): Promise<void> {
    await prisma.emsIntegrationEvent.create({
      data: {
        companyId: this.companyId,
        integrationId: this.integrationId,
        webhookConfigId: this.configId,
        eventType: 'rejected',
        source: 'webhook',
        direction: 'inbound',
        status: 'rejected',
        errorMessage: reason,
        receivedAt: new Date(),
      },
    })
  }

  private async processEventInline(eventId: string, _req: WebhookRequest): Promise<void> {
    try {
      await prisma.emsIntegrationEvent.update({
        where: { id: eventId },
        data: { status: 'processing', processedAt: new Date() },
      })
      // Apply field mappings and upsert data
      await this.processAndPersist(eventId)
    } catch (err) {
      await prisma.emsIntegrationEvent.update({
        where: { id: eventId },
        data: {
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : 'Processing failed',
          processedAt: new Date(),
        },
      })
    }
  }

  private async processAndPersist(eventId: string): Promise<void> {
    const event = await prisma.emsIntegrationEvent.findUnique({ where: { id: eventId } })
    if (!event || !event.rawPayload) return

    const mappingService = new FieldMappingService(this.companyId, this.integrationId)
    const entityType = this.detectEntityType({ method: 'POST', path: '', headers: {}, body: event.rawPayload, query: {} })

    // Persist via the integration's connector
    const integration = await prisma.emsIntegration.findUnique({ where: { id: this.integrationId } })
    if (!integration) return

    const { IntegrationRegistry } = await import('./IntegrationRegistry')
    const registry = IntegrationRegistry.getInstance()
    const connector = registry.getConnector(this.integrationId)
    if (connector) {
      const data = Array.isArray(event.rawPayload) ? event.rawPayload : [event.rawPayload]
      await connector.sync(entityType)
      // Record transformed payload
      const transformed = await mappingService.applyMappings(entityType, data[0] as Record<string, unknown>)
      await prisma.emsIntegrationEvent.update({
        where: { id: eventId },
        data: {
          transformedPayload: transformed as any,
          status: 'completed',
          processedAt: new Date(),
        },
      })
    } else {
      await prisma.emsIntegrationEvent.update({
        where: { id: eventId },
        data: {
          status: 'completed',
          processedAt: new Date(),
        },
      })
    }
  }
}
