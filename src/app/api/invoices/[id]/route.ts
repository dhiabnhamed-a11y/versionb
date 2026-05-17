import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { deleteInvoice, getInvoice, updateInvoice } from '@/modules/invoices/invoice.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    ctx,
    async ({ params, user }) => apiData(await getInvoice(user, params.id)),
    { auth: 'required', responseMode: 'legacy', route: '/api/invoices/[id]' }
  )
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
}
