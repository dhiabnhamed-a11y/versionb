import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { deleteWebhookConfig } from '@/modules/enterprise/enterprise-webhooks'

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser()
    const result = await deleteWebhookConfig(user, params.id)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
