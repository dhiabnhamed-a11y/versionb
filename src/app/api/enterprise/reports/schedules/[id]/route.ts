import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { deleteReportSchedule } from '@/modules/enterprise/enterprise-reports'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const DELETE = withApiHandler(async ({ req, params }) => {
try {
const { id } = await params as { id: string };
const user = await getSessionUser()
const result = await deleteReportSchedule(user, id)
return NextResponse.json(result)
} catch (e: any) {
return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
}
}, { auth: 'required' });
