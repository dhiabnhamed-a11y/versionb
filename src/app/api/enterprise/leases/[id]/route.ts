import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { getLease, endLease } from '@/modules/enterprise/enterprise-vendor.service'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser()
    const result = await getLease(user, params.id)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser()
    const body = await request.json()
    const result = await endLease(user, params.id, body)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
