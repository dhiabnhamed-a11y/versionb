import { prisma } from '@/lib/db'
import type { NextRequest } from 'next/server'
import { apiData as _apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { notFound } from '@/modules/shared/errors'
import { EmsService } from '@/modules/ems/ems.service'
import { DispatchEngine } from '@/modules/ems/dispatch-engine'
import { EmsAiService } from '@/modules/ems/ai/ems-ai-agent'
import { EmsNotificationService } from '@/modules/ems/ems-notifications.service'

export const runtime = 'nodejs'

function apiData(data: any, opts?: any) {
  return _apiData(data, opts)
}

function getSeverityWeight(severity: string): number {
  const w: Record<string, number> = { ALPHA: 1, BRAVO: 2, CHARLIE: 3, DELTA: 4, ECHO: 5, OMEGA: 10 }
  return w[severity] || 1
}

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }: any) => {
      const companyId = user.companyId || ''
      const body = await parseJsonObject(req)

      if (body.action === 'find_units') {
        const candidates = await DispatchEngine.findBestUnit(
          companyId, body.lat, body.lng, body.severity || 'ALPHA',
          { maxResults: body.maxResults || 10, requiredCapabilities: body.requiredCapabilities }
        )
        const candidateIds = candidates.map((c) => c.unitId)
        const units = await prisma.emsUnit.findMany({
          where: { companyId, id: { in: candidateIds } },
          select: {
            id: true, unitNumber: true, type: true, status: true,
            lat: true, lng: true, fuelLevel: true, crewCapacity: true,
            isOnline: true, speed: true, heading: true, batteryLevel: true,
          },
        })
        return apiData({ candidates, units })
      }

      if (body.action === 'auto_dispatch') {
        const result = await DispatchEngine.autoDispatch(companyId, body.incidentId, body.severity || 'ALPHA')
        if (result.success && result.assigned) {
          const updated = await EmsService.assignUnit(companyId, body.incidentId, result.assigned.unitId, 'AI_AUTO_DISPATCH', user.id)

          await EmsNotificationService.sendDispatchAlert({
            companyId,
            incidentId: body.incidentId,
            incidentNumber: updated.incidentNumber,
            severity: body.severity || 'ALPHA',
            lat: updated.lat || body.lat || 0,
            lng: updated.lng || body.lng || 0,
            address: updated.address,
            chiefComplaint: updated.chiefComplaint,
            unitIds: [result.assigned.unitId],
            dispatcherId: user.id,
          })

          return apiData({ ...result, incident: updated })
        }
        return apiData(result)
      }

      if (body.action === 'assign_unit') {
        const updated = await EmsService.assignUnit(companyId, body.incidentId, body.unitId, body.decisionType || 'DISPATCHER_MANUAL', user.id)

        await EmsNotificationService.sendDispatchAlert({
          companyId,
          incidentId: body.incidentId,
          incidentNumber: updated.incidentNumber,
          severity: body.severity || 'ALPHA',
          lat: updated.lat || 0,
          lng: updated.lng || 0,
          address: updated.address,
          chiefComplaint: updated.chiefComplaint,
          unitIds: [body.unitId],
          dispatcherId: user.id,
        })

        return apiData(updated)
      }

      if (body.action === 'classify') {
        const classification = await EmsAiService.classifySeverity(body.incidentId)
        return apiData(classification)
      }

      if (body.action === 'recommend') {
        const recommendation = await EmsAiService.recommendDispatch(
          companyId, body.incidentId, body.lat, body.lng, body.severity
        )
        return apiData(recommendation)
      }

      if (body.action === 'nearest_hospital') {
        const hospital = await DispatchEngine.getNearestHospital(companyId, body.lat, body.lng)
        return apiData(hospital)
      }

      if (body.action === 'incident_lifecycle') {
        const { incidentId, newStatus, metadata } = body
        const incident = await EmsService.updateIncidentStatus(companyId, incidentId, newStatus, metadata)
        await EmsNotificationService.sendStatusAlert(companyId, incidentId, newStatus)
        return apiData({
          success: true,
          incident,
          previousStatus: incident.status,
          newStatus,
        })
      }

      if (body.action === 'send_notification') {
        const incident = await EmsService.getIncident(companyId, body.incidentId)
        const result = await EmsNotificationService.sendDispatchAlert({
          companyId,
          incidentId: body.incidentId,
          incidentNumber: incident.incidentNumber,
          severity: incident.severity,
          lat: incident.lat || 0,
          lng: incident.lng || 0,
          address: incident.address,
          chiefComplaint: incident.chiefComplaint,
          unitIds: body.unitIds,
          dispatcherId: user.id,
        })
        return apiData(result)
      }

      return apiData({ message: 'Unknown action' }, { status: 400 })
    },
    {
      auth: 'required',
      requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
      responseMode: 'legacy',
      route: '/api/ems/dispatch',
    }
  )
}

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }: any) => {
      const companyId = user.companyId || ''
      const { searchParams } = new URL(req.url)
      const incidentId = searchParams.get('incidentId')
      const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

      const where: any = { incident: { companyId } }
      if (incidentId) where.incidentId = incidentId

      const logs = await prisma.emsDispatchLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { incident: { select: { incidentNumber: true } } },
      })
      return apiData(logs)
    },
    {
      auth: 'required',
      requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
      responseMode: 'legacy',
      route: '/api/ems/dispatch',
    }
  )
}
