import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { listLeases, createLease } from '@/modules/enterprise/enterprise-vendor.service'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    const assetId = request.nextUrl.searchParams.get('assetId') || undefined
    const result = await listLeases(user, assetId)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    const body = await request.json()
    const result = await createLease(user, body)
    return NextResponse.json(result, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
