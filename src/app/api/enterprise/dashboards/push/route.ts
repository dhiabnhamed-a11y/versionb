import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { broadcastDashboardToWorkspace, pushIncidentUpdate } from '@/modules/enterprise/enterprise-realtime'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const POST = withApiHandler(async ({ req, params }) => {
try {
const user = await getSessionUser()
const body = await request.json()

switch (body.action) {
  case 'refresh_dashboard': {
    const result = await broadcastDashboardToWorkspace(user, body.dashboardType, body.scopeId)
    return NextResponse.json(result)
  }
  case 'push_event': {
    if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 })
    const result = await pushIncidentUpdate(user.companyId, body.event, body.payload || {})
    return NextResponse.json(result)
  }
  default:
    return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 })
}
} catch (e: any) {
return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
}
}, { auth: 'required' });
