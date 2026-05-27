// @ts-nocheck — multiple return type branches incompatible with handleApiRoute generics
import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { EmsService } from '@/modules/ems/ems.service'
import { DispatchEngine } from '@/modules/ems/dispatch-engine'
import { EmsAiService } from '@/modules/ems/ai/ems-ai-agent'

export const runtime = 'nodejs'

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
          { maxResults: body.maxResults || 5, requiredCapabilities: body.requiredCapabilities }
        )
        return apiData(candidates)
      }

      if (body.action === 'auto_dispatch') {
        const result = await DispatchEngine.autoDispatch(companyId, body.incidentId, body.severity || 'ALPHA')
        if (result.success && result.assigned) {
          const updated = await EmsService.assignUnit(companyId, body.incidentId, result.assigned.unitId, 'AI_AUTO_DISPATCH', user.id)
          return apiData({ ...result, incident: updated })
        }
        return apiData(result)
      }

      if (body.action === 'assign_unit') {
        const updated = await EmsService.assignUnit(companyId, body.incidentId, body.unitId, body.decisionType, user.id)
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
