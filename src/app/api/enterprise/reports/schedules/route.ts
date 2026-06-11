import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { listReportSchedules, createReportSchedule } from '@/modules/enterprise/enterprise-reports'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
try {
const user = await getSessionUser()
const result = await listReportSchedules(user)
return NextResponse.json(result)
} catch (e: any) {
return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
}
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
try {
const user = await getSessionUser()
const body = await request.json()
const result = await createReportSchedule(user, body)
return NextResponse.json(result, { status: 201 })
} catch (e: any) {
return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
}
}, { auth: 'required' });
