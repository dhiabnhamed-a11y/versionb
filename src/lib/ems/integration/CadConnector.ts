import { BaseConnector } from './BaseConnector'
import type { ConnectorConfig, ConnectorHealth, EmsIntegrationType, SyncResult } from './types'

type CadSystem = 'MOTOROLA' | 'HEXAGON' | 'TYLER' | 'CENTRAL_SQUARE' | 'ZOLL' | 'RAPID_SOS' | 'CUSTOM'

export class CadConnector extends BaseConnector {
  private cadSystem: CadSystem
  private baseUrl: string
  private connected = false
  private connectTime: number | null = null
  private eventsProcessed = 0
  private eventsFailed = 0

  constructor(integrationId: string, companyId: string, type: EmsIntegrationType, config: ConnectorConfig) {
    super(integrationId, companyId, type, config)
    this.cadSystem = this.parseCadSystem(type)
    this.baseUrl = config.endpointUrl || ''
  }

  private parseCadSystem(type: EmsIntegrationType): CadSystem {
    const map: Record<string, CadSystem> = {
      CAD_MOTOROLA: 'MOTOROLA',
      CAD_HEXAGON: 'HEXAGON',
      CAD_TYLER: 'TYLER',
      CAD_CENTRAL_SQUARE: 'CENTRAL_SQUARE',
      CAD_ZOLL: 'ZOLL',
      CAD_RAPID_SOS: 'RAPID_SOS',
      CAD_CUSTOM: 'CUSTOM',
    }
    return map[type] || 'CUSTOM'
  }

  private buildAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.config.authType === 'api_key' && this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey
    } else if (this.config.authType === 'basic' && this.config.basicAuth) {
      const encoded = Buffer.from(`${this.config.basicAuth.username}:${this.config.basicAuth.password}`).toString('base64')
      headers['Authorization'] = `Basic ${encoded}`
    } else if (this.config.headers) {
      Object.assign(headers, this.config.headers)
    }
    return headers
  }

  async connect(): Promise<boolean> {
    try {
      const result = await this.testConnection()
      this.connected = result.success
      if (result.success) {
        this.connectTime = Date.now()
        await this.updateStatus('CONNECTED')
      } else {
        await this.updateStatus('ERROR', result.message)
      }
      return result.success
    } catch (err) {
      this.connected = false
      const msg = err instanceof Error ? err.message : 'Connection failed'
      await this.updateStatus('ERROR', msg)
      return false
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.connectTime = null
    await this.updateStatus('DISCONNECTED')
  }

  async testConnection(): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const start = Date.now()
    try {
      const url = `${this.baseUrl}/health` || `${this.baseUrl}/status` || `${this.baseUrl}/ping`
      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildAuthHeaders(),
        signal: AbortSignal.timeout(this.config.timeoutMs || 10000),
      })
      const latencyMs = Date.now() - start
      if (response.ok) {
        return { success: true, latencyMs, message: `Connected to ${this.cadSystem} CAD` }
      }
      return { success: false, latencyMs, message: `HTTP ${response.status}: ${response.statusText}` }
    } catch (err) {
      const latencyMs = Date.now() - start
      return { success: false, latencyMs, message: err instanceof Error ? err.message : 'Connection timeout' }
    }
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const result = await this.testConnection()
    return {
      status: result.success ? 'CONNECTED' : 'ERROR',
      lastConnectedAt: this.connectTime ? new Date(this.connectTime).toISOString() : null,
      lastErrorAt: result.success ? null : new Date().toISOString(),
      lastErrorMessage: result.success ? null : result.message,
      latencyMs: result.latencyMs,
      uptimePercentage: null,
      eventsProcessed: this.eventsProcessed,
      eventsFailed: this.eventsFailed,
    }
  }

  protected async fetchData(entityType: string, params?: Record<string, unknown>): Promise<unknown[]> {
    if (!this.baseUrl) return []
    const endpoint = this.getEndpointForEntity(entityType)
    const queryParams = params ? new URLSearchParams(params as Record<string, string>).toString() : ''
    const url = queryParams ? `${this.baseUrl}${endpoint}?${queryParams}` : `${this.baseUrl}${endpoint}`
    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildAuthHeaders(),
      signal: AbortSignal.timeout(this.config.timeoutMs || 15000),
    })
    if (!response.ok) throw new Error(`CAD ${entityType} fetch failed: HTTP ${response.status}`)
    const data = await response.json()
    return Array.isArray(data) ? data : data.results || data.data || data.items || [data]
  }

  protected async transformData(entityType: string, data: unknown[]): Promise<Record<string, unknown>[]> {
    const { FieldMappingService } = await import('./FieldMappingService')
    const mappingService = new FieldMappingService(this.companyId, this.integrationId)
    const results: Record<string, unknown>[] = []
    for (const item of data) {
      const mapped = await mappingService.applyMappings(entityType, item as Record<string, unknown>)
      results.push(mapped)
    }
    return results
  }

  protected async persistData(entityType: string, data: Record<string, unknown>[]): Promise<{
    recordsProcessed: number
    recordsCreated: number
    recordsUpdated: number
    recordsFailed: number
  }> {
    const { prisma } = await import('@/lib/db')
    let created = 0; let updated = 0; let failed = 0

    for (const record of data) {
      try {
        const saved = await this.upsertEntity(entityType, record, prisma)
        if (saved === 'created') created++
        else updated++
      } catch {
        failed++
      }
    }

    const processed = data.length
    this.eventsProcessed += processed
    this.eventsFailed += failed
    return { recordsProcessed: processed, recordsCreated: created, recordsUpdated: updated, recordsFailed: failed }
  }

  private getEndpointForEntity(entityType: string): string {
    const endpoints: Record<string, string> = {
      incidents: '/api/incidents',
      units: '/api/units',
      dispatches: '/api/dispatch',
      crews: '/api/crews',
    }
    return endpoints[entityType] || `/api/${entityType}`
  }

  private async upsertEntity(entityType: string, data: Record<string, unknown>, prisma: any): Promise<'created' | 'updated'> {
    const externalId = data.externalId as string || data.id as string
    if (!externalId) return 'created'

    const existing = await this.findExisting(entityType, externalId, prisma)
    if (existing) {
      await this.updateExisting(entityType, externalId, data, prisma)
      return 'updated'
    }
    await this.createNew(entityType, data, prisma)
    return 'created'
  }

  private async findExisting(entityType: string, externalId: string, prisma: any): Promise<unknown> {
    if (entityType === 'incidents') {
      return prisma.emsIncident.findFirst({
        where: { companyId: this.companyId, incidentNumber: externalId },
      })
    }
    if (entityType === 'units') {
      return prisma.emsUnit.findFirst({
        where: { companyId: this.companyId, unitNumber: externalId },
      })
    }
    return null
  }

  private async updateExisting(entityType: string, externalId: string, data: Record<string, unknown>, prisma: any): Promise<void> {
    if (entityType === 'incidents') {
      const { incidentNumber, ...updateData } = data
      await prisma.emsIncident.updateMany({
        where: { companyId: this.companyId, incidentNumber: externalId },
        data: updateData,
      })
    }
  }

  private async createNew(entityType: string, data: Record<string, unknown>, prisma: any): Promise<void> {
    const createData = { ...data, companyId: this.companyId } as any
    if (entityType === 'incidents') {
      await prisma.emsIncident.create({ data: createData })
    } else if (entityType === 'units') {
      await prisma.emsUnit.create({ data: createData })
    }
  }
}
