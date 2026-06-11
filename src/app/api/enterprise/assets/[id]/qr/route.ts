import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { generateAssetQr } from '@/modules/enterprise/enterprise-qr'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const POST = withApiHandler(async ({ req, params }) => {
try {
const { id } = await params;
await getSessionUser()
const svg = await generateAssetQr(id)
if (!svg) return NextResponse.json({ error: 'Asset not found.' }, { status: 404 })
return new NextResponse(svg, { headers: { 'Content-Type': 'image/svg+xml' } })
} catch (e: any) {
return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
}
}, { auth: 'required' });
