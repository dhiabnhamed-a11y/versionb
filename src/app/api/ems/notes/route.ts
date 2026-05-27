import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { EmsService } from '@/modules/ems/ems.service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const companyId = user.companyId || ''
    const body = await parseJsonObject(req)
    const note = await EmsService.recordIncidentNote(companyId, body.incidentId, body.content, user.id)
    return apiData(note, { status: 201 })
  }, {
    auth: 'required', responseMode: 'legacy', route: '/api/ems/notes',
  })
}
