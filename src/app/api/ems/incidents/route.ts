import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { EmsService } from '@/modules/ems/ems.service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const companyId = user.companyId || ''
      const { searchParams } = new URL(req.url)
      const active = searchParams.get('active') === 'true'
      const id = searchParams.get('id')
      if (id) {
        const incident = await EmsService.getIncident(companyId, id)
        return apiData(incident)
      }
      const incidents = active
        ? await EmsService.listActiveIncidents(companyId)
        : await EmsService.listActiveIncidents(companyId)
      return apiData(incidents)
    },
    { auth: 'required', responseMode: 'legacy', route: '/api/ems/incidents' }
  )
}

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const companyId = user.companyId || ''
      const body = await parseJsonObject(req)
      const incident = await EmsService.createIncident(companyId, { ...body, createdById: user.id })
      return apiData(incident, { status: 201 })
    },
    {
      auth: 'required',
      requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
      idempotency: { enabled: true, responseStatus: 201 },
      responseMode: 'legacy',
      route: '/api/ems/incidents',
    }
  )
}
