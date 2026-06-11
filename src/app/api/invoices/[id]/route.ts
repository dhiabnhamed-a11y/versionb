import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { deleteInvoice, getInvoice, updateInvoice } from '@/modules/invoices/invoice.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
ctx,
async ({ params, user }) => apiData(await getInvoice(user, params.id)),
{ auth: 'required', responseMode: 'legacy', route: '/api/invoices/[id]' }
)
}, { auth: 'required' });

export const PATCH = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
ctx,
async ({ params, user }) => {
  const body = await parseJsonObject(req)
  return apiData(await updateInvoice(user, params.id, body))
},
{
  auth: 'required',
  idempotency: true,
  rateLimit: { max: 30, namespace: 'invoices.write', windowMs: 60_000 },
  responseMode: 'legacy',
  route: '/api/invoices/[id]',
}
)
}, { auth: 'required' });

export const DELETE = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
ctx,
async ({ params, user }) => {
  const body = await parseJsonObject(req)
  return apiData(await deleteInvoice(user, params.id, body))
},
{
  auth: 'required',
  idempotency: true,
  rateLimit: { max: 30, namespace: 'invoices.write', windowMs: 60_000 },
  responseMode: 'legacy',
  route: '/api/invoices/[id]',
}
)
}, { auth: 'required' });
