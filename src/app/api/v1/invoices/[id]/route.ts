import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { deleteInvoice, getInvoice, updateInvoice } from '@/modules/invoices/invoice.service'

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
      return apiData(await updateInvoice(user, params.id, body), { code: 'INVOICE_UPDATED' })
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
      return apiData(await deleteInvoice(user, params.id, body), { code: 'INVOICE_DELETED' })
    },
    { auth: 'required', responseMode: 'canonical' }
  )
}
