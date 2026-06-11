import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { HealthcareService } from '@/modules/healthcare/healthcare.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = withApiHandler(async ({ req, params }) => {
const { id } = await ctx.params
return handleApiRoute(req, undefined, async ({ user }) => {
const body = await parseJsonObject(req)
return apiData(await HealthcareService.updateSupply(user.companyId!, id, body))
}, { auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/healthcare/supplies/[id]' })
}, { auth: 'required' });

export const DELETE = withApiHandler(async ({ req, params }) => {
const { id } = await ctx.params
return handleApiRoute(req, undefined, async ({ user }) => {
return apiData(await HealthcareService.deleteSupply(user.companyId!, id))
}, { auth: 'required', requiredRole: ['OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/healthcare/supplies/[id]' })
}, { auth: 'required' });
