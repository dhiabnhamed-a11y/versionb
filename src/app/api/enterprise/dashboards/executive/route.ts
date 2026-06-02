import { NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { getExecutiveDashboard } from '@/modules/enterprise/enterprise-dashboards'

export const runtime = 'nodejs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getSessionUser()
    const result = await getExecutiveDashboard(user)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
