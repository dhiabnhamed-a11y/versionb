import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { runRetentionAudit, purgeExpiredData } from '@/lib/ems/hipaa/data-retention'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }) => {
const companyId = user.companyId || ''
const audit = await runRetentionAudit(companyId)
return apiData({ audit, policy: 'Default HIPAA-aligned policy (7yr incidents, 6yr audit logs)' })
}, {
auth: 'required',
requiredRole: ['OWNER', 'SUPER_ADMIN'],
responseMode: 'legacy',
route: '/api/ems/hipaa/retention',
})
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }) => {
const companyId = user.companyId || ''
const body = await parseJsonObject(req)
const dryRun = body.dryRun !== false // default: dry run

if (!dryRun) {
  // Require explicit confirmation string to prevent accidental purges
  if (body.confirm !== 'PURGE_CONFIRMED') {
    return apiData({ error: 'Set confirm: "PURGE_CONFIRMED" to execute purge. Use dryRun: true to preview.' }, { status: 400 }) as never
  }
}

const result = await purgeExpiredData(companyId, body.policy, dryRun)
return apiData(result)
}, {
auth: 'required',
requiredRole: ['OWNER', 'SUPER_ADMIN'],
responseMode: 'legacy',
route: '/api/ems/hipaa/retention',
})
}, { auth: 'required' });
