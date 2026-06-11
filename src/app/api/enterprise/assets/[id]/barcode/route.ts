import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { generateBarcode } from '@/modules/enterprise/enterprise-qr'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const POST = withApiHandler(async ({ req, params }) => {
try {
const { id } = await params as { id: string };
await getSessionUser()
const code = await generateBarcode(id)
if (!code) return NextResponse.json({ error: 'Asset not found.' }, { status: 404 })
return NextResponse.json({ barcode: code })
} catch (e: any) {
return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
}
}, { auth: 'required' });
