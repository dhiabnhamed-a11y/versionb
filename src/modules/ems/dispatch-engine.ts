// @ts-nocheck — depends on prisma generate for Ems* models
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/db'
import { SEVERITY_WEIGHTS, RESPONSE_TIME_TARGETS } from '@/lib/ems-config'
import { emitEmsEvent } from './ems-realtime'

export type DispatchScore = {
  unitId: string
  unitNumber: string
  score: number
  etaSeconds: number
  distanceKm: number
  factors: DispatchFactor[]
}

export type DispatchFactor = {
  name: string
  weight: number
  value: number
  description: string
}

export class DispatchEngine {
  static async findBestUnit(
    companyId: string,
    incidentLat: number,
    incidentLng: number,
    severity: string,
    options?: {
      requiredCapabilities?: string[]
      excludeUnitIds?: string[]
      preferType?: string
      maxResults?: number
    }
  ): Promise<DispatchScore[]> {
    const availableUnits = await prisma.emsUnit.findMany({
      where: {
        companyId,
        status: 'AVAILABLE',
        isOnline: true,
        lat: { not: null },
        lng: { not: null },
        ...(options?.excludeUnitIds?.length ? { id: { notIn: options.excludeUnitIds } } : {}),
      },
      include: {
        station: true,
        crewMembers: { include: { crew: true } },
        _count: { select: { supplies: true } },
      },
    })

    if (availableUnits.length === 0) return []

    const scored = await Promise.all(
      availableUnits.map(async (unit) => {
        const factors: DispatchFactor[] = []
        let totalScore = 0

        const distanceKm = this.haversineDistance(
          incidentLat, incidentLng,
          unit.lat!, unit.lng!
        )
        const etaSeconds = this.estimateEta(distanceKm)
        factors.push({
          name: 'Proximity',
          weight: 0.35,
          value: Math.max(0, 1 - distanceKm / 50),
          description: `${distanceKm.toFixed(1)} km away, ~${Math.round(etaSeconds / 60)} min ETA`,
        })
        totalScore += 0.35 * Math.max(0, 1 - distanceKm / 50)

        const unitSeverityWeight = SEVERITY_WEIGHTS[severity] || 1
        const typeAlignment = this.getUnitTypeScore(unit.type, severity)
        factors.push({
          name: 'Unit Type Match',
          weight: 0.2,
          value: typeAlignment,
          description: `${unit.type} ${typeAlignment >= 0.8 ? 'ideal' : 'acceptable'} for ${severity}`,
        })
        totalScore += 0.2 * typeAlignment

        const crewReady = unit.crewMembers.filter((m) => m.status === 'available').length
        const crewScore = Math.min(1, crewReady / Math.max(1, unit.crewCapacity))
        factors.push({
          name: 'Crew Readiness',
          weight: 0.15,
          value: crewScore,
          description: `${crewReady}/${unit.crewCapacity} crew available`,
        })
        totalScore += 0.15 * crewScore

        const fatigueAvg = unit.crewMembers.reduce((sum, m) => sum + (m.fatigue || 0), 0) / Math.max(1, unit.crewMembers.length)
        const fatigueScore = Math.max(0, 1 - (fatigueAvg || 0) / 100)
        factors.push({
          name: 'Crew Fatigue',
          weight: 0.1,
          value: fatigueScore,
          description: fatigueAvg > 0 ? `Avg fatigue ${Math.round(fatigueAvg)}%` : 'Unknown',
        })
        totalScore += 0.1 * fatigueScore

        if (options?.requiredCapabilities?.length) {
          const unitCaps: string[] = (unit.capabilities as any) || []
          const hasAllCaps = options.requiredCapabilities.every((c) => unitCaps.includes(c))
          factors.push({
            name: 'Required Capabilities',
            weight: 0.1,
            value: hasAllCaps ? 1 : 0,
            description: hasAllCaps ? 'All required capabilities present' : 'Missing capabilities',
          })
          totalScore += 0.1 * (hasAllCaps ? 1 : 0)
        }

        if (options?.preferType && unit.type === options.preferType) {
          factors.push({
            name: 'Preferred Type',
            weight: 0.05,
            value: 1,
            description: `Matches preferred type ${options.preferType}`,
          })
          totalScore += 0.05
        }

        const msSincePing = unit.lastPing ? Date.now() - unit.lastPing.getTime() : null
        // Higher score = pinged more recently (max 5-min window)
        const availabilityScore = msSincePing !== null
          ? Math.max(0, 1 - msSincePing / 300_000)
          : 0.5
        factors.push({
          name: 'Last Contact',
          weight: 0.05,
          value: availabilityScore,
          description: msSincePing !== null
            ? `${Math.round(msSincePing / 60000)}m since last ping`
            : 'No ping data',
        })
        totalScore += 0.05 * availabilityScore

        return {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          score: Math.round(totalScore * 1000) / 1000,
          etaSeconds: Math.round(etaSeconds),
          distanceKm: Math.round(distanceKm * 10) / 10,
          factors,
        } satisfies DispatchScore
      })
    )

    const sorted = scored.sort((a, b) => b.score - a.score)
    return options?.maxResults ? sorted.slice(0, options.maxResults) : sorted
  }

  static async autoDispatch(
    companyId: string,
    incidentId: string,
    severity: string
  ): Promise<{ success: boolean; assigned?: DispatchScore; reasoning: string }> {
    const incident = await prisma.emsIncident.findUnique({
      where: { id: incidentId },
      select: { lat: true, lng: true, severity: true, incidentNumber: true },
    })
    if (!incident?.lat || !incident?.lng) {
      return { success: false, reasoning: 'Incident has no location data for dispatch' }
    }

    const candidates = await this.findBestUnit(companyId, incident.lat, incident.lng, severity, { maxResults: 1 })
    if (candidates.length === 0) {
      return { success: false, reasoning: 'No available units found for dispatch' }
    }

    const best = candidates[0]
    const severityWeight = SEVERITY_WEIGHTS[severity] || 1
    const autoDispatchThreshold = severityWeight >= 4 ? 0.5 : 0.7

    if (best.score < autoDispatchThreshold) {
      return {
        success: false,
        assigned: best,
        reasoning: `Best unit ${best.unitNumber} score ${best.score} below auto-dispatch threshold ${autoDispatchThreshold}`,
      }
    }

    await emitEmsEvent(companyId, 'ems:ai:insight', {
      type: 'auto_dispatch',
      incidentId,
      recommendedUnitId: best.unitId,
      score: best.score,
      etaSeconds: best.etaSeconds,
      factors: best.factors,
      message: `AI auto-dispatch: ${best.unitNumber} (score: ${best.score})`,
    })

    return {
      success: true,
      assigned: best,
      reasoning: `Auto-dispatched ${best.unitNumber} — score ${best.score}, ETA ${Math.round(best.etaSeconds / 60)} min`,
    }
  }

  static async calculateEta(companyId: string, fromLat: number, fromLng: number, toLat: number, toLng: number) {
    const distance = this.haversineDistance(fromLat, fromLng, toLat, toLng)
    return {
      distanceKm: Math.round(distance * 10) / 10,
      etaSeconds: Math.round(this.estimateEta(distance)),
      etaMinutes: Math.round(this.estimateEta(distance) / 60 * 10) / 10,
    }
  }

  static async getNearestHospital(companyId: string, lat: number, lng: number) {
    const hospitals = await prisma.emsHospital.findMany({
      where: { companyId, status: { notIn: ['FULL', 'CLOSED'] } },
    })

    if (hospitals.length === 0) return null

    const scored = hospitals.map((h) => {
      const distance = this.haversineDistance(lat, lng, h.lat, h.lng)
      const bedScore = h.availableBeds / Math.max(1, h.bedCount)
      const overallScore = 0.6 * (1 - distance / 100) + 0.4 * bedScore
      const eta = this.estimateEta(distance)
      return { ...h, distanceKm: Math.round(distance * 10) / 10, etaSeconds: Math.round(eta), score: overallScore }
    })

    scored.sort((a, b) => b.score - a.score)
    const best = scored[0]
    return {
      ...best,
      recommendationScore: Math.round(best.score * 100) / 100,
    }
  }

  static haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371
    const dLat = this.toRad(lat2 - lat1)
    const dLng = this.toRad(lng2 - lng1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private static toRad(deg: number): number {
    return (deg * Math.PI) / 180
  }

  private static estimateEta(distanceKm: number): number {
    const hour = new Date().getHours()
    // Approximate urban traffic multiplier: slower during peak hours
    const peakMorning = hour >= 7 && hour <= 9
    const peakEvening = hour >= 16 && hour <= 18
    const trafficMultiplier = (peakMorning || peakEvening) ? 1.35 : 1.0
    const avgSpeedKmh = 60 / trafficMultiplier
    const baseSeconds = (distanceKm / avgSpeedKmh) * 3600
    const responseDelay = 90
    return baseSeconds + responseDelay
  }

  private static getUnitTypeScore(type: string, severity: string): number {
    const severityWeight = SEVERITY_WEIGHTS[severity] || 1
    if (severityWeight >= 4) {
      if (['ALS_AMBULANCE', 'MICU', 'AIR_AMBULANCE'].includes(type)) return 1.0
      if (['AMBULANCE'].includes(type)) return 0.6
      return 0.3
    }
    if (severityWeight >= 3) {
      if (['ALS_AMBULANCE', 'AMBULANCE'].includes(type)) return 1.0
      if (['BLS_AMBULANCE', 'RESPONSE_VEHICLE'].includes(type)) return 0.7
      return 0.4
    }
    if (['BLS_AMBULANCE', 'AMBULANCE', 'RESPONSE_VEHICLE', 'MOTORCYCLE_RESPONSE'].includes(type)) return 1.0
    return 0.5
  }
}
