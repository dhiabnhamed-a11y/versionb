import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { NO_STORE_HEADERS } from '@/lib/http'
import { deleteClient, getClientDetail, updateClient } from '@/modules/clients/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    undefined,
    async ({ params, user }) =>
      apiData(await getClientDetail(user, params.id), { headers: NO_STORE_HEADERS }),
    { auth: 'required', responseMode: 'legacy', route: '/api/clients/[id]' }
  )
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    undefined,
    async ({ params, user }) => {
      const body = await parseJsonObject(req)
      return apiData(await updateClient(user, params.id, body))
    },
    {
      auth: 'required',
      idempotency: true,
      rateLimit: { max: 30, namespace: 'clients.write', windowMs: 60_000 },
      responseMode: 'legacy',
      route: '/api/clients/[id]',
    }
  )
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    undefined,
    async ({ params, user }) => apiData(await deleteClient(user, params.id)),
    {
      auth: 'required',
      idempotency: true,
      rateLimit: { max: 30, namespace: 'clients.write', windowMs: 60_000 },
      responseMode: 'legacy',
      route: '/api/clients/[id]',
    }
  )
}
