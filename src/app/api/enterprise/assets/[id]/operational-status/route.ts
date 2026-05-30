import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { transitionAssetOperationalStatus } from '@/modules/enterprise/enterprise-lifecycle'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser()
    const body = await request.json()
    const result = await transitionAssetOperationalStatus(user, params.id, body)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
