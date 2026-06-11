import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createClient, listClients } from '@/modules/clients/service'
import { parsePagination } from '@/modules/shared/pagination'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
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

  return apiData(body, { pagination: body.pagination })
},
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const body = await parseJsonObject(req)
  return apiData(await createClient(user, body), { status: 201 })
},
{
  auth: 'required',
  rateLimit: {
    max: 30,
    namespace: 'clients.write',
    windowMs: 60_000,
  },
  responseMode: 'legacy',
}
)
}, { auth: 'required' });
