import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { HealthcareService } from '@/modules/healthcare/healthcare.service'
import { notFound } from '@/modules/shared/errors'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withApiHandler(async ({ req, params }) => {
const { id } = await ctx.params
return handleApiRoute(req, undefined, async ({ user }) => {
const patient = await HealthcareService.getPatientById(user.companyId!, id)
if (!patient) throw notFound('Patient not found')
return apiData(patient)
}, { auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/healthcare/patients/[id]' })
}, { auth: 'required' });

export const PATCH = withApiHandler(async ({ req, params }) => {
const { id } = await ctx.params
return handleApiRoute(req, undefined, async ({ user }) => {
const body = await parseJsonObject(req)
const patient = await HealthcareService.updatePatient(user.companyId!, id, body)
return apiData(patient)
}, { auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/healthcare/patients/[id]' })
}, { auth: 'required' });

export const DELETE = withApiHandler(async ({ req, params }) => {
const { id } = await ctx.params
return handleApiRoute(req, undefined, async ({ user }) => {
return apiData(await HealthcareService.deletePatient(user.companyId!, id))
}, { auth: 'required', requiredRole: ['OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/healthcare/patients/[id]' })
}, { auth: 'required' });
