import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { getProblem, updateProblem } from '@/modules/enterprise/enterprise.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
try {
const { id } = await params as { id: string };
const user = await getSessionUser()
const result = await getProblem(user, id)
return NextResponse.json(result)
} catch (e: any) {
return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
}
}, { auth: 'required' });

export const PATCH = withApiHandler(async ({ req, params }) => {
try {
const { id } = await params as { id: string };
const user = await getSessionUser()
const body = await request.json()
const result = await updateProblem(user, id, body)
return NextResponse.json(result)
} catch (e: any) {
return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
}
}, { auth: 'required' });
