import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NO_STORE_HEADERS } from '@/lib/http'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import { cleanText, findClientForCompany, logClientActivity } from '@/lib/clients'
import {
  calculateInvoiceTotals,
  centsToDecimal,
  isInvoiceStatus,
  normalizeCurrency,
  normalizeInvoiceLocale,
  serializeInvoice,
  type InvoiceItemInput,
  type InvoiceStatus,
} from '@/lib/invoices'

type SessionUser = {
  id: string
  role?: string | null
  companyId?: string | null
}

type InvoicePatchBody = {
  clientId?: string | null
  campaignId?: string | null
  briefId?: string | null
  clientName?: string
  clientEmail?: string | null
  clientAddress?: string | null
  status?: string
  currency?: string
  locale?: string
  issueDate?: string
  dueDate?: string | null
  notes?: string | null
  taxRate?: number | string
  items?: InvoiceItemInput[]
}

const invoiceInclude = {
  company: { select: { id: true, name: true, country: true, registrationNumber: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  client: { select: { id: true, companyName: true, contactPerson: true, email: true, address: true, avatarUrl: true } },
  campaign: { select: { id: true, title: true } },
  brief: { select: { id: true, title: true, projectId: true } },
  items: { orderBy: { createdAt: 'asc' as const } },
} as const

function canManageInvoices(user: SessionUser) {
  return user.role === 'OWNER' || user.role === 'MANAGER'
}

function statusDatePatch(status: InvoiceStatus | undefined, previousStatus: string) {
  if (!status) return {}
  const now = new Date()

  return {
    sentAt: (status === 'sent' || status === 'overdue') && previousStatus === 'draft' ? now : undefined,
    paidAt: status === 'paid' ? now : status === 'draft' || status === 'sent' || status === 'overdue' ? null : undefined,
  }
}

async function getInvoice(id: string, companyId: string) {
  return prisma.invoice.findFirst({
    where: { id, companyId },
    include: invoiceInclude,
  })
}

async function resolveInvoiceLinks(input: {
  companyId: string
  clientId?: string | null
  campaignId?: string | null
  briefId?: string | null
}) {
  const [client, campaign, brief] = await Promise.all([
    findClientForCompany(input.clientId, input.companyId),
    input.campaignId
      ? prisma.project.findFirst({ where: { id: input.campaignId, companyId: input.companyId }, select: { id: true, title: true, clientId: true } })
      : Promise.resolve(null),
    input.briefId
      ? prisma.task.findFirst({
          where: { id: input.briefId, project: { companyId: input.companyId } },
          select: { id: true, title: true, projectId: true, project: { select: { clientId: true } } },
        })
      : Promise.resolve(null),
  ])

  if (input.clientId && !client) throw new Error('Selected client was not found in this workspace.')
  if (input.campaignId && !campaign) throw new Error('Selected campaign was not found in this workspace.')
  if (input.briefId && !brief) throw new Error('Selected brief was not found in this workspace.')
  if (campaign && brief && brief.projectId !== campaign.id) throw new Error('Selected brief does not belong to the selected campaign.')

  return {
    client,
    clientId: client?.id ?? campaign?.clientId ?? brief?.project.clientId ?? null,
    campaignId: campaign?.id ?? brief?.projectId ?? null,
    briefId: brief?.id ?? null,
  }
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  if (!canManageInvoices(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await context.params
  const invoice = await getInvoice(id, user.companyId)
  if (!invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })

  return NextResponse.json(serializeInvoice(invoice), { headers: NO_STORE_HEADERS })
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  if (!canManageInvoices(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await context.params
  const existing = await getInvoice(id, user.companyId)
  if (!existing) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })

  const body = (await req.json()) as InvoicePatchBody
  const status = body.status === undefined ? undefined : isInvoiceStatus(body.status) ? body.status : existing.status
  const updateItems = Array.isArray(body.items)
  const totals = updateItems ? calculateInvoiceTotals(body.items ?? [], body.taxRate ?? existing.taxRate) : null
  const updatesLinks = body.clientId !== undefined || body.campaignId !== undefined || body.briefId !== undefined
  const nextClientId = body.clientId === undefined ? existing.clientId : cleanText(body.clientId) || null
  const nextCampaignId = body.campaignId === undefined ? existing.campaignId : cleanText(body.campaignId) || null
  const nextBriefId = body.briefId === undefined ? existing.briefId : cleanText(body.briefId) || null
  const links = updatesLinks
    ? await resolveInvoiceLinks({
        companyId: user.companyId,
        clientId: nextClientId,
        campaignId: nextCampaignId,
        briefId: nextBriefId,
      }).catch((error) => error as Error)
    : null
  if (links instanceof Error) return NextResponse.json({ error: links.message }, { status: 400 })

  if (body.clientName !== undefined && !body.clientName.trim()) {
    return NextResponse.json({ error: 'Client name is required.' }, { status: 400 })
  }

  if (totals && totals.items.length === 0) {
    return NextResponse.json({ error: 'Add at least one invoice item.' }, { status: 400 })
  }

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      if (totals) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })
      }

      return tx.invoice.update({
        where: { id },
        data: {
          clientName: body.clientName?.trim(),
          clientId: links ? links.clientId : undefined,
          campaignId: links ? links.campaignId : undefined,
          briefId: links ? links.briefId : undefined,
          ...(links?.client && body.clientName === undefined ? { clientName: links.client.companyName } : {}),
          clientEmail: body.clientEmail === undefined ? (links?.client ? links.client.email : undefined) : body.clientEmail?.trim() || null,
          clientAddress: body.clientAddress === undefined ? (links?.client ? links.client.address : undefined) : body.clientAddress?.trim() || null,
          status,
          currency: body.currency === undefined ? undefined : normalizeCurrency(body.currency),
          locale: body.locale === undefined ? undefined : normalizeInvoiceLocale(body.locale),
          issueDate: body.issueDate ? new Date(body.issueDate) : undefined,
          dueDate: body.dueDate === undefined ? undefined : body.dueDate ? new Date(body.dueDate) : null,
          notes: body.notes === undefined ? undefined : body.notes?.trim() || null,
          ...(totals
            ? {
                taxRate: new Prisma.Decimal(totals.taxRate.toFixed(2)),
                subtotal: centsToDecimal(totals.subtotalCents),
                taxTotal: centsToDecimal(totals.taxTotalCents),
                total: centsToDecimal(totals.totalCents),
                items: {
                  create: totals.items.map((item) => ({
                    description: item.description,
                    quantity: new Prisma.Decimal(item.quantity.toFixed(2)),
                    unitPrice: centsToDecimal(item.unitPriceCents),
                    lineTotal: centsToDecimal(item.lineTotalCents),
                  })),
                },
              }
            : {}),
          ...statusDatePatch(status as InvoiceStatus | undefined, existing.status),
        },
        include: invoiceInclude,
      })
    })

    const serialized = serializeInvoice(invoice)
    emitCompanyRealtime(user.companyId, 'invoice_updated', { invoice: serialized })
    await logClientActivity({
      companyId: user.companyId,
      clientId: invoice.clientId,
      actorId: user.id,
      type: status && status !== existing.status ? `invoice.${status}` : 'invoice.updated',
      title: status && status !== existing.status ? `Invoice ${invoice.invoiceNumber} marked ${status}` : `Invoice ${invoice.invoiceNumber} updated`,
      metadata: { invoiceId: invoice.id, total: Number(invoice.total), status: invoice.status },
    })
    return NextResponse.json(serialized)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Unable to update invoice.' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  if (!canManageInvoices(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await context.params
  const existing = await getInvoice(id, user.companyId)
  if (!existing) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })
  if (existing.status === 'paid') return NextResponse.json({ error: 'Paid invoices cannot be deleted.' }, { status: 409 })

  try {
    await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })
      await tx.invoice.delete({ where: { id } })
    })
  } catch (error) {
    console.error('[invoice-delete]', error)
    return NextResponse.json(
      { error: 'Invoice could not be deleted.', detail: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }

  await logClientActivity({
    companyId: user.companyId,
    clientId: existing.clientId,
    actorId: user.id,
    type: 'invoice.deleted',
    title: `Invoice ${existing.invoiceNumber} deleted`,
    metadata: { invoiceId: id },
  })
  emitCompanyRealtime(user.companyId, 'invoice_deleted', { invoiceId: id })
  return NextResponse.json({ ok: true })
}
