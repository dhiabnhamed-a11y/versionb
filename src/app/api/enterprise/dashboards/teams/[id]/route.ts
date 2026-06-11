import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { getTeamDashboard } from '@/modules/enterprise/enterprise-dashboards'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
try {
const { id } = await params as { id: string };
const user = await getSessionUser()
const result = await getTeamDashboard(user, id)
return NextResponse.json(result)
} catch (e: any) {
return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
}
}, { auth: 'required' });
