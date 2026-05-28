import { prisma } from '@/lib/db'
import { BaseConnector } from './BaseConnector'
import { CadConnector } from './CadConnector'
import { FhirConnector } from './FhirConnector'
import { AuditService } from './AuditService'
import type { ConnectorConfig, EmsIntegrationType, ConnectorHealth } from './types'

export class IntegrationRegistry {
  private static instance: IntegrationRegistry
  private connectors: Map<string, BaseConnector> = new Map()
  private healthCache: Map<string, { health: ConnectorHealth; timestamp: number }> = new Map()
  private readonly HEALTH_CACHE_TTL = 30000 // 30 seconds

  private constructor() {}

  static getInstance(): IntegrationRegistry {
    if (!this.instance) {
      this.instance = new IntegrationRegistry()
    }
    return this.instance
  }

  getConnector(integrationId: string): BaseConnector | undefined {
    return this.connectors.get(integrationId)
  }

  async createConnector(
    integrationId: string,
    companyId: string,
    type: EmsIntegrationType,
    config: ConnectorConfig
  ): Promise<BaseConnector> {
    const existing = this.connectors.get(integrationId)
    if (existing) {
      await existing.disconnect()
      this.connectors.delete(integrationId)
    }

    let connector: BaseConnector
    if (type.startsWith('CAD_')) {
      connector = new CadConnector(integrationId, companyId, type, config)
    } else if (type === 'FHIR' || type.startsWith('EHR_')) {
      connector = new FhirConnector(integrationId, companyId, type, config)
    } else {
      connector = new CadConnector(integrationId, companyId, type, config)
    }

    this.connectors.set(integrationId, connector)

    const audit = new AuditService(companyId)
    await audit.logIntegrationAction({
      integrationId,
      action: 'EMS_INTEGRATION_CONFIGURED',
      description: `Connector created for ${type}`,
      success: true,
    })

    return connector
  }

  async removeConnector(integrationId: string): Promise<void> {
    const connector = this.connectors.get(integrationId)
    if (connector) {
      await connector.disconnect()
      this.connectors.delete(integrationId)
    }
    this.healthCache.delete(integrationId)
  }

  async connectAll(companyId?: string): Promise<void> {
    const where: Record<string, unknown> = {
      isEnabled: true,
      status: { not: 'DISCONNECTED' as any },
    }
    if (companyId) where.companyId = companyId

    const integrations = await prisma.emsIntegration.findMany({
      where,
      include: { fieldMappings: true },
    })

    for (const integration of integrations) {
      const config = {
        endpointUrl: integration.endpointUrl || undefined,
        authType: integration.authType as any,
        apiKey: integration.apiKey || undefined,
        oauthConfig: (integration.oauthConfig || undefined) as any,
        webhookSecret: integration.webhookSecret || undefined,
        pollingEnabled: integration.pollingEnabled,
        pollingInterval: integration.pollingInterval || undefined,
        retryCount: integration.retryCount,
        retryDelayMs: integration.retryDelayMs,
        rateLimit: integration.rateLimit || undefined,
        timeoutMs: integration.timeoutMs,
        ...(integration.config as Record<string, unknown> || {}),
      }

      try {
        const connector = await this.createConnector(
          integration.id,
          integration.companyId,
          integration.type as EmsIntegrationType,
          config
        )
        await connector.connect()
      } catch (err) {
        console.error(`Failed to connect ${integration.id} (${integration.type}):`, err)
      }
    }
  }

  async getHealth(integrationId: string): Promise<ConnectorHealth | null> {
    const cached = this.healthCache.get(integrationId)
    if (cached && Date.now() - cached.timestamp < this.HEALTH_CACHE_TTL) {
      return cached.health
    }

    const connector = this.connectors.get(integrationId)
    if (!connector) {
      // Check DB
      const integration = await prisma.emsIntegration.findUnique({ where: { id: integrationId } })
      if (!integration) return null
      return {
        status: integration.status as any,
        lastConnectedAt: integration.lastConnectedAt?.toISOString() || null,
        lastErrorAt: integration.lastErrorAt?.toISOString() || null,
        lastErrorMessage: integration.lastErrorMessage,
        latencyMs: null,
        uptimePercentage: null,
        eventsProcessed: 0,
        eventsFailed: integration.errorCount,
      }
    }

    const health = await connector.healthCheck()
    this.healthCache.set(integrationId, { health, timestamp: Date.now() })
    return health
  }

  async getIntegrationStatus(companyId: string): Promise<{
    total: number
    connected: number
    error: number
    disconnected: number
    pending: number
    integrations: Array<{ id: string; name: string; type: string; status: string; health: ConnectorHealth | null }>
  }> {
    const integrations = await prisma.emsIntegration.findMany({
      where: { companyId },
    })

    const results = await Promise.all(
      integrations.map(async (integration) => {
        const health = await this.getHealth(integration.id)
        return {
          id: integration.id,
          name: integration.name,
          type: integration.type,
          status: integration.status,
          health,
        }
      })
    )

    const counts = { total: 0, connected: 0, error: 0, disconnected: 0, pending: 0 }
    for (const i of results) {
      counts.total++
      if (i.status === 'CONNECTED') counts.connected++
      else if (i.status === 'ERROR') counts.error++
      else if (i.status === 'DISCONNECTED') counts.disconnected++
      else counts.pending++
    }

    return { ...counts, integrations: results }
  }

  async disconnectAll(): Promise<void> {
    for (const [id, connector] of this.connectors) {
      try {
        await connector.disconnect()
      } catch (err) {
        console.error(`Error disconnecting ${id}:`, err)
      }
    }
    this.connectors.clear()
    this.healthCache.clear()
  }
}
