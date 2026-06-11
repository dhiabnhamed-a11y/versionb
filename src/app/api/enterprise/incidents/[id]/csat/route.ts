import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { triggerCsatSurvey, submitCsatResponse } from '@/modules/enterprise/enterprise-csat'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const POST = withApiHandler(async ({ req, params }) => {
try {
const { id } = await params;
const user = await getSessionUser()
const body = await request.json()

if (body.score !== undefined) {
  const result = await submitCsatResponse(user, id, body)
  return NextResponse.json(result)
}

const result = await triggerCsatSurvey(id)
return NextResponse.json(result)
} catch (e: any) {
return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
}
}, { auth: 'required' });
