export type SimUnitType = 'ALS' | 'BLS' | 'MICU' | 'SUP' | 'FLY'
export type SimUnitStatus = 'READY' | 'DISPATCHED' | 'EN_ROUTE' | 'ON_SCENE' | 'TRANSPORTING' | 'OFFLINE' | 'MAINTENANCE'

export type SimUnit = {
  id: string
  unitNumber: string
  type: SimUnitType
  status: SimUnitStatus
  lat: number
  lng: number
  heading: number
  speed: number
  fuelLevel: number
  crewCount: number
  alsCapable: boolean
  score: number
  etaSeconds: number
  distanceKm: number
  factors: Array<{ name: string; weight: number; value: number; description: string }>
}

export type AiRecommendation = {
  unitId: string
  unitNumber: string
  type: SimUnitType
  score: number
  confidence: number
  reasoning: string[]
  survivalOptimization: 'HIGH' | 'MEDIUM' | 'LOW'
  etaSeconds: number
  distanceKm: number
}

const UNIT_TYPES: SimUnitType[] = ['ALS', 'BLS', 'MICU', 'SUP']
const STREET_NAMES = ['Main St', 'Oak Ave', 'Elm St', 'Broadway', 'Park Blvd', 'Lake Dr', 'River Rd', 'Hill St', 'Cedar Ln', 'Pine Ave', 'Maple Dr', 'Washington Blvd', 'Lincoln Way', 'Jefferson Ave', 'Madison St', 'Monroe Dr', 'Adams Blvd', 'Jackson Ave', 'Franklin St', 'Hamilton Way']

function getStreetName(index: number): string {
  return STREET_NAMES[index % STREET_NAMES.length]
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180)
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function generateUnitNumber(index: number): string {
  const prefixes = ['EMS', 'MICU', 'SUP', 'ALS']
  const prefix = prefixes[index % prefixes.length]
  const nums = [100, 200, 300, 400, 500, 600, 700, 800, 900]
  const num = nums[Math.floor(index / prefixes.length) % nums.length] + (index % 100)
  return `${prefix}-${num}`
}

export function generateSimulatedUnits(
  incidentLat: number,
  incidentLng: number,
  severity: string,
  count: number = 8
): SimUnit[] {
  const sevLevel = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'OMEGA'].indexOf(severity)
  const urgency = Math.max(0, sevLevel) / 5
  const units: SimUnit[] = []

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
    const radius = 0.5 + Math.random() * 4
    const lat = incidentLat + (Math.cos(angle) * radius) / 111
    const lng = incidentLng + (Math.sin(angle) * radius) / (111 * Math.cos((incidentLat * Math.PI) / 180))
    const distKm = haversineKm(incidentLat, incidentLng, lat, lng)
    const bearing = bearingDeg(lat, lng, incidentLat, incidentLng)
    const baseSpeed = 40 + Math.random() * 60
    const trafficFactor = 0.6 + Math.random() * 0.4
    const speed = baseSpeed * trafficFactor
    const etaHours = distKm / speed
    const etaSeconds = etaHours * 3600
    const type = UNIT_TYPES[i % UNIT_TYPES.length]
    const alsCapable = type === 'ALS' || type === 'MICU'
    const crewCount = type === 'MICU' ? 3 : type === 'BLS' ? 2 : type === 'SUP' ? 1 : 2
    const fuelLevel = 30 + Math.random() * 70
    const online = Math.random() > 0.1
    const status: SimUnitStatus = online ? (i < count * 0.6 ? 'READY' : i < count * 0.8 ? 'EN_ROUTE' : 'TRANSPORTING') : 'OFFLINE'

    const proximityScore = Math.max(0, 1 - distKm / 10)
    const capabilityScore = alsCapable ? 1 : 0.5
    const readinessScore = status === 'READY' ? 1 : status === 'EN_ROUTE' ? 0.6 : 0.2
    const fuelScore = fuelLevel / 100
    const crewScore = Math.min(1, crewCount / 3)
    const urgencyBonus = alsCapable ? urgency * 0.15 : 0

    const score = Math.min(1, proximityScore * 0.35 + capabilityScore * 0.2 + readinessScore * 0.15 + fuelScore * 0.1 + crewScore * 0.1 + urgencyBonus)

    units.push({
      id: `unit_${i}_${Date.now()}`,
      unitNumber: generateUnitNumber(i),
      type,
      status,
      lat,
      lng,
      heading: bearing,
      speed: Math.round(speed),
      fuelLevel: Math.round(fuelLevel),
      crewCount,
      alsCapable,
      score: Math.round(score * 1000) / 1000,
      etaSeconds: Math.round(etaSeconds),
      distanceKm: Math.round(distKm * 10) / 10,
      factors: [
        { name: 'Proximity', weight: 0.35, value: proximityScore, description: `${distKm.toFixed(1)} km from incident` },
        { name: 'Unit Capability', weight: 0.2, value: capabilityScore, description: alsCapable ? 'ALS-capable unit' : 'BLS unit' },
        { name: 'Crew Readiness', weight: 0.15, value: readinessScore, description: status === 'READY' ? 'Crew available' : `Crew ${status.toLowerCase()}` },
        { name: 'Fuel Level', weight: 0.1, value: fuelScore, description: `${Math.round(fuelLevel)}% fuel remaining` },
        { name: 'Crew Capacity', weight: 0.1, value: crewScore, description: `${crewCount} crew members` },
        { name: 'Severity Match', weight: 0.1, value: urgencyBonus * 5, description: alsCapable ? 'ALS matched to severity' : 'BLS available' },
      ],
    })
  }

  return units.sort((a, b) => b.score - a.score)
}

export function getAiRecommendation(
  units: SimUnit[],
  incidentSeverity: string
): AiRecommendation | null {
  if (units.length === 0) return null
  const best = units[0]
  if (best.score < 0.2) return null

  const reasoning: string[] = []
  if (best.alsCapable) reasoning.push('Closest ALS-capable ambulance')
  else reasoning.push('Closest available BLS unit')
  if (best.status === 'READY') reasoning.push('Available crew — immediate dispatch')
  if (best.distanceKm < 2) reasoning.push('Under 2 km from incident scene')
  if (best.fuelLevel > 50) reasoning.push('Adequate fuel for response + transport')
  reasoning.push(`Estimated arrival in ${Math.round(best.etaSeconds / 60)} minutes`)
  reasoning.push(`Score: ${(best.score * 100).toFixed(0)} / 100 across 6 factors`)
  reasoning.push(best.type === 'ALS' || best.type === 'MICU' ? 'ALS capability matches DELTA/ECHO/OMEGA severity' : 'BLS unit sufficient for ALPHA/BRAVE/CHARLIE severity')

  const survivalOpt = best.score > 0.75 && best.alsCapable ? 'HIGH' : best.score > 0.5 ? 'MEDIUM' : 'LOW'
  const confidence = Math.round(Math.min(99, 60 + best.score * 40))

  return {
    unitId: best.id,
    unitNumber: best.unitNumber,
    type: best.type,
    score: best.score,
    confidence,
    reasoning,
    survivalOptimization: survivalOpt as 'HIGH' | 'MEDIUM' | 'LOW',
    etaSeconds: best.etaSeconds,
    distanceKm: best.distanceKm,
  }
}

export function simulateMovement(units: SimUnit[], incidentLat: number, incidentLng: number, elapsedSeconds: number): SimUnit[] {
  return units.map((unit) => {
    if (unit.status !== 'DISPATCHED' && unit.status !== 'EN_ROUTE') return unit
    const distToIncident = haversineKm(unit.lat, unit.lng, incidentLat, incidentLng)
    const speedKmh = unit.speed
    const speedKms = speedKmh / 3600
    const maxMoveKm = speedKms * elapsedSeconds
    const bearing = bearingDeg(unit.lat, unit.lng, incidentLat, incidentLng)
    const moveRatio = Math.min(1, maxMoveKm / Math.max(0.001, distToIncident))
    const newLat = unit.lat + (incidentLat - unit.lat) * moveRatio
    const newLng = unit.lng + (incidentLng - unit.lng) * moveRatio
    const newDist = haversineKm(newLat, newLng, incidentLat, incidentLng)
    const newEta = (newDist / Math.max(1, speedKms))
    const trafficDelay = 1 + Math.random() * 0.5
    return {
      ...unit,
      lat: newLat,
      lng: newLng,
      heading: bearing,
      distanceKm: Math.round(newDist * 10) / 10,
      etaSeconds: Math.round(newEta * trafficDelay),
      status: newDist < 0.05 ? 'ON_SCENE' : unit.status === 'DISPATCHED' && newDist < distToIncident ? 'EN_ROUTE' : unit.status,
    }
  })
}

export const SEVERITY_COLORS: Record<string, string> = {
  ALPHA: '#3b82f6',
  BRAVO: '#22c55e',
  CHARLIE: '#eab308',
  DELTA: '#f97316',
  ECHO: '#ef4444',
  OMEGA: '#dc2626',
}

export const SEVERITY_LABELS: Record<string, string> = {
  ALPHA: 'Alpha — Low Priority',
  BRAVO: 'Bravo — Moderate',
  CHARLIE: 'Charlie — Urgent',
  DELTA: 'Delta — High Risk',
  ECHO: 'Echo — Critical',
  OMEGA: 'OMEGA — Mass Casualty',
}

export const STATUS_COLORS: Record<string, string> = {
  READY: '#22c55e',
  DISPATCHED: '#3b82f6',
  EN_ROUTE: '#f97316',
  ON_SCENE: '#ef4444',
  TRANSPORTING: '#eab308',
  OFFLINE: '#6b7280',
  MAINTENANCE: '#374151',
}
