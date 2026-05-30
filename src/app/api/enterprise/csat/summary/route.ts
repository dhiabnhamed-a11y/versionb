import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { getCsatSummary } from '@/modules/enterprise/enterprise-csat'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    const departmentId = request.nextUrl.searchParams.get('departmentId') || undefined
    const result = await getCsatSummary(user, departmentId)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
