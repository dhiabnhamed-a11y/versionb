import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { deleteClient, getClientDetail, updateClient } from '@/modules/clients/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    ctx,
    async ({ params, user }) => apiData(await getClientDetail(user, params.id), { code: 'CLIENT_RETRIEVED' }),
    { auth: 'required', responseMode: 'canonical', route: '/api/v1/clients/{id}' }
  )
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    ctx,
    async ({ params, user }) => {
      const body = await parseJsonObject(req)
      return apiData(await updateClient(user, params.id, body), { code: 'CLIENT_UPDATED' })
    },
    {
      auth: 'required',
      idempotency: true,
      rateLimit: { max: 30, namespace: 'clients.write', windowMs: 60_000 },
      responseMode: 'canonical',
      route: '/api/v1/clients/{id}',
    }
  )
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    ctx,
    async ({ params, user }) => apiData(await deleteClient(user, params.id), { code: 'CLIENT_DELETED' }),
    {
      auth: 'required',
      idempotency: true,
      rateLimit: { max: 30, namespace: 'clients.write', windowMs: 60_000 },
      responseMode: 'canonical',
      route: '/api/v1/clients/{id}',
    }
  )
}
