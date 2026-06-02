import type { NextRequest } from 'next/server'
import { apiData as _apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { EmsService } from '@/modules/ems/ems.service'
import { z } from 'zod'

export const runtime = 'nodejs'

function apiData(data: any, opts?: any) {
  return _apiData(data, opts)
}

const CreateIncidentSchema = z.object({
  callSource: z.enum(['PHONE', 'E911', 'CAD', 'WALK_IN', 'TRANSFER', 'RADIO', 'APP']).optional(),
  severity: z.enum(['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'OMEGA']).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  address: z.string().max(500).optional(),
  locationDetails: z.string().max(1000).optional(),
  callerName: z.string().max(200).optional(),
  callerPhone: z.string().max(30).optional(),
  callerNotes: z.string().max(5000).optional(),
  chiefComplaint: z.string().max(500).optional(),
  symptoms: z.string().max(2000).optional(),
  mechanismOfInjury: z.string().max(500).optional(),
  patientCount: z.number().int().min(1).max(9999).optional(),
})

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }: any) => {
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
    async ({ user }: any) => {
      const companyId = user.companyId || ''
      const rawBody = await parseJsonObject(req)
      const parsed = CreateIncidentSchema.safeParse(rawBody)
      if (!parsed.success) {
        return apiData({ error: 'Invalid request', details: parsed.error.flatten().fieldErrors }, { status: 400 })
      }
      const incident = await EmsService.createIncident(companyId, { ...parsed.data, createdById: user.id })
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
