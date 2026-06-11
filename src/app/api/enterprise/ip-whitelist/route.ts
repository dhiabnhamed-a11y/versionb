import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { updateIpWhitelist, getClientIp } from '@/modules/enterprise/enterprise-ip-whitelist'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
try {
const user = await getSessionUser()
const ip = getClientIp(request)
return NextResponse.json({ ip })
} catch (e: any) {
return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
}
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
try {
const user = await getSessionUser()
const body = await request.json()
const result = await updateIpWhitelist(user.companyId!, body.networks)
return NextResponse.json({ networks: result })
} catch (e: any) {
return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
}
}, { auth: 'required' });
