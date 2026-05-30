import { NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { getDepartmentDashboard } from '@/modules/enterprise/enterprise-dashboards'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextResponse, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser()
    const result = await getDepartmentDashboard(user, params.id)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
