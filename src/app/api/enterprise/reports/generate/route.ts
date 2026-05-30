import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { generateReport } from '@/modules/enterprise/enterprise-reports'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    const reportType = request.nextUrl.searchParams.get('type') as any
    const departmentId = request.nextUrl.searchParams.get('departmentId') || undefined
    const from = request.nextUrl.searchParams.get('from') || undefined
    const to = request.nextUrl.searchParams.get('to') || undefined

    if (!reportType) return NextResponse.json({ error: 'Report type is required' }, { status: 400 })

    const result = await generateReport(user, reportType, { departmentId, from, to })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
