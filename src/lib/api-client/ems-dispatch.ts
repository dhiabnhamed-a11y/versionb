const API_BASE = '/api/ems/dispatch'

export interface DispatchFactor {
  name: string
  weight: number
  value: number
  description: string
}

export interface DispatchCandidate {
  unitId: string
  unitNumber: string
  score: number
  etaSeconds: number
  distanceKm: number
  factors: DispatchFactor[]
}

export interface FleetUnit {
  id: string
  unitNumber: string
  type: string
  status: string
  lat: number
  lng: number
  fuelLevel: number | null
  crewCapacity: number
  isOnline: boolean
  speed: number | null
  heading: number | null
  batteryLevel: number | null
}

export interface FindUnitsResponse {
  candidates: DispatchCandidate[]
  units: FleetUnit[]
}

export interface AiRecommendationResult {
  incidentId: string
  candidates: DispatchCandidate[]
  nearestHospital: {
    id: string
    name: string
    distanceKm: number
    etaSeconds: number
    recommendationScore: number
    availableBeds: number
  } | null
  autoDispatchPossible: boolean
  timestamp: string
}

export interface AutoDispatchResult {
  success: boolean
  assigned?: DispatchCandidate
  reasoning: string
  incident?: any
}

export interface IncidentLifecycleResult {
  success: boolean
  incident: any
  previousStatus: string
  newStatus: string
}

export interface DispatchLogEntry {
  id: string
  incidentId: string
  action: string
  dispatchedUnitIds: string[]
  decisionType: string
  aiConfidence: number | null
  aiReasoning: string | null
  dispatcherId: string | null
  responseTime: number | null
  createdAt: string
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message || body?.error || `Request failed: ${response.status}`)
  }
  const json = await response.json()
  return (json?.data ?? json) as T
}

export async function findUnits(
  lat: number,
  lng: number,
  severity: string,
  options?: { maxResults?: number; requiredCapabilities?: string[] }
): Promise<FindUnitsResponse> {
  return handleResponse(
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        action: 'find_units',
        lat,
        lng,
        severity,
        maxResults: options?.maxResults ?? 10,
        requiredCapabilities: options?.requiredCapabilities,
      }),
    })
  )
}

export async function getAiRecommendation(
  companyId: string,
  incidentId: string,
  lat: number,
  lng: number,
  severity: string
): Promise<AiRecommendationResult> {
  return handleResponse(
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        action: 'recommend',
        companyId,
        incidentId,
        lat,
        lng,
        severity,
      }),
    })
  )
}

export async function autoDispatch(
  incidentId: string,
  severity: string
): Promise<AutoDispatchResult> {
  return handleResponse(
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        action: 'auto_dispatch',
        incidentId,
        severity,
      }),
    })
  )
}

export async function classifySeverity(incidentId: string): Promise<{
  severity: string
  confidence: number
  reasoning: string
}> {
  return handleResponse(
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'classify', incidentId }),
    })
  )
}

export async function assignUnit(
  incidentId: string,
  unitId: string,
  decisionType: string
): Promise<any> {
  return handleResponse(
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'assign_unit', incidentId, unitId, decisionType }),
    })
  )
}

export async function getNearestHospital(lat: number, lng: number): Promise<any> {
  return handleResponse(
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'nearest_hospital', lat, lng }),
    })
  )
}

export async function updateIncidentLifecycle(
  incidentId: string,
  newStatus: string,
  metadata?: Record<string, any>
): Promise<IncidentLifecycleResult> {
  return handleResponse(
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'incident_lifecycle', incidentId, newStatus, metadata }),
    })
  )
}

export async function sendDispatchNotification(
  incidentId: string,
  unitIds: string[],
  channel?: string
): Promise<any> {
  return handleResponse(
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'send_notification', incidentId, unitIds, channel }),
    })
  )
}

export async function getDispatchLogs(
  incidentId?: string,
  limit?: number
): Promise<DispatchLogEntry[]> {
  const params = new URLSearchParams()
  if (incidentId) params.set('incidentId', incidentId)
  if (limit) params.set('limit', String(limit))
  return handleResponse(
    await fetch(`${API_BASE}?${params.toString()}`, { credentials: 'same-origin' })
  )
}
