import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { getContract, updateContract } from '@/modules/enterprise/enterprise-vendor.service'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser()
    const result = await getContract(user, params.id)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser()
    const body = await request.json()
    const result = await updateContract(user, params.id, body)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
