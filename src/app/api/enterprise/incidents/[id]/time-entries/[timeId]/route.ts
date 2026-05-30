import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { deleteTimeEntry } from '@/modules/enterprise/enterprise.service'

export async function DELETE(_request: NextRequest, { params }: { params: { id: string; timeId: string } }) {
  try {
    const user = await getSessionUser()
    const result = await deleteTimeEntry(user, params.id, params.timeId)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
