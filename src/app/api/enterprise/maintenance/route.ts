import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createMaintenanceWorkOrder, listMaintenance } from '@/modules/enterprise/enterprise.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const url = new URL(req.url)
    const result = await listMaintenance(user, url.searchParams)
    return apiData(result.data, { pagination: result.pagination })
  }, {
    auth: 'required',
    responseMode: 'canonical',
  })
}

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user, requestId }) => {
      const body = await parseJsonObject(req)
      return apiData(await createMaintenanceWorkOrder(user, body, requestId), { status: 201 })
    },
    { auth: 'required', responseMode: 'canonical' }
  )
}
