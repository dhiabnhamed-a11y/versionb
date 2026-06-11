import type { NextRequest } from 'next/server'
import { apiData as _apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { prisma } from '@/lib/db'
import { EmsService } from '@/modules/ems/ems.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

function apiData(data: any, opts?: any) {
  return _apiData(data, opts)
}

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }: any) => {
const companyId = user.companyId || ''
await EmsService.getOrCreateEmsCompany(companyId)
const rules = await prisma.emsAutomationRule.findMany({
  where: { companyId },
  orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
})
return apiData(rules)
}, { auth: 'required', responseMode: 'legacy', route: '/api/ems/automation' })
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }: any) => {
const companyId = user.companyId || ''
await EmsService.getOrCreateEmsCompany(companyId)
const body = await parseJsonObject(req)
const rule = await prisma.emsAutomationRule.create({
  data: {
    companyId,
    name: body.name,
    description: body.description,
    trigger: body.trigger,
    conditions: body.conditions || [],
    actions: body.actions || [],
    isActive: body.isActive ?? true,
    priority: body.priority ?? 0,
  },
})
return apiData(rule, { status: 201 })
}, {
auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
responseMode: 'legacy', route: '/api/ems/automation',
})
}, { auth: 'required' });

export const PATCH = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }: any) => {
const companyId = user.companyId || ''
await EmsService.getOrCreateEmsCompany(companyId)
const body = await parseJsonObject(req)
const { id, ...updates } = body
if (!id) return apiData({ message: 'id is required' }, { status: 400 })
const allowed = ['name', 'description', 'trigger', 'conditions', 'actions', 'isActive', 'priority']
const updateData: Record<string, any> = {}
for (const key of allowed) {
  if (updates[key] !== undefined) updateData[key] = updates[key]
}
const rule = await prisma.emsAutomationRule.findFirst({ where: { id, companyId } })
if (!rule) return apiData({ message: 'Rule not found' }, { status: 404 })
const updated = await prisma.emsAutomationRule.update({ where: { id }, data: updateData })
return apiData(updated)
}, {
auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
responseMode: 'legacy', route: '/api/ems/automation',
})
}, { auth: 'required' });

export const DELETE = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }: any) => {
const companyId = user.companyId || ''
await EmsService.getOrCreateEmsCompany(companyId)
const url = new URL(req.url)
const id = url.searchParams.get('id')
if (!id) return apiData({ error: 'id query param is required' }, { status: 400 }) as never
const rule = await prisma.emsAutomationRule.findFirst({ where: { id, companyId } })
if (!rule) return apiData({ error: 'Rule not found' }, { status: 404 }) as never
await prisma.emsAutomationRule.delete({ where: { id } })
return apiData({ success: true })
}, {
auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
responseMode: 'legacy', route: '/api/ems/automation',
})
}, { auth: 'required' });
