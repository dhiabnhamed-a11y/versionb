import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject, type ApiRouteContext } from '@/lib/api'
import { healthcareService } from '@/modules/healthcare/healthcare.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ShiftParams = { id: string }

export async function GET(_req: NextRequest, ctx: ApiRouteContext<ShiftParams>) {
  return handleApiRoute(
    _req,
    ctx,
    async ({ params, user }) => {
      const id = params.id
      const rows = await healthcareService.listShifts(user.companyId || '')
      const found = rows.find((r) => r.id === id)
      if (!found) throw new Error('Not found')
      return apiData(found)
    },
    { auth: 'required', responseMode: 'legacy', route: '/api/admin/shifts/{id}' }
  )
}

export async function PATCH(req: NextRequest, ctx: ApiRouteContext<ShiftParams>) {
  return handleApiRoute(
    req,
    ctx,
    async ({ params, user }) => {
      const id = params.id
      const body = await parseJsonObject(req)
      const updated = await healthcareService.updateShift(user.companyId || '', id, body)
      return apiData(updated)
    },
    { auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/admin/shifts/{id}' }
  )
}

export async function DELETE(_req: NextRequest, ctx: ApiRouteContext<ShiftParams>) {
  return handleApiRoute(
    _req,
    ctx,
    async ({ params, user }) => {
      const id = params.id
      const result = await healthcareService.deleteShift(user.companyId || '', id)
      return apiData(result)
    },
    { auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/admin/shifts/{id}' }
  )
}
