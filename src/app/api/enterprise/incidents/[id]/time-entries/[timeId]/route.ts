import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { deleteTimeEntry } from '@/modules/enterprise/enterprise.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const DELETE = withApiHandler(async ({ req, params }) => {
try {
const { id, timeId } = await params;
const user = await getSessionUser()
const result = await deleteTimeEntry(user, id, timeId)
return NextResponse.json(result)
} catch (e: any) {
return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
}
}, { auth: 'required' });
