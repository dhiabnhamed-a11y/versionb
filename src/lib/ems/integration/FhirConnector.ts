import { BaseConnector } from './BaseConnector'
import type { ConnectorConfig, ConnectorHealth, EmsIntegrationType } from './types'

interface FhirResource {
  resourceType: string
  id: string
  [key: string]: unknown
}

interface FhirBundle {
  resourceType: 'Bundle'
  entry?: { resource: FhirResource }[]
  link?: { relation: string; url: string }[]
}

const FHIR_RESOURCE_MAP: Record<string, string> = {
  Patient: 'patient',
  Encounter: 'incident',
  Observation: 'patient',
  Medication: 'patient',
  Condition: 'patient',
  CarePlan: 'patient',
  Practitioner: 'crew',
  Organization: 'hospital',
  Location: 'hospital',
}

export class FhirConnector extends BaseConnector {
  private baseUrl: string
  private connected = false
  private eventsProcessed = 0
  private eventsFailed = 0

  constructor(integrationId: string, companyId: string, type: EmsIntegrationType, config: ConnectorConfig) {
    super(integrationId, companyId, type, config)
    this.baseUrl = config.endpointUrl || ''
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/fhir+json',
      Accept: 'application/fhir+json',
    }
    if (this.config.authType === 'api_key' && this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey
    } else if (this.config.authType === 'basic' && this.config.basicAuth) {
      const encoded = Buffer.from(`${this.config.basicAuth.username}:${this.config.basicAuth.password}`).toString('base64')
      headers['Authorization'] = `Basic ${encoded}`
    }
    return headers
  }

  async connect(): Promise<boolean> {
    try {
      const result = await this.testConnection()
      this.connected = result.success
      await this.updateStatus(result.success ? 'CONNECTED' : 'ERROR', result.success ? undefined : result.message)
      return result.success
    } catch (err) {
      this.connected = false
      await this.updateStatus('ERROR', err instanceof Error ? err.message : 'FHIR connection failed')
      return false
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false
    await this.updateStatus('DISCONNECTED')
  }

  async testConnection(): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const start = Date.now()
    try {
      const url = `${this.baseUrl}/metadata`
      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(this.config.timeoutMs || 10000),
      })
      const latencyMs = Date.now() - start
      if (response.ok) {
        const capStatement = await response.json()
        const fhirVersion = capStatement.fhirVersion || 'unknown'
        return { success: true, latencyMs, message: `FHIR ${fhirVersion} server connected` }
      }
      return { success: false, latencyMs, message: `HTTP ${response.status}: ${response.statusText}` }
    } catch (err) {
      return { success: false, latencyMs: Date.now() - start, message: err instanceof Error ? err.message : 'Connection failed' }
    }
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const result = await this.testConnection()
    return {
      status: result.success ? 'CONNECTED' : 'ERROR',
      lastConnectedAt: this.connected ? new Date().toISOString() : null,
      lastErrorAt: result.success ? null : new Date().toISOString(),
      lastErrorMessage: result.success ? null : result.message,
      latencyMs: result.latencyMs,
      uptimePercentage: null,
      eventsProcessed: this.eventsProcessed,
      eventsFailed: this.eventsFailed,
    }
  }

  async searchResource(resourceType: string, params: Record<string, string> = {}): Promise<FhirResource[]> {
    const query = new URLSearchParams(params).toString()
    const url = `${this.baseUrl}/${resourceType}${query ? `?${query}` : ''}`
    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(),
      signal: AbortSignal.timeout(this.config.timeoutMs || 15000),
    })
    if (!response.ok) throw new Error(`FHIR ${resourceType} search failed: HTTP ${response.status}`)
    const bundle: FhirBundle = await response.json()
    return bundle.entry?.map(e => e.resource) || []
  }

  async readResource(resourceType: string, id: string): Promise<FhirResource> {
    const response = await fetch(`${this.baseUrl}/${resourceType}/${id}`, {
      method: 'GET',
      headers: this.buildHeaders(),
      signal: AbortSignal.timeout(this.config.timeoutMs || 10000),
    })
    if (!response.ok) throw new Error(`FHIR read ${resourceType}/${id} failed: HTTP ${response.status}`)
    return response.json()
  }

  protected async fetchData(entityType: string, params?: Record<string, unknown>): Promise<unknown[]> {
    const fhirResource = this.getFhirResource(entityType)
    const searchParams: Record<string, string> = {}
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        searchParams[key] = String(value)
      }
    }
    searchParams._count = '100'
    return this.searchResource(fhirResource, searchParams)
  }

  protected async transformData(entityType: string, data: unknown[]): Promise<Record<string, unknown>[]> {
    const { FieldMappingService } = await import('./FieldMappingService')
    const mappingService = new FieldMappingService(this.companyId, this.integrationId)
    const results: Record<string, unknown>[] = []
    for (const resource of data) {
      const flat = this.flattenFhirResource(resource as FhirResource)
      const mapped = await mappingService.applyMappings(entityType, flat)
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
        const result = await this.upsertByEntityType(entityType, record, prisma)
        if (result === 'created') created++
        else updated++
      } catch { failed++ }
    }
    this.eventsProcessed += data.length
    this.eventsFailed += failed
    return { recordsProcessed: data.length, recordsCreated: created, recordsUpdated: updated, recordsFailed: failed }
  }

  private getFhirResource(entityType: string): string {
    const reverse: Record<string, string> = {
      patient: 'Patient',
      incident: 'Encounter',
      crew: 'Practitioner',
      hospital: 'Organization',
      unit: 'Location',
    }
    return reverse[entityType] || 'Patient'
  }

  private flattenFhirResource(resource: FhirResource): Record<string, unknown> {
    const flat: Record<string, unknown> = {
      externalId: resource.id,
      resourceType: resource.resourceType,
    }
    if (resource.name) {
      if (Array.isArray(resource.name)) {
        const official = resource.name.find((n: any) => n.use === 'official') || resource.name[0]
        flat.name = [official.given?.join(' '), official.family].filter(Boolean).join(' ')
      }
    }
    if (resource.birthDate) flat.birthDate = resource.birthDate
    if (resource.gender) flat.gender = resource.gender
    if (resource.address && Array.isArray(resource.address)) {
      flat.address = resource.address.map((a: any) => [a.line?.join(', '), a.city, a.state, a.postalCode].filter(Boolean).join(', ')).join('; ')
    }
    if (resource.telecom && Array.isArray(resource.telecom)) {
      const phone = resource.telecom.find((t: any) => t.system === 'phone')
      const email = resource.telecom.find((t: any) => t.system === 'email')
      if (phone) flat.phone = phone.value
      if (email) flat.email = email.value
    }
    if (resource.identifier && Array.isArray(resource.identifier)) {
      flat.identifiers = resource.identifier.map((i: any) => ({ system: i.system, value: i.value }))
    }
    return flat
  }

  private async upsertByEntityType(entityType: string, data: Record<string, unknown>, prisma: any): Promise<'created' | 'updated'> {
    const externalId = data.externalId as string
    if (!externalId) return 'created'

    if (entityType === 'patient') {
      const existing = await prisma.emsPatient.findFirst({
        where: { companyId: this.companyId, patientNumber: externalId },
      })
      if (existing) {
        await prisma.emsPatient.update({ where: { id: existing.id }, data })
        return 'updated'
      }
      await prisma.emsPatient.create({ data: { ...data, companyId: this.companyId, patientNumber: externalId } })
      return 'created'
    }

    if (entityType === 'hospital') {
      const existing = await prisma.emsHospital.findFirst({
        where: { companyId: this.companyId, code: externalId },
      })
      if (existing) {
        await prisma.emsHospital.update({ where: { id: existing.id }, data })
        return 'updated'
      }
      await prisma.emsHospital.create({ data: { ...data, companyId: this.companyId, code: externalId } })
      return 'created'
    }

    return 'created'
  }
}
