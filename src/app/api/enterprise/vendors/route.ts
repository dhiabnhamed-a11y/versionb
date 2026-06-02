import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { listVendors, createVendor } from '@/modules/enterprise/enterprise-vendor.service'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getSessionUser()
    const result = await listVendors(user)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    const body = await request.json()
    const result = await createVendor(user, body)
    return NextResponse.json(result, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
