import { Prisma } from '@prisma/client'
import { cleanText, findClientForCompany } from '@/lib/clients'
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
import { publishDomainEvent } from '@/modules/events/event-bus'
import { registerEnterpriseEventListeners } from '@/modules/events/listeners'
import { canManageFinance } from '@/modules/permissions/permissions'
import { badRequest, forbidden, notFound } from '@/modules/shared/errors'
import type { PaginationInput } from '@/modules/shared/pagination'
import type { SessionUser } from '@/modules/shared/session'
import {
  countInvoicesByPrefix,
  findInvoiceForCompany,
  getInvoiceLinkTargets,
  invoiceReadSelect,
  invoiceRepositoryPrisma as prisma,
  listInvoices as listInvoiceRows,
  markOverdueInvoices,
  type InvoiceReadModel,
} from '@/modules/invoices/invoice.repository'
import {
  createInvoiceSchema,
  deleteInvoiceSchema,
  updateInvoiceSchema,
  type CreateInvoiceInput,
  type DeleteInvoiceInput,
  type UpdateInvoiceInput,
} from '@/modules/invoices/invoice.validation'

registerEnterpriseEventListeners()

type InvoiceListFilters = {
  status?: string | null
  query?: string | null
  clientId?: string | null
  campaignId?: string | null
  briefId?: string | null
}

function requireCompany(user: SessionUser) {
  if (!user.companyId) throw badRequest('No company found for this account')
  return user.companyId
}

function assertFinanceAccess(user: SessionUser) {
  if (!canManageFinance(user)) throw forbidden()
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest('Invalid date value.')
  return date
}

async function nextInvoiceNumber(companyId: string) {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`
  const count = await countInvoicesByPrefix(companyId, prefix)
  return `${prefix}${String(count + 1).padStart(4, '0')}`
}

function buildStatusDates(status: InvoiceStatus) {
  const now = new Date()
  return {
    sentAt: status === 'sent' || status === 'overdue' ? now : null,
    paidAt: status === 'paid' ? now : null,
  }
}

function statusDatePatch(status: InvoiceStatus | undefined, previousStatus: string) {
  if (!status) return {}
  const now = new Date()
  return {
    sentAt: (status === 'sent' || status === 'overdue') && previousStatus === 'draft' ? now : undefined,
    paidAt: status === 'paid' ? now : status === 'draft' || status === 'sent' || status === 'overdue' ? null : undefined,
  }
}

async function resolveInvoiceLinks(input: {
  companyId: string
  clientId?: string | null
  campaignId?: string | null
  briefId?: string | null
}) {
  const [client, [campaign, brief]] = await Promise.all([
    findClientForCompany(input.clientId, input.companyId),
    getInvoiceLinkTargets(input),
  ])

  if (input.clientId && !client) throw badRequest('Selected client was not found in this workspace.')
  if (input.campaignId && !campaign) throw badRequest('Selected campaign was not found in this workspace.')
  if (input.briefId && !brief) throw badRequest('Selected brief was not found in this workspace.')
  if (campaign && brief && brief.projectId !== campaign.id) throw badRequest('Selected brief does not belong to the selected campaign.')

  return {
    client,
    campaignId: campaign?.id ?? brief?.projectId ?? null,
    briefId: brief?.id ?? null,
    clientId: client?.id ?? campaign?.clientId ?? brief?.project.clientId ?? null,
  }
}

function buildInvoiceWhere(companyId: string, filters: InvoiceListFilters): Prisma.InvoiceWhereInput {
  const status = filters.status
  const query = cleanText(filters.query)
  const clientId = cleanText(filters.clientId)
  const campaignId = cleanText(filters.campaignId)
  const briefId = cleanText(filters.briefId)

  return {
    companyId,
    ...(status && isInvoiceStatus(status) ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(campaignId ? { campaignId } : {}),
    ...(briefId ? { briefId } : {}),
    ...(query
      ? {
          OR: [
            { invoiceNumber: { contains: query, mode: 'insensitive' } },
            { clientName: { contains: query, mode: 'insensitive' } },
            { clientEmail: { contains: query, mode: 'insensitive' } },
            { client: { companyName: { contains: query, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }
}

export async function listInvoices(user: SessionUser, filters: InvoiceListFilters, pagination: PaginationInput) {
  const companyId = requireCompany(user)
  assertFinanceAccess(user)
  await markOverdueInvoices(companyId)

  const where = buildInvoiceWhere(companyId, filters)
  const [invoices, total, summary] = await listInvoiceRows({ where, pagination })

  return {
    items: invoices.map(serializeInvoice),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      pageCount: Math.ceil(total / pagination.pageSize),
    },
    summary: { total: Number(summary._sum.total ?? 0), count: summary._count.id },
  }
}

export async function getInvoice(user: SessionUser, id: string) {
  const companyId = requireCompany(user)
  assertFinanceAccess(user)
  const invoice = await findInvoiceForCompany(id, companyId)
  if (!invoice) throw notFound('Invoice not found.')
  return serializeInvoice(invoice)
}

function normalizeCreateInput(rawInput: unknown): CreateInvoiceInput {
  return createInvoiceSchema.parse(rawInput)
}

export async function createInvoice(user: SessionUser, rawInput: unknown) {
  const companyId = requireCompany(user)
  assertFinanceAccess(user)
  const body = normalizeCreateInput(rawInput)
  const status = isInvoiceStatus(body.status) ? body.status : 'draft'
  const totals = calculateInvoiceTotals(body.items as InvoiceItemInput[], body.taxRate)
  const links = await resolveInvoiceLinks({
    companyId,
    clientId: body.clientId,
    campaignId: body.campaignId,
    briefId: body.briefId,
  })
  const clientName = links.client?.companyName ?? body.clientName?.trim()

  if (!clientName) throw badRequest('Client name is required.')
  if (totals.items.length === 0) throw badRequest('Add at least one invoice item.')

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const invoiceNumber = await nextInvoiceNumber(companyId)
      const invoice = await prisma.invoice.create({
        data: {
          companyId,
          createdById: user.id,
          clientId: links.clientId,
          campaignId: links.campaignId,
          briefId: links.briefId,
          invoiceNumber,
          clientName,
          clientEmail: body.clientEmail?.trim() || links.client?.email || null,
          clientAddress: body.clientAddress?.trim() || links.client?.address || null,
          status,
          currency: normalizeCurrency(body.currency),
          locale: normalizeInvoiceLocale(body.locale),
          issueDate: parseDate(body.issueDate) ?? new Date(),
          dueDate: parseDate(body.dueDate),
          notes: body.notes?.trim() || null,
          taxRate: new Prisma.Decimal(totals.taxRate.toFixed(2)),
          subtotal: centsToDecimal(totals.subtotalCents),
          taxTotal: centsToDecimal(totals.taxTotalCents),
          total: centsToDecimal(totals.totalCents),
          ...buildStatusDates(status),
          items: {
            create: totals.items.map((item) => ({
              description: item.description,
              quantity: new Prisma.Decimal(item.quantity.toFixed(2)),
              unitPrice: centsToDecimal(item.unitPriceCents),
              lineTotal: centsToDecimal(item.lineTotalCents),
            })),
          },
        },
        select: invoiceReadSelect,
      })

      const serialized = serializeInvoice(invoice)
      await publishDomainEvent({
        type: 'invoice.created',
        companyId,
        actorId: user.id,
        entityType: 'invoice',
        entityId: invoice.id,
        action: `Invoice ${invoice.invoiceNumber} created`,
        payload: { invoice: serialized },
        after: serialized,
      })
      if (status === 'paid') {
        await publishDomainEvent({
          type: 'invoice.paid',
          companyId,
          actorId: user.id,
          entityType: 'invoice',
          entityId: invoice.id,
          action: `Invoice ${invoice.invoiceNumber} marked paid`,
          payload: { invoice: serialized },
          after: serialized,
        })
      }
      return serialized
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue
      throw error
    }
  }

  throw badRequest('Unable to allocate invoice number. Please try again.')
}

export async function updateInvoice(user: SessionUser, id: string, rawInput: unknown) {
  const companyId = requireCompany(user)
  assertFinanceAccess(user)
  const existing = await findInvoiceForCompany(id, companyId)
  if (!existing) throw notFound('Invoice not found.')

  const body: UpdateInvoiceInput = updateInvoiceSchema.parse(rawInput)
  const status = body.status === undefined ? undefined : isInvoiceStatus(body.status) ? body.status : existing.status
  const updateItems = Array.isArray(body.items)
  const totals = updateItems ? calculateInvoiceTotals(body.items as InvoiceItemInput[], body.taxRate ?? existing.taxRate) : null
  const updatesLinks = body.clientId !== undefined || body.campaignId !== undefined || body.briefId !== undefined
  const nextClientId = body.clientId === undefined ? existing.clientId : cleanText(body.clientId) || null
  const nextCampaignId = body.campaignId === undefined ? existing.campaignId : cleanText(body.campaignId) || null
  const nextBriefId = body.briefId === undefined ? existing.briefId : cleanText(body.briefId) || null
  const links = updatesLinks
    ? await resolveInvoiceLinks({ companyId, clientId: nextClientId, campaignId: nextCampaignId, briefId: nextBriefId })
    : null

  if (body.clientName !== undefined && !body.clientName.trim()) throw badRequest('Client name is required.')
  if (totals && totals.items.length === 0) throw badRequest('Add at least one invoice item.')

  const invoice = await prisma.$transaction(async (tx) => {
    if (totals) await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })

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
        issueDate: parseDate(body.issueDate) ?? undefined,
        dueDate: body.dueDate === undefined ? undefined : parseDate(body.dueDate),
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
      select: invoiceReadSelect,
    })
  })

  const serialized = serializeInvoice(invoice)
  await publishDomainEvent({
    type: status === 'paid' && existing.status !== 'paid' ? 'invoice.paid' : 'invoice.updated',
    companyId,
    actorId: user.id,
    entityType: 'invoice',
    entityId: invoice.id,
    action: status && status !== existing.status ? `Invoice ${invoice.invoiceNumber} marked ${status}` : `Invoice ${invoice.invoiceNumber} updated`,
    payload: { invoice: serialized },
    before: serializeInvoice(existing),
    after: serialized,
  })
  return serialized
}

function hasDeleteConfirmation(body: DeleteInvoiceInput) {
  return typeof body.confirmation === 'string' && body.confirmation.trim().toLowerCase() === 'delete'
}

export async function deleteInvoice(user: SessionUser, id: string, rawInput: unknown) {
  const companyId = requireCompany(user)
  assertFinanceAccess(user)
  const body = deleteInvoiceSchema.parse(rawInput)
  if (!hasDeleteConfirmation(body)) throw badRequest('Type delete to confirm invoice deletion.')

  const existing = await findInvoiceForCompany(id, companyId)
  if (!existing) throw notFound('Invoice not found.')

  await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })
    await tx.invoice.delete({ where: { id } })
  })

  const serialized = serializeInvoice(existing as InvoiceReadModel)
  await publishDomainEvent({
    type: 'invoice.deleted',
    companyId,
    actorId: user.id,
    entityType: 'invoice',
    entityId: id,
    action: `Invoice ${existing.invoiceNumber} deleted`,
    payload: { invoiceId: id, invoice: serialized },
    before: serialized,
  })

  return { ok: true }
}
