import { NextRequest, NextResponse } from 'next/server'
import { createInvoice, listInvoices } from '@/modules/invoices/invoice.service'
import { okJson, parseJsonObject, withApiError } from '@/modules/shared/api'
import { parsePagination } from '@/modules/shared/pagination'
import { requireSessionUser } from '@/modules/shared/session'

export async function GET(req: NextRequest) {
  return withApiError(async () => {
    const user = await requireSessionUser()
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

    return okJson(body)
  })
}

export async function POST(req: NextRequest) {
  return withApiError(async () => {
    const user = await requireSessionUser()
    const body = await parseJsonObject(req)
    const invoice = await createInvoice(user, body)
    return NextResponse.json(invoice, { status: 201 })
  })
}
