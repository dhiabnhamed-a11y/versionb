import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { updateServiceStatus } from '@/modules/enterprise/enterprise-service-health'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getSessionUser()
    const body = await request.json()
    const result = await updateServiceStatus(user, id, body)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
