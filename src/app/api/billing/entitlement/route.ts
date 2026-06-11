import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getAuthSecret } from '@/lib/env'
import { hasFeature } from '@/lib/entitlements'
import { withApiHandler } from "@/lib/api/handler";

export const GET = withApiHandler(async ({ req, params }) => {
const token = await getToken({ req, secret: getAuthSecret('entitlement') })
if (!token?.companyId) {
return NextResponse.json({ allowed: false }, { status: 401 })
}

const feature = req.nextUrl.searchParams.get('feature')
if (!feature) {
return NextResponse.json({ error: 'Missing feature param' }, { status: 400 })
}

const allowed = await hasFeature(token.companyId as string, feature)
return NextResponse.json({ allowed }, {
headers: { 'Cache-Control': 'private, max-age=60' },
})
}, { auth: 'required' });
