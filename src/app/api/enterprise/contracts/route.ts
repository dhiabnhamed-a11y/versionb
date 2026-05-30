import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { listContracts, createContract } from '@/modules/enterprise/enterprise-vendor.service'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    const vendorId = request.nextUrl.searchParams.get('vendorId') || undefined
    const result = await listContracts(user, vendorId)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    const body = await request.json()
    const result = await createContract(user, body)
    return NextResponse.json(result, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
