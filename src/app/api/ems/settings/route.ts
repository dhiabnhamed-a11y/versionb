import type { NextRequest } from 'next/server'
import { apiData as _apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

function apiData(data: any, opts?: any) {
  return _apiData(data, opts)
}

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const companyId = user.companyId || ''
    let config = await prisma.emsCompany.findUnique({ where: { companyId } })
    if (!config) {
      config = await prisma.emsCompany.create({
        data: { companyId, timezone: 'UTC', dispatchMode: 'semi_auto' },
      })
    }
    return apiData(config)
  }, { auth: 'required', responseMode: 'legacy', route: '/api/ems/settings' })
}

export async function PUT(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }: any) => {
    const companyId = user.companyId || ''
    const body = await parseJsonObject(req)
    const allowed = [
      'regionCode', 'timezone', 'dispatchMode', 'defaultRadioChannel',
      'autoDispatchThreshold', 'responseTimeTarget',
      'enableAiClassification', 'enableAutoDispatch', 'enablePredictiveAlerts',
      'settings',
    ]
    const updateData: Record<string, any> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) updateData[key] = body[key]
    }
    if (Object.keys(updateData).length === 0) {
      return apiData({ message: 'No valid fields to update' })
    }
    const config = await prisma.emsCompany.upsert({
      where: { companyId },
      create: { companyId, ...updateData },
      update: updateData,
    })
    return apiData(config)
  }, {
    auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
    responseMode: 'legacy', route: '/api/ems/settings',
  })
}
