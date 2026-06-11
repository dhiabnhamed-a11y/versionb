import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createErpModuleRecord, listErpModule, patchErpModuleRecord } from '@/services/erp2/operations.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: Promise<{ module: string }> }) {
  return handleApiRoute(
    req,
    ctx,
    async ({ user, params }) => {
      const url = new URL(req.url)
      const data = await listErpModule(user, params.module, {
        q: url.searchParams.get('q'),
        status: url.searchParams.get('status'),
      })
      return apiData(data, { code: 'ERP_MODULE_LISTED' })
    },
    {
      auth: 'required',
      responseMode: 'canonical',
      route: '/api/v1/erp2/modules/{module}',
    }
  )
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ module: string }> }) {
  return handleApiRoute(
    req,
    ctx,
    async ({ user, params }) => {
      const body = await parseJsonObject(req)
      const data = await createErpModuleRecord(user, params.module, body)
      return apiData(data, { code: 'ERP_MODULE_RECORD_CREATED', status: 201 })
    },
    {
      auth: 'required',
      responseMode: 'canonical',
      route: '/api/v1/erp2/modules/{module}',
    }
  )
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ module: string }> }) {
  return handleApiRoute(
    req,
    ctx,
    async ({ user, params }) => {
      const body = await parseJsonObject(req)
      const data = await patchErpModuleRecord(user, params.module, body)
      return apiData(data, { code: 'ERP_MODULE_RECORD_UPDATED' })
    },
    {
      auth: 'required',
      idempotency: true,
      responseMode: 'canonical',
      route: '/api/v1/erp2/modules/{module}',
    }
  )
}
