import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { getIdempotencyKey, runIdempotent } from '@/lib/idempotency'
import { createClient, listClients } from '@/modules/clients/service'
import { parsePagination } from '@/modules/shared/pagination'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const pagination = parsePagination(req, { pageSize: 24, maxPageSize: 100 })
      const body = await listClients(
        user,
        {
          query: req.nextUrl.searchParams.get('q'),
          status: req.nextUrl.searchParams.get('status'),
        },
        pagination
      )

      return apiData(body, { code: 'CLIENTS_LISTED', pagination: body.pagination })
    },
    { auth: 'required', responseMode: 'canonical' }
  )
}

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      const client = await runIdempotent(getIdempotencyKey(req), body, () => createClient(user, body), {
        companyId: user.companyId,
        method: req.method,
        responseStatus: 201,
        route: '/api/v1/clients',
      })
      return apiData(client, { code: 'CLIENT_CREATED', status: 201 })
    },
    {
      auth: 'required',
      rateLimit: {
        max: 30,
        namespace: 'clients.write',
        windowMs: 60_000,
      },
      responseMode: 'canonical',
    }
  )
}
