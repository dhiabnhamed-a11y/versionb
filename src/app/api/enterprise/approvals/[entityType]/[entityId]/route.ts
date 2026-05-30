import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { getApprovalWorkflowStatus } from '@/modules/enterprise/enterprise-approval-engine'

export async function GET(_request: NextRequest, { params }: { params: { entityType: string; entityId: string } }) {
  try {
    const user = await getSessionUser()
    if (!user.companyId) return NextResponse.json({ error: 'No company found.' }, { status: 400 })
    const result = await getApprovalWorkflowStatus(params.entityType, params.entityId)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}
