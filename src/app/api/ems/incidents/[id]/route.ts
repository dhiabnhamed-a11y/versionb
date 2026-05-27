// @ts-nocheck — depends on prisma generate for Ems* models; PATCH returns union type incompatible with handleApiRoute generics
import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { EmsService } from '@/modules/ems/ems.service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    { params },
    async ({ params: p, user }: any) => {
      const companyId = user.companyId || ''
      const incident = await EmsService.getIncident(companyId, p.id)
      return apiData(incident)
    },
    { auth: 'required', responseMode: 'legacy', route: '/api/ems/incidents/[id]' }
  )
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    { params },
    async ({ params: p, user }: any) => {
      const companyId = user.companyId || ''
      const body = await parseJsonObject(req)
      if (body.status) {
        const updated = await EmsService.updateIncidentStatus(companyId, p.id, body.status, { ...body, actorId: user.id })
        return apiData(updated)
      }
      return apiData({ message: 'No status provided' })
    },
    {
      auth: 'required',
      requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
      responseMode: 'legacy',
      route: '/api/ems/incidents/[id]',
    }
  )
}
