import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { getVendor, updateVendor } from '@/modules/enterprise/enterprise-vendor.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
try {
const { id } = await params;
const user = await getSessionUser()
const result = await getVendor(user, id)
return NextResponse.json(result)
} catch (e: any) {
return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
}
}, { auth: 'required' });

export const PATCH = withApiHandler(async ({ req, params }) => {
try {
const { id } = await params;
const user = await getSessionUser()
const body = await request.json()
const result = await updateVendor(user, id, body)
return NextResponse.json(result)
} catch (e: any) {
return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
}
}, { auth: 'required' });
