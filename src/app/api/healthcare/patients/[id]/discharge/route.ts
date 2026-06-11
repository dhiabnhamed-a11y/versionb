import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { HealthcareService } from '@/modules/healthcare/healthcare.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export const POST = withApiHandler(async ({ req, params }) => {
const { id } = await ctx.params
return handleApiRoute(req, undefined, async ({ user }) => {
const result = await HealthcareService.dischargePatient(user.companyId!, id)
return apiData(result)
}, { auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/healthcare/patients/[id]/discharge' })
}, { auth: 'required' });
