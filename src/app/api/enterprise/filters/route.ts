import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { listSavedFilters, saveFilter } from '@/modules/enterprise/enterprise-saved-filters'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    const entityType = request.nextUrl.searchParams.get('entityType') || ''
    const result = await listSavedFilters(user, entityType)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    const body = await request.json()
    const result = await saveFilter(user, body)
    return NextResponse.json(result, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
