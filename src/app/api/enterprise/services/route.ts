import { NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { listServices } from '@/modules/enterprise/enterprise-service-health'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getSessionUser()
    const result = await listServices(user)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
