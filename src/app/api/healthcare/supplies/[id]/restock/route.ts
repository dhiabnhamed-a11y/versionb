import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { HealthcareService } from '@/modules/healthcare/healthcare.service'
import { badRequest } from '@/modules/shared/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await params as { id: string }
  return handleApiRoute(req, undefined, async ({ user }) => {
    const body = await parseJsonObject(req)
    const quantity = Number(body.quantity)
    if (!quantity || quantity <= 0) throw badRequest('quantity must be a positive number')
    return apiData(await HealthcareService.restockSupply(user.companyId!, id, quantity))
  }, { auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/healthcare/supplies/[id]/restock' })
}
