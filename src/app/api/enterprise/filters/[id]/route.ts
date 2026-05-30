import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { deleteSavedFilter } from '@/modules/enterprise/enterprise-saved-filters'

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser()
    const result = await deleteSavedFilter(user, params.id)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
