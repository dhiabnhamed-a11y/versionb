/**
 * Motorola Solutions PremierOne CAD Connector
 * Protocol: REST (PremierOne REST API v3.x)
 * Auth: OAuth2 client_credentials or API key
 * Requires: Motorola Solutions partner agreement + API license
 *
 * API fields based on PremierOne CAD Integration Reference Guide (v3.2)
 * Contact: motorolasolutions.com/en_us/products/command-center-software/premierone-command-center.html
 */
import { BaseConnector } from './BaseConnector'
import type { ConnectorConfig, ConnectorHealth, EmsIntegrationType, SyncResult } from './types'

interface PremierOneIncident {
  IncidentNumber: string
  CallType: string
  Priority: '1' | '2' | '3' | '4' | '5'
  Status: 'NEW' | 'DISPATCHED' | 'ENROUTE' | 'ONSCENE' | 'CLEARED'
  Address: { FullAddress: string; Latitude?: number; Longitude?: number }
  CallerName?: string
  CallerPhone?: string
  CallerNotes?: string
  PatientCount?: number
  CreatedAt: string
  UpdatedAt: string
  AssignedUnits?: Array<{ UnitId: string; UnitNumber: string; Status: string }>
}

interface PremierOneUnit {
  UnitId: string
  UnitNumber: string
  UnitType: 'ALS' | 'BLS' | 'MICU' | 'SUP'
  Status: 'AVAILABLE' | 'DISPATCHED' | 'ENROUTE' | 'ONSCENE' | 'TRANSPORTING' | 'OUTOFSERVICE'
  Latitude?: number
  Longitude?: number
  Heading?: number
  Speed?: number
  LastUpdate: string
}

const PRIORITY_TO_SEVERITY: Record<string, string> = {
  '1': 'ECHO', '2': 'DELTA', '3': 'CHARLIE', '4': 'BRAVO', '5': 'ALPHA',
}

const PREMIERONE_STATUS_MAP: Record<string, string> = {
  NEW: 'PENDING', DISPATCHED: 'DISPATCHED', ENROUTE: 'EN_ROUTE',
  ONSCENE: 'ON_SCENE', CLEARED: 'COMPLETED',
}

export class MotorolaConnector extends BaseConnector {
  private baseUrl: string
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0
  private eventsProcessed = 0
  private eventsFailed = 0
  private connectTime: number | null = null

  constructor(integrationId: string, companyId: string, type: EmsIntegrationType, config: ConnectorConfig) {
    super(integrationId, companyId, type, config)
    this.baseUrl = config.endpointUrl || ''
  }

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 30_000) return this.accessToken
    if (this.config.authType === 'api_key' && this.config.apiKey) return this.config.apiKey
    const oauth = this.config.oauthConfig
    if (!oauth?.clientId || !oauth?.clientSecret) throw new Error('PremierOne requires OAuth2 or API key')

    const res = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: oauth.clientId,
        client_secret: oauth.clientSecret,
        scope: 'incidents:read units:read dispatch:write',
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`PremierOne token: HTTP ${res.status}`)
    const t = await res.json()
    this.accessToken = t.access_token
    this.tokenExpiresAt = Date.now() + (t.expires_in || 3600) * 1000
    return this.accessToken!
  }

  private async headers(): Promise<Record<string, string>> {
    const token = await this.getToken()
    const isApiKey = this.config.authType === 'api_key'
    return {
      [isApiKey ? 'X-API-Key' : 'Authorization']: isApiKey ? token : `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-PremierOne-Agency': this.config.headers?.['X-PremierOne-Agency'] || '',
    }
  }

  async connect(): Promise<boolean> {
    if (!this.baseUrl) {
      await this.updateStatus('ERROR', 'No endpoint URL configured. Contact Motorola Solutions for your agency API URL.')
      return false
    }
    const result = await this.testConnection()
    if (result.success) { this.connectTime = Date.now(); await this.updateStatus('CONNECTED') }
    else await this.updateStatus('ERROR', result.message)
    return result.success
  }

  async disconnect(): Promise<void> {
    this.accessToken = null; this.connectTime = null
    await this.updateStatus('DISCONNECTED')
  }

  async testConnection(): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const start = Date.now()
    try {
      const res = await fetch(`${this.baseUrl}/v3/health`, {
        headers: await this.headers(), signal: AbortSignal.timeout(this.config.timeoutMs || 10_000),
      })
      const latencyMs = Date.now() - start
      if (res.ok) return { success: true, latencyMs, message: 'PremierOne CAD connected' }
      return { success: false, latencyMs, message: `HTTP ${res.status} — check agency URL and credentials` }
    } catch (err) {
      return { success: false, latencyMs: Date.now() - start, message: err instanceof Error ? err.message : 'Connection failed' }
    }
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const r = await this.testConnection()
    return {
      status: r.success ? 'CONNECTED' : 'ERROR',
      lastConnectedAt: this.connectTime ? new Date(this.connectTime).toISOString() : null,
      lastErrorAt: r.success ? null : new Date().toISOString(),
      lastErrorMessage: r.success ? null : r.message,
      latencyMs: r.latencyMs, uptimePercentage: null,
      eventsProcessed: this.eventsProcessed, eventsFailed: this.eventsFailed,
    }
  }

  async getActiveIncidents(): Promise<PremierOneIncident[]> {
    const res = await fetch(`${this.baseUrl}/v3/incidents?status=active&limit=100`, {
      headers: await this.headers(), signal: AbortSignal.timeout(this.config.timeoutMs || 15_000),
    })
    if (!res.ok) throw new Error(`PremierOne incidents: HTTP ${res.status}`)
    const data = await res.json()
    return data.incidents || data.data || []
  }

  async getUnits(): Promise<PremierOneUnit[]> {
    const res = await fetch(`${this.baseUrl}/v3/units?limit=200`, {
      headers: await this.headers(), signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`PremierOne units: HTTP ${res.status}`)
    const data = await res.json()
    return data.units || data.data || []
  }

  async updateUnitStatus(unitId: string, status: string): Promise<void> {
    const cadStatus = Object.entries(PREMIERONE_STATUS_MAP).find(([, v]) => v === status)?.[0] || status
    const res = await fetch(`${this.baseUrl}/v3/units/${unitId}/status`, {
      method: 'PATCH', headers: await this.headers(),
      body: JSON.stringify({ Status: cadStatus, Timestamp: new Date().toISOString() }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`PremierOne unit status update: HTTP ${res.status}`)
  }

  protected async fetchData(entityType: string): Promise<unknown[]> {
    if (entityType === 'incidents') return this.getActiveIncidents()
    if (entityType === 'units') return this.getUnits()
    return []
  }

  protected async transformData(entityType: string, data: unknown[]): Promise<Record<string, unknown>[]> {
    if (entityType === 'incidents') {
      return (data as PremierOneIncident[]).map((i) => ({
        externalId: i.IncidentNumber,
        incidentNumber: i.IncidentNumber,
        severity: PRIORITY_TO_SEVERITY[i.Priority] || 'ALPHA',
        status: PREMIERONE_STATUS_MAP[i.Status] || 'PENDING',
        address: i.Address.FullAddress,
        lat: i.Address.Latitude,
        lng: i.Address.Longitude,
        callerName: i.CallerName,
        callerPhone: i.CallerPhone,
        callerNotes: i.CallerNotes,
        patientCount: i.PatientCount || 1,
        callSource: 'CAD',
        calledAt: new Date(i.CreatedAt),
      }))
    }
    if (entityType === 'units') {
      return (data as PremierOneUnit[]).map((u) => ({
        externalId: u.UnitId,
        unitNumber: u.UnitNumber,
        type: u.UnitType,
        status: u.Status === 'OUTOFSERVICE' ? 'OFFLINE' : u.Status,
        lat: u.Latitude,
        lng: u.Longitude,
        heading: u.Heading,
        speed: u.Speed,
        lastGpsUpdate: new Date(u.LastUpdate),
      }))
    }
    return []
  }

  protected async persistData(entityType: string, data: Record<string, unknown>[]): Promise<SyncResult> {
    const { prisma } = await import('@/lib/db')
    let created = 0; let updated = 0; let failed = 0
    for (const record of data) {
      try {
        if (entityType === 'incidents') {
          const existing = await prisma.emsIncident.findFirst({ where: { companyId: this.companyId, incidentNumber: record.externalId as string } })
          if (existing) {
            await prisma.emsIncident.update({ where: { id: existing.id }, data: { status: record.status as any, updatedAt: new Date() } })
            updated++
          } else {
            const { externalId, ...createData } = record
            await prisma.emsIncident.create({ data: { ...createData, companyId: this.companyId, status: (record.status || 'PENDING') as any, severity: (record.severity || 'ALPHA') as any, callSource: 'CAD' as any } as any })
            created++
          }
        }
        if (entityType === 'units') {
          await prisma.emsUnit.updateMany({
            where: { companyId: this.companyId, unitNumber: record.externalId as string },
            data: { lat: record.lat as number, lng: record.lng as number, heading: record.heading as number, speed: record.speed as number, lastGpsUpdate: record.lastGpsUpdate as Date },
          })
          updated++
        }
      } catch { failed++ }
    }
    this.eventsProcessed += data.length; this.eventsFailed += failed
    return { success: failed < data.length, entityType, recordsProcessed: data.length, recordsCreated: created, recordsUpdated: updated, recordsFailed: failed, errors: [], durationMs: 0 }
  }
}
