import { NextResponse } from 'next/server'
import { collectPublicHealth } from '@/lib/infra/health'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
const snapshot = await collectPublicHealth()
return NextResponse.json(snapshot, {
status: snapshot.ok ? 200 : 503,
headers: { 'Cache-Control': 'no-store' },
})
}, { auth: 'required' });
