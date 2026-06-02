import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { bulkUpdateIncidentStatus, bulkAssign, bulkAssignTeam, bulkUpdatePriority, bulkDeleteAssets } from '@/modules/enterprise/enterprise-bulk'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    const body = await request.json()

    switch (body.action) {
      case 'update_status': {
        const r = await bulkUpdateIncidentStatus(user, body.ids, body.status, body.resolution)
        return NextResponse.json(r)
      }
      case 'assign': {
        const r = await bulkAssign(user, body.entityType, body.ids, body.assigneeId)
        return NextResponse.json(r)
      }
      case 'assign_team': {
        const r = await bulkAssignTeam(user, body.entityType, body.ids, body.teamId)
        return NextResponse.json(r)
      }
      case 'update_priority': {
        const r = await bulkUpdatePriority(user, body.entityType, body.ids, body.priority)
        return NextResponse.json(r)
      }
      case 'delete_assets': {
        const r = await bulkDeleteAssets(user, body.ids)
        return NextResponse.json(r)
      }
      default:
        return NextResponse.json({ error: `Unknown bulk action: ${body.action}` }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
