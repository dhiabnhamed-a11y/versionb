import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { HealthcareService } from '@/modules/healthcare/healthcare.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await params
  return handleApiRoute(req, undefined, async ({ user }) => {
    const result = await HealthcareService.dischargePatient(user.companyId!, id)
    return apiData(result)
  }, { auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/healthcare/patients/[id]/discharge' })
}
