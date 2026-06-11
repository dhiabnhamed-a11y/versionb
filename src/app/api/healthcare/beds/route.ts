import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { HealthcareService } from '@/modules/healthcare/healthcare.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const beds = await HealthcareService.getBeds(user.companyId!)
    return apiData({ beds, count: beds.length })
  }, { auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/healthcare/beds' })
}

export async function POST(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const body = await parseJsonObject(req)
    const bed = await HealthcareService.createBed(user.companyId!, body)
    return apiData(bed, { status: 201 })
  }, { auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/healthcare/beds' })
}
