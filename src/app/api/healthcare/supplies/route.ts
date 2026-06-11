import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { HealthcareService } from '@/modules/healthcare/healthcare.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }) => {
const { searchParams } = new URL(req.url)
const category = searchParams.get('category') || undefined
const supplies = await HealthcareService.getSupplies(user.companyId!, category)
const alerts = await HealthcareService.getInventoryAlerts(user.companyId!)
return apiData({ supplies, alerts, count: supplies.length })
}, { auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/healthcare/supplies' })
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }) => {
const body = await parseJsonObject(req)
const supply = await HealthcareService.createSupply(user.companyId!, body)
return apiData(supply, { status: 201 })
}, { auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/healthcare/supplies' })
}, { auth: 'required' });
