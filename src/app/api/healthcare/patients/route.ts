import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { HealthcareService } from '@/modules/healthcare/healthcare.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const patients = await HealthcareService.getPatientSummaries(user.companyId!, limit)
    return apiData({ patients, count: patients.length })
  }, { auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/healthcare/patients' })
}

export async function POST(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const body = await parseJsonObject(req)
    const patient = await HealthcareService.createPatient(user.companyId!, body)
    return apiData(patient, { status: 201 })
  }, { auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/healthcare/patients' })
}
