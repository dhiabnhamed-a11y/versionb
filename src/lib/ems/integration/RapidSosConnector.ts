/**
 * RapidSOS Emergency Data Exchange (EDX) Connector
 * API docs: https://rapidsos.com/developers/
 * Auth: OAuth 2.0 client_credentials
 * Base URL: https://api.rapidsos.com/v2
 *
 * Required env / integration config:
 *   clientId, clientSecret (OAuth2)
 *   endpointUrl defaults to https://api.rapidsos.com/v2
 */
import { BaseConnector } from './BaseConnector'
import type { ConnectorConfig, ConnectorHealth, EmsIntegrationType, SyncResult } from './types'

interface RapidSosToken {
  access_token: string
  expires_in: number
  token_type: string
}

interface RapidSosSession {
  session_id: string
  call_id: string
  caller_ani: string
  caller_ali: string
  lat?: number
  lng?: number
  accuracy?: number
  incident_type?: string
  created_at: string
  status: 'ACTIVE' | 'CLOSED'
  emergency_data?: {
    medical_conditions?: string[]
    medications?: string[]
    allergies?: string[]
    blood_type?: string
  }
}

export class RapidSosConnector extends BaseConnector {
  private baseUrl: string
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0
  private eventsProcessed = 0
  private eventsFailed = 0
  private connectTime: number | null = null

  constructor(integrationId: string, companyId: string, type: EmsIntegrationType, config: ConnectorConfig) {
    super(integrationId, companyId, type, config)
    this.baseUrl = config.endpointUrl || 'https://api.rapidsos.com/v2'
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 30_000) {
      return this.accessToken
    }
    const oauth = this.config.oauthConfig
    if (!oauth?.clientId || !oauth?.clientSecret) {
      throw new Error('RapidSOS requires oauthConfig.clientId and oauthConfig.clientSecret')
    }
    const res = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: oauth.clientId,
        client_secret: oauth.clientSecret,
        scope: 'read:sessions read:alerts write:alerts',
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs || 10_000),
    })
    if (!res.ok) throw new Error(`RapidSOS token failed: HTTP ${res.status}`)
    const token: RapidSosToken = await res.json()
    this.accessToken = token.access_token
    this.tokenExpiresAt = Date.now() + token.expires_in * 1000
    return this.accessToken
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken()
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-RapidSOS-Partner-Id': this.config.apiKey || '',
    }
  }

  async connect(): Promise<boolean> {
    try {
      const result = await this.testConnection()
      if (result.success) {
        this.connectTime = Date.now()
        await this.updateStatus('CONNECTED')
      } else {
        await this.updateStatus('ERROR', result.message)
      }
      return result.success
    } catch (err) {
      await this.updateStatus('ERROR', err instanceof Error ? err.message : 'Connection failed')
      return false
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = null
    this.tokenExpiresAt = 0
    this.connectTime = null
    await this.updateStatus('DISCONNECTED')
  }

  async testConnection(): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const start = Date.now()
    try {
      const headers = await this.authHeaders()
      const res = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(this.config.timeoutMs || 10_000),
      })
      const latencyMs = Date.now() - start
      if (res.ok) return { success: true, latencyMs, message: 'RapidSOS EDX connected' }
      return { success: false, latencyMs, message: `HTTP ${res.status}` }
    } catch (err) {
      return { success: false, latencyMs: Date.now() - start, message: err instanceof Error ? err.message : 'Connection failed' }
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

  async getActiveSessions(): Promise<RapidSosSession[]> {
    const headers = await this.authHeaders()
    const res = await fetch(`${this.baseUrl}/sessions?status=ACTIVE&limit=50`, {
      headers, signal: AbortSignal.timeout(this.config.timeoutMs || 15_000),
    })
    if (!res.ok) throw new Error(`RapidSOS sessions failed: HTTP ${res.status}`)
    const data = await res.json()
    return data.sessions || data.data || []
  }

  async getSession(sessionId: string): Promise<RapidSosSession> {
    const headers = await this.authHeaders()
    const res = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
      headers, signal: AbortSignal.timeout(this.config.timeoutMs || 10_000),
    })
    if (!res.ok) throw new Error(`RapidSOS session ${sessionId}: HTTP ${res.status}`)
    return res.json()
  }

  async postEmergencyAlert(payload: {
    incidentId: string
    lat: number
    lng: number
    severity: string
    chiefComplaint: string
    unitId?: string
    etaSeconds?: number
  }): Promise<{ alertId: string; acknowledged: boolean }> {
    const headers = await this.authHeaders()
    const body = {
      incident_reference: payload.incidentId,
      location: { lat: payload.lat, lng: payload.lng, accuracy: 50 },
      incident_type: this.mapSeverityToType(payload.severity),
      chief_complaint: payload.chiefComplaint,
      ...(payload.unitId ? { responding_unit: { unit_id: payload.unitId } } : {}),
      ...(payload.etaSeconds ? { eta_seconds: payload.etaSeconds } : {}),
      timestamp: new Date().toISOString(),
    }
    const res = await fetch(`${this.baseUrl}/alerts`, {
      method: 'POST', headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs || 10_000),
    })
    if (!res.ok) {
      this.eventsFailed++
      throw new Error(`RapidSOS alert failed: HTTP ${res.status}`)
    }
    this.eventsProcessed++
    const result = await res.json()
    return { alertId: result.alert_id || result.id, acknowledged: result.acknowledged ?? false }
  }

  private mapSeverityToType(severity: string): string {
    const map: Record<string, string> = {
      ALPHA: 'medical_non_urgent', BRAVO: 'medical_urgent',
      CHARLIE: 'medical_serious', DELTA: 'medical_critical',
      ECHO: 'medical_life_threatening', OMEGA: 'mass_casualty',
    }
    return map[severity] || 'medical_urgent'
  }

  protected async fetchData(entityType: string, params?: Record<string, unknown>): Promise<unknown[]> {
    if (entityType === 'sessions') return this.getActiveSessions()
    return []
  }

  protected async transformData(entityType: string, data: unknown[]): Promise<Record<string, unknown>[]> {
    if (entityType === 'sessions') {
      return (data as RapidSosSession[]).map((s) => ({
        externalId: s.session_id,
        callerPhone: s.caller_ani,
        address: s.caller_ali,
        lat: s.lat,
        lng: s.lng,
        callSource: 'E911',
        medicalHistory: s.emergency_data?.medical_conditions?.join(', '),
        medications: s.emergency_data?.medications?.join(', '),
        allergies: s.emergency_data?.allergies?.join(', '),
      }))
    }
    return []
  }

  protected async persistData(_entityType: string, data: Record<string, unknown>[]): Promise<SyncResult> {
    const { prisma } = await import('@/lib/db')
    let created = 0; let failed = 0
    for (const record of data) {
      try {
        await prisma.emsIncident.create({
          data: {
            companyId: this.companyId,
            incidentNumber: `E911-${record.externalId}`,
            callSource: 'E911' as any,
            severity: 'CHARLIE' as any,
            status: 'PENDING' as any,
            callerPhone: record.callerPhone as string,
            address: record.address as string,
            lat: record.lat as number,
            lng: record.lng as number,
            calledAt: new Date(),
          },
        })
        created++
      } catch { failed++ }
    }
    this.eventsProcessed += data.length
    this.eventsFailed += failed
    return { success: failed < data.length, entityType: 'incident', recordsProcessed: data.length, recordsCreated: created, recordsUpdated: 0, recordsFailed: failed, errors: [], durationMs: 0 }
  }
}
