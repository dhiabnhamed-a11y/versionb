import { NextRequest } from 'next/server'
import { deleteInvoice, getInvoice, updateInvoice } from '@/modules/invoices/invoice.service'
import { okJson, parseJsonObject, withApiError } from '@/modules/shared/api'
import { requireSessionUser } from '@/modules/shared/session'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiError(async () => {
    const user = await requireSessionUser()
    const { id } = await context.params
    const invoice = await getInvoice(user, id)
    return okJson(invoice)
  })
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiError(async () => {
    const user = await requireSessionUser()
    const { id } = await context.params
    const body = await parseJsonObject(req)
    const invoice = await updateInvoice(user, id, body)
    return okJson(invoice)
  })
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiError(async () => {
    const user = await requireSessionUser()
    const { id } = await context.params
    const body = await parseJsonObject(req)
    const result = await deleteInvoice(user, id, body)
    return okJson(result)
  })
}
