import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { getIdempotencyKey, runIdempotent } from '@/lib/idempotency'
import { createInvoice, listInvoices } from '@/modules/invoices/invoice.service'
import { parsePagination } from '@/modules/shared/pagination'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const pagination = parsePagination(req, { pageSize: 30, maxPageSize: 100 })
      const body = await listInvoices(
        user,
        {
          status: req.nextUrl.searchParams.get('status'),
          query: req.nextUrl.searchParams.get('q'),
          clientId: req.nextUrl.searchParams.get('clientId'),
          campaignId: req.nextUrl.searchParams.get('campaignId'),
          briefId: req.nextUrl.searchParams.get('briefId'),
        },
        pagination
      )

      return apiData(body, { code: 'INVOICES_LISTED', pagination: body.pagination })
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
      const invoice = await runIdempotent(getIdempotencyKey(req), body, () => createInvoice(user, body), {
        companyId: user.companyId,
        method: req.method,
        responseStatus: 201,
        route: '/api/v1/invoices',
      })
      return apiData(invoice, { code: 'INVOICE_CREATED', status: 201 })
    },
    { auth: 'required', responseMode: 'canonical' }
  )
}
