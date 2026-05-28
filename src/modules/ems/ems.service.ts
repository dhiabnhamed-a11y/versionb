/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/db'
import { badRequest, notFound, conflict } from '@/modules/shared/errors'
import { SEVERITY_WEIGHTS } from '@/lib/ems-config'
import { emitEmsEvent } from './ems-realtime'
import { ensureEmsWorkspaceInitialized } from './ems-provisioning'

export class EmsService {
  static async getOrCreateEmsCompany(companyId: string) {
    await ensureEmsWorkspaceInitialized(prisma, companyId)
    return prisma.emsCompany.findUniqueOrThrow({ where: { companyId } })
  }

  static async createIncident(
    companyId: string,
    input: {
      callSource?: string
      severity?: string
      lat?: number
      lng?: number
      address?: string
      locationDetails?: string
      callerName?: string
      callerPhone?: string
      callerNotes?: string
      chiefComplaint?: string
      symptoms?: string
      mechanismOfInjury?: string
      patientCount?: number
      createdById?: string
    }
  ) {
    await this.getOrCreateEmsCompany(companyId)
    const count = await prisma.emsIncident.count({ where: { companyId } })
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const incidentNumber = `INC-${datePart}-${String(count + 1).padStart(4, '0')}`

    const incident = await prisma.emsIncident.create({
      data: {
        companyId,
        incidentNumber,
        callSource: (input.callSource as any) || 'PHONE',
        severity: (input.severity as any) || 'ALPHA',
        status: 'PENDING',
        lat: input.lat,
        lng: input.lng,
        address: input.address,
        locationDetails: input.locationDetails,
        callerName: input.callerName,
        callerPhone: input.callerPhone,
        callerNotes: input.callerNotes,
        chiefComplaint: input.chiefComplaint,
        symptoms: input.symptoms,
        mechanismOfInjury: input.mechanismOfInjury,
        patientCount: input.patientCount || 1,
        createdById: input.createdById,
        calledAt: new Date(),
      },
      include: { assignedUnit: true, hospital: true },
    })

    await prisma.emsIncidentTimeline.create({
      data: {
        incidentId: incident.id,
        eventType: 'incident_created',
        title: 'Incident created',
        description: `Call from ${input.callerName || 'unknown'}`,
        actorId: input.createdById,
      },
    })

    await emitEmsEvent(companyId, 'ems:incident:created', incident)

    const severityWeight = SEVERITY_WEIGHTS[input.severity || 'ALPHA'] || 1
    if (severityWeight >= 4) {
      await emitEmsEvent(companyId, 'ems:system:alert', {
        type: 'HIGH_SEVERITY_INCIDENT',
        incidentId: incident.id,
        severity: input.severity,
        message: `High-severity incident ${incidentNumber} created`,
      })
    }

    return incident
  }

  static async getIncident(companyId: string, id: string) {
    await this.getOrCreateEmsCompany(companyId)
    const incident = await prisma.emsIncident.findFirst({
      where: { id, companyId },
      include: {
        assignedUnit: { include: { crewMembers: { include: { crew: true } } } },
        hospital: true,
        patients: true,
        timeline: { orderBy: { recordedAt: 'asc' } },
        communications: { orderBy: { recordedAt: 'desc' }, take: 50 },
        media: true,
        notes: { where: { isPrivate: false }, orderBy: { createdAt: 'desc' } },
        assignments: { include: { unit: true } },
        aiDecisions: { orderBy: { createdAt: 'desc' }, take: 10 },
        dispatchLog: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!incident) throw notFound('Incident not found')
    return incident
  }

  static async listActiveIncidents(companyId: string) {
    await this.getOrCreateEmsCompany(companyId)
    return prisma.emsIncident.findMany({
      where: {
        companyId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      include: {
        assignedUnit: { include: { crewMembers: { include: { crew: true } } } },
        hospital: true,
        patients: true,
        _count: { select: { communications: true, media: true } },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    })
  }

  static async updateIncidentStatus(companyId: string, id: string, status: string, metadata?: Record<string, any>) {
    const incident = await prisma.emsIncident.findFirst({ where: { id, companyId } })
    if (!incident) throw notFound('Incident not found')

    const statusFieldMap: Record<string, string> = {
      DISPATCHED: 'dispatchedAt',
      EN_ROUTE: 'enRouteAt',
      ON_SCENE: 'onSceneAt',
      TRANSPORTING: 'transportingAt',
      AT_HOSPITAL: 'atHospitalAt',
      COMPLETED: 'completedAt',
      CANCELLED: 'cancelledAt',
    }

    const timestampField = statusFieldMap[status]
    const updateData: any = { status }
    if (timestampField) updateData[timestampField] = new Date()
    if (metadata?.cancellationReason) updateData.cancellationReason = metadata.cancellationReason

    if (status === 'COMPLETED' || status === 'CANCELLED') {
      await prisma.emsUnit.updateMany({
        where: { currentIncidentId: id },
        data: { currentIncidentId: null, status: 'AVAILABLE' },
      })
    }

    const updated = await prisma.emsIncident.update({
      where: { id },
      data: updateData,
      include: { assignedUnit: true, hospital: true },
    })

    if (metadata?.reason) {
      await prisma.emsIncidentTimeline.create({
        data: {
          incidentId: id,
          eventType: `status_${status.toLowerCase()}`,
          title: `Status changed to ${status}`,
          description: metadata.reason,
          actorId: metadata.actorId,
          metadata: { previousStatus: incident.status, newStatus: status },
        },
      })
    }

    await emitEmsEvent(companyId, 'ems:incident:status_changed', {
      incidentId: id,
      previousStatus: incident.status,
      newStatus: status,
      incident: updated,
    })

    return updated
  }

  static async assignUnit(companyId: string, incidentId: string, unitId: string, decision?: string, dispatcherId?: string) {
    const incident = await prisma.emsIncident.findFirst({ where: { id: incidentId, companyId } })
    if (!incident) throw notFound('Incident not found')

    const unit = await prisma.emsUnit.findFirst({ where: { id: unitId, companyId } })
    if (!unit) throw notFound('Unit not found')
    if (unit.status !== 'AVAILABLE') throw conflict('Unit is not available')

    await prisma.$transaction([
      prisma.emsIncident.update({
        where: { id: incidentId },
        data: {
          assignedUnitId: unitId,
          status: 'DISPATCHED',
          dispatchDecision: (decision as any) || 'DISPATCHER_MANUAL',
          dispatchedAt: new Date(),
        },
      }),
      prisma.emsUnit.update({
        where: { id: unitId },
        data: {
          status: 'DISPATCHED',
          currentIncidentId: incidentId,
        },
      }),
      prisma.emsAssignment.create({
        data: {
          incidentId,
          unitId,
          status: 'ACTIVE',
          assignedAt: new Date(),
        },
      }),
      prisma.emsDispatchLog.create({
        data: {
          incidentId,
          action: 'dispatched',
          dispatchedUnitIds: [unitId],
          decisionType: (decision as any) || 'DISPATCHER_MANUAL',
          dispatcherId,
          responseTime: Math.round((Date.now() - new Date(incident.calledAt || incident.createdAt).getTime()) / 1000),
        },
      }),
      prisma.emsIncidentTimeline.create({
        data: {
          incidentId,
          eventType: 'unit_dispatched',
          title: `Unit ${unit.unitNumber} dispatched`,
          actorId: dispatcherId,
        },
      }),
    ])

    const updated = await this.getIncident(companyId, incidentId)

    await emitEmsEvent(companyId, 'ems:unit:assigned', {
      incidentId,
      unitId,
      unitNumber: unit.unitNumber,
      incidentNumber: incident.incidentNumber,
    })

    return updated
  }

  static async updateUnitPosition(
    companyId: string,
    unitId: string,
    lat: number,
    lng: number,
    extras?: { heading?: number; speed?: number; accuracy?: number; batteryLevel?: number }
  ) {
    const unit = await prisma.emsUnit.findFirst({ where: { id: unitId, companyId } })
    if (!unit) throw notFound('Unit not found')

    const [updated] = await prisma.$transaction([
      prisma.emsUnit.update({
        where: { id: unitId },
        data: {
          lat,
          lng,
          heading: extras?.heading,
          speed: extras?.speed,
          batteryLevel: extras?.batteryLevel,
          lastGpsUpdate: new Date(),
          lastPing: new Date(),
          isOnline: true,
        },
      }),
      prisma.emsUnitLocation.create({
        data: {
          unitId,
          lat,
          lng,
          heading: extras?.heading,
          speed: extras?.speed,
          accuracy: extras?.accuracy,
          source: 'gps',
          recordedAt: new Date(),
        },
      }),
    ])

    await emitEmsEvent(companyId, 'ems:unit:position', {
      unitId,
      unitNumber: unit.unitNumber,
      lat,
      lng,
      heading: extras?.heading,
      speed: extras?.speed,
    })

    return updated
  }

  static async getFleetOverview(companyId: string) {
    await this.getOrCreateEmsCompany(companyId)
    const units = await prisma.emsUnit.findMany({
      where: { companyId },
      include: {
        station: true,
        crewMembers: { include: { crew: true } },
        _count: { select: { supplies: true } },
      },
      orderBy: { unitNumber: 'asc' },
    })

    const available = units.filter((u) => u.status === 'AVAILABLE')
    const dispatched = units.filter((u) => u.status === 'DISPATCHED' || u.status === 'EN_ROUTE')
    const onScene = units.filter((u) => u.status === 'ON_SCENE')
    const transporting = units.filter((u) => u.status === 'TRANSPORTING')
    const offline = units.filter((u) => !u.isOnline || u.status === 'OFFLINE')

    return {
      units,
      summary: {
        total: units.length,
        available: available.length,
        dispatched: dispatched.length,
        onScene: onScene.length,
        transporting: transporting.length,
        offline: offline.length,
        inService: units.length - offline.length,
      },
    }
  }

  static async getIncidentTimeline(companyId: string, incidentId: string) {
    const incident = await prisma.emsIncident.findFirst({ where: { id: incidentId, companyId } })
    if (!incident) throw notFound('Incident not found')
    return prisma.emsIncidentTimeline.findMany({
      where: { incidentId },
      orderBy: { recordedAt: 'asc' },
    })
  }

  static async addPatientVitals(companyId: string, patientId: string, vitals: Record<string, any>) {
    const patient = await prisma.emsPatient.findFirst({
      where: { id: patientId, incident: { companyId } },
    })
    if (!patient) throw notFound('Patient not found')

    const existingVitals = (patient.vitals as any[]) || []
    existingVitals.push({ ...vitals, recordedAt: new Date().toISOString() })

    return prisma.emsPatient.update({
      where: { id: patientId },
      data: { vitals: existingVitals },
    })
  }

  static async addCommunication(
    companyId: string,
    incidentId: string,
    input: {
      channel?: string
      fromUserId?: string
      toUserId?: string
      messageType?: string
      content?: string
      duration?: number
      transcript?: string
    }
  ) {
    const incident = await prisma.emsIncident.findFirst({ where: { id: incidentId, companyId } })
    if (!incident) throw notFound('Incident not found')

    const comm = await prisma.emsCommunication.create({
      data: {
        incidentId,
        channel: input.channel || 'radio',
        fromUserId: input.fromUserId,
        toUserId: input.toUserId,
        messageType: input.messageType || 'text',
        content: input.content,
        duration: input.duration,
        transcript: input.transcript,
        recordedAt: new Date(),
      },
    })

    await emitEmsEvent(companyId, 'ems:incident:updated', {
      incidentId,
      type: 'new_communication',
      communication: comm,
    })

    return comm
  }

  static async getHospitalsWithCapacity(companyId: string) {
    await this.getOrCreateEmsCompany(companyId)
    return prisma.emsHospital.findMany({
      where: { companyId },
      orderBy: [{ status: 'asc' }, { availableBeds: 'desc' }],
    })
  }

  static async updateHospitalStatus(
    companyId: string,
    hospitalId: string,
    status: string,
    updates?: { availableBeds?: number; availableIcu?: number; waitTimeMinutes?: number; diversionInfo?: string }
  ) {
    const hospital = await prisma.emsHospital.findFirst({ where: { id: hospitalId, companyId } })
    if (!hospital) throw notFound('Hospital not found')

    const updated = await prisma.emsHospital.update({
      where: { id: hospitalId },
      data: {
        status: status as any,
        lastUpdated: new Date(),
        ...updates,
      },
    })

    await emitEmsEvent(companyId, 'ems:hospital:status', {
      hospitalId,
      name: hospital.name,
      previousStatus: hospital.status,
      newStatus: status,
    })

    return updated
  }

  static async recordIncidentNote(companyId: string, incidentId: string, content: string, authorId: string) {
    const incident = await prisma.emsIncident.findFirst({ where: { id: incidentId, companyId } })
    if (!incident) throw notFound('Incident not found')

    return prisma.emsIncidentNote.create({
      data: { incidentId, authorId, content },
    })
  }

  static async getDashboardMetrics(companyId: string) {
    await this.getOrCreateEmsCompany(companyId)
    const [activeIncidents, unitSummary, hospitals, todayIncidents] = await Promise.all([
      prisma.emsIncident.count({ where: { companyId, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
      prisma.emsUnit.groupBy({ by: ['status'], where: { companyId }, _count: true }),
      prisma.emsHospital.findMany({ where: { companyId }, select: { status: true } }),
      prisma.emsIncident.count({
        where: {
          companyId,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ])

    const unitsAvailable = unitSummary.find((u) => u.status === 'AVAILABLE')?._count ?? 0
    const unitsInService = unitSummary
      .filter((u) => ['DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'TRANSPORTING', 'AT_HOSPITAL'].includes(u.status))
      .reduce((sum, u) => sum + u._count, 0)
    const hospitalsOnDivert = hospitals.filter((h) => h.status === 'DIVERT').length

    return {
      activeIncidents,
      todayIncidents,
      unitsAvailable,
      unitsInService,
      hospitalsOnDivert,
      totalHospitals: hospitals.length,
      hospitalsOnline: hospitals.length - hospitalsOnDivert,
    }
  }
}
