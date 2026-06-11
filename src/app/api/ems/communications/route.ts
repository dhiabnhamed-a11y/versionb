import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { EmsService } from '@/modules/ems/ems.service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const companyId = user.companyId || ''
    const body = await parseJsonObject(req)
    const comm = await EmsService.addCommunication(companyId, body.incidentId, {
      channel: body.channel,
      fromUserId: user.id,
      toUserId: body.toUserId,
      messageType: body.messageType,
      content: body.content,
      transcript: body.transcript,
    })
    return apiData(comm, { status: 201 })
  }, {
    auth: 'required', responseMode: 'legacy', route: '/api/ems/communications',
  })
}
