import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { getPhiAccessLog } from '@/lib/ems/hipaa/audit-enforcer'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }) => {
const companyId = user.companyId || ''
const { searchParams } = new URL(req.url)
const actorId = searchParams.get('actorId') || undefined
const resourceId = searchParams.get('resourceId') || undefined
const resourceType = searchParams.get('resourceType') || undefined
const sinceDays = parseInt(searchParams.get('days') || '30', 10)
const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500)
const since = new Date(Date.now() - sinceDays * 86400000)

const logs = await getPhiAccessLog(companyId, { actorId, resourceId, resourceType, since, limit })
return apiData({ logs, count: logs.length, since: since.toISOString() })
}, {
auth: 'required',
requiredRole: ['OWNER', 'SUPER_ADMIN'],
responseMode: 'legacy',
route: '/api/ems/hipaa/audit-log',
})
}, { auth: 'required' });
