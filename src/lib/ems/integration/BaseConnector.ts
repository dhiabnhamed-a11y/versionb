import { prisma } from '@/lib/db'
import type {
  ConnectorConfig,
  ConnectorHealth,
  EmsIntegrationType,
  ConnectionStatus,
  SyncResult,
} from './types'

export abstract class BaseConnector {
  protected config: ConnectorConfig
  protected integrationId: string
  protected companyId: string
  protected type: EmsIntegrationType

  constructor(integrationId: string, companyId: string, type: EmsIntegrationType, config: ConnectorConfig) {
    this.integrationId = integrationId
    this.companyId = companyId
    this.type = type
    this.config = config
  }

  abstract connect(): Promise<boolean>
  abstract disconnect(): Promise<void>
  abstract testConnection(): Promise<{ success: boolean; latencyMs: number; message: string }>
  abstract healthCheck(): Promise<ConnectorHealth>

  async sync(entityType: string, params?: Record<string, unknown>): Promise<SyncResult> {
    const startTime = Date.now()
    try {
      const data = await this.fetchData(entityType, params)
      const transformed = await this.transformData(entityType, data)
      const result = await this.persistData(entityType, transformed)
      return { ...result, entityType, durationMs: Date.now() - startTime, success: true, errors: [] }
    } catch (error) {
      return {
        success: false,
        entityType,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        durationMs: Date.now() - startTime,
      }
    }
  }

  protected abstract fetchData(entityType: string, params?: Record<string, unknown>): Promise<unknown[]>
  protected abstract transformData(entityType: string, data: unknown[]): Promise<Record<string, unknown>[]>
  protected abstract persistData(entityType: string, data: Record<string, unknown>[]): Promise<{
    recordsProcessed: number
    recordsCreated: number
    recordsUpdated: number
    recordsFailed: number
  }>

  protected async updateStatus(status: ConnectionStatus, errorMessage?: string): Promise<void> {
    await prisma.emsIntegration.update({
      where: { id: this.integrationId },
      data: {
        status: status as any,
        lastConnectedAt: status === 'CONNECTED' ? new Date() : undefined,
        lastErrorAt: errorMessage ? new Date() : undefined,
        lastErrorMessage: errorMessage || null,
        errorCount: errorMessage ? { increment: 1 } : 0,
      },
    })
  }

  protected async recordEvent(event: {
    eventType: string
    source: string
    direction: 'inbound' | 'outbound'
    rawPayload?: unknown
    transformedPayload?: unknown
    status: 'received' | 'processing' | 'completed' | 'failed' | 'rejected'
    statusCode?: number
    errorMessage?: string
    idempotencyKey?: string
  }): Promise<void> {
    await prisma.emsIntegrationEvent.create({
      data: {
        companyId: this.companyId,
        integrationId: this.integrationId,
        eventType: event.eventType,
        source: event.source,
        direction: event.direction,
        rawPayload: event.rawPayload ?? undefined,
        transformedPayload: event.transformedPayload ?? undefined,
        status: event.status,
        statusCode: event.statusCode,
        errorMessage: event.errorMessage,
        idempotencyKey: event.idempotencyKey,
        receivedAt: new Date(),
        processedAt: event.status === 'completed' || event.status === 'failed' ? new Date() : undefined,
      },
    })
  }
}
