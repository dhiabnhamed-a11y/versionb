import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { EmsService } from '@/modules/ems/ems.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }) => {
const companyId = user.companyId || ''
const body = await parseJsonObject(req)
const note = await EmsService.recordIncidentNote(companyId, body.incidentId, body.content, user.id)
return apiData(note, { status: 201 })
}, {
auth: 'required', responseMode: 'legacy', route: '/api/ems/notes',
})
}, { auth: 'required' });
