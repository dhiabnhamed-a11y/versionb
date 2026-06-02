import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { getIdempotencyKey, runIdempotent } from '@/lib/idempotency'
import { deleteInvoice, getInvoice, updateInvoice } from '@/modules/invoices/invoice.service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    context,
    async ({ params, user }) => apiData(await getInvoice(user, params.id), { code: 'INVOICE_RETRIEVED' }),
    { auth: 'required', responseMode: 'canonical' }
  )
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    context,
    async ({ params, user }) => {
      const body = await parseJsonObject(req)
      const invoice = await runIdempotent(getIdempotencyKey(req), body, () => updateInvoice(user, params.id, body), {
        companyId: user.companyId,
        method: req.method,
        route: '/api/v1/invoices/{id}',
      })
      return apiData(invoice, { code: 'INVOICE_UPDATED' })
    },
    { auth: 'required', responseMode: 'canonical' }
  )
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    context,
    async ({ params, user }) => {
      const body = await parseJsonObject(req)
      const result = await runIdempotent(getIdempotencyKey(req), body, () => deleteInvoice(user, params.id, body), {
        companyId: user.companyId,
        method: req.method,
        route: '/api/v1/invoices/{id}',
      })
      return apiData(result, { code: 'INVOICE_DELETED' })
    },
    { auth: 'required', responseMode: 'canonical' }
  )
}
