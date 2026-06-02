// @ts-nocheck — depends on prisma generate for Ems* models
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/db'
import { SEVERITY_WEIGHTS } from '@/lib/ems-config'
import { DispatchEngine } from '../dispatch-engine'
import { emitEmsEvent } from '../ems-realtime'

export class EmsAiService {
  static async classifySeverity(incidentId: string): Promise<{
    severity: string
    confidence: number
    reasoning: string
  }> {
    const incident = await prisma.emsIncident.findUnique({
      where: { id: incidentId },
      select: {
        chiefComplaint: true,
        symptoms: true,
        mechanismOfInjury: true,
        patientCount: true,
        callerNotes: true,
      },
    })
    if (!incident) return { severity: 'ALPHA', confidence: 0, reasoning: 'No incident data' }

    const complaint = (incident.chiefComplaint || '').toLowerCase()
    const symptoms = (incident.symptoms || '').toLowerCase()
    const mechanism = (incident.mechanismOfInjury || '').toLowerCase()
    const notes = (incident.callerNotes || '').toLowerCase()
    const text = [complaint, symptoms, mechanism, notes].join(' ')

    const criticalKeywords = [
      'cardiac arrest', 'not breathing', 'unconscious', 'seizure', 'severe bleeding',
      'gunshot', 'stabbing', 'anaphylaxis', 'stroke', 'overdose', 'choking',
    ]
    const seriousKeywords = [
      'chest pain', 'difficulty breathing', 'severe pain', 'burn', 'fracture',
      'head injury', 'allergic reaction', 'diabetic', 'hypothermia',
    ]
    const moderateKeywords = [
      'abdominal pain', 'fever', 'vomiting', 'dehydration', 'laceration',
      'sprain', 'infection', 'migraine',
    ]

    let score = 0
    let matched: string[] = []

    for (const kw of criticalKeywords) {
      if (text.includes(kw)) { score += 15; matched.push(kw) }
    }
    for (const kw of seriousKeywords) {
      if (text.includes(kw)) { score += 8; matched.push(kw) }
    }
    for (const kw of moderateKeywords) {
      if (text.includes(kw)) { score += 3; matched.push(kw) }
    }

    const patientFactor = Math.min(incident.patientCount || 1, 10)
    score += patientFactor * 2

    const severityMap = [
      { max: 5, severity: 'ALPHA' },
      { max: 12, severity: 'BRAVO' },
      { max: 20, severity: 'CHARLIE' },
      { max: 35, severity: 'DELTA' },
      { max: 999, severity: 'ECHO' },
    ]
    const result = severityMap.find((s) => score <= s.max) || severityMap[severityMap.length - 1]
    const confidence = Math.min(1, score / 40 + 0.1)

    const DISCLAIMER = 'ADVISORY ONLY — This is a decision-support tool, not a clinical diagnosis. A qualified dispatcher or medical professional must verify and authorize all dispatch decisions.'
    const requiresHumanConfirmation = ['DELTA', 'ECHO', 'OMEGA'].includes(result.severity)

    await prisma.emsAiDecision.create({
      data: {
        incidentId,
        decisionType: 'severity_classification',
        input: { chiefComplaint: incident.chiefComplaint, symptoms: incident.symptoms, text },
        output: { severity: result.severity, score, matchedKeywords: matched, requiresHumanConfirmation },
        confidence,
        reasoning: `AI severity classification: ${result.severity} (score ${score}, matched ${matched.join(', ') || 'none'}) | ${DISCLAIMER}`,
      },
    })

    return {
      severity: result.severity,
      confidence,
      reasoning: `Score ${score}: ${matched.join(', ') || 'no critical keywords'}`,
      disclaimer: DISCLAIMER,
      requiresHumanConfirmation,
      advisoryOnly: true,
    }
  }

  static async recommendDispatch(
    companyId: string,
    incidentId: string,
    incidentLat: number,
    incidentLng: number,
    severity: string
  ) {
    const candidates = await DispatchEngine.findBestUnit(companyId, incidentLat, incidentLng, severity, { maxResults: 3 })
    const nearestHospital = await DispatchEngine.getNearestHospital(companyId, incidentLat, incidentLng)

    const recommendation = {
      incidentId,
      candidates,
      nearestHospital,
      autoDispatchPossible: candidates.length > 0 && candidates[0].score >= 0.6,
      timestamp: new Date().toISOString(),
    }

    await prisma.emsAiDecision.create({
      data: {
        incidentId,
        decisionType: 'unit_recommendation',
        input: { companyId, lat: incidentLat, lng: incidentLng, severity },
        output: recommendation,
        confidence: candidates[0]?.score || 0,
        reasoning: `Top candidate: ${candidates[0]?.unitNumber || 'none'} (score ${candidates[0]?.score || 0})`,
      },
    })

    const advisoryDisclaimer = 'ADVISORY ONLY — AI-generated recommendation. Dispatcher must review and confirm before dispatching. Not a substitute for professional judgment.'

    await emitEmsEvent(companyId, 'ems:ai:insight', {
      type: 'dispatch_recommendation',
      incidentId,
      advisoryOnly: true,
      disclaimer: advisoryDisclaimer,
      candidates: candidates.map((c) => ({ unitId: c.unitId, unitNumber: c.unitNumber, score: c.score, etaSeconds: c.etaSeconds })),
      nearestHospital: nearestHospital
        ? { name: nearestHospital.name, distanceKm: nearestHospital.distanceKm, etaSeconds: nearestHospital.etaSeconds }
        : null,
    })

    return { ...recommendation, disclaimer: advisoryDisclaimer, advisoryOnly: true }
  }

  static async generateIncidentSummary(incidentId: string): Promise<string> {
    const incident = await prisma.emsIncident.findUnique({
      where: { id: incidentId },
      include: {
        patients: true,
        timeline: { orderBy: { recordedAt: 'asc' } },
        communications: { take: 20, orderBy: { recordedAt: 'desc' } },
        assignedUnit: true,
        hospital: true,
      },
    })
    if (!incident) return 'No incident data'

    const lines: string[] = [
      `Incident #${incident.incidentNumber}`,
      `Severity: ${incident.severity} | Status: ${incident.status}`,
      `Chief Complaint: ${incident.chiefComplaint || 'N/A'}`,
      `Patients: ${incident.patientCount}`,
      `Location: ${incident.address || `${incident.lat}, ${incident.lng}`}`,
    ]
    if (incident.assignedUnit) lines.push(`Assigned Unit: ${incident.assignedUnit.unitNumber}`)
    if (incident.hospital) lines.push(`Hospital: ${incident.hospital.name}`)
    if (incident.patients.length > 0) {
      lines.push('Patients:')
      incident.patients.forEach((p) => lines.push(`  - ${p.name || 'Unknown'}: ${p.status} (${p.triage || 'N/A'})`))
    }
    if (incident.timeline.length > 0) {
      lines.push('Timeline:')
      incident.timeline.slice(-10).forEach((t) => lines.push(`  [${t.recordedAt.toISOString()}] ${t.title}`))
    }

    await prisma.emsIncident.update({
      where: { id: incidentId },
      data: { aiSummary: lines.join('\n') },
    })

    return lines.join('\n')
  }

  static async predictDemandZones(companyId: string): Promise<
    Array<{ zoneName: string; lat: number; lng: number; riskScore: number; reason: string }>
  > {
    const recentIncidents = await prisma.emsIncident.findMany({
      where: {
        companyId,
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
        lat: { not: null },
        lng: { not: null },
      },
      select: { lat: true, lng: true, severity: true, createdAt: true },
    })

    const currentHour = new Date().getHours()
    const dayOfWeek = new Date().getDay()

    const zones = new Map<string, { lat: number; lng: number; count: number; score: number; reasons: Set<string> }>()

    for (const inc of recentIncidents) {
      const key = `${Math.round((inc.lat! + 0.025) / 0.05) * 0.05},${Math.round((inc.lng! + 0.025) / 0.05) * 0.05}`
      const existing = zones.get(key) || { lat: 0, lng: 0, count: 0, score: 0, reasons: new Set<string>() }
      existing.count++
      existing.score += SEVERITY_WEIGHTS[inc.severity] || 1
      existing.lat = inc.lat!
      existing.lng = inc.lng!
      if (inc.createdAt.getHours() >= currentHour - 2 && inc.createdAt.getHours() <= currentHour + 2) {
        existing.reasons.add('Recent activity in similar time window')
      }
      zones.set(key, existing)
    }

    return Array.from(zones.entries())
      .map(([key, z]) => ({
        zoneName: `Zone ${key}`,
        lat: Math.round(z.lat * 100) / 100,
        lng: Math.round(z.lng * 100) / 100,
        riskScore: Math.min(1, z.score / 50),
        reason: z.reasons.size > 0
          ? Array.from(z.reasons).join('; ')
          : `${z.count} incidents in this area this week`,
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10)
  }
}
