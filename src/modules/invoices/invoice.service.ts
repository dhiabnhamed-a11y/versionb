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
import { createJournalEntryInTransaction } from '@/modules/accounting/accounting.service'
import { zeroDecimal } from '@/modules/accounting/money'
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

type TransactionClient = Prisma.TransactionClient

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

async function findInvoiceAccountingAccounts(tx: TransactionClient, companyId: string) {
  const accounts = await tx.account.findMany({
    where: {
      companyId,
      code: { in: ['1000', '1100', '2200', '4000'] },
      status: 'ACTIVE',
      deletedAt: null,
    },
    select: { id: true, code: true },
  })
  return new Map(accounts.map((account) => [account.code, account.id]))
}

async function hasOpenPeriodForInvoice(tx: TransactionClient, companyId: string, transactionDate: Date) {
  const period = await tx.financialPeriod.findFirst({
    where: {
      companyId,
      status: 'OPEN',
      startsAt: { lte: transactionDate },
      endsAt: { gte: transactionDate },
    },
    select: { id: true },
  })
  return Boolean(period)
}

async function journalExists(tx: TransactionClient, companyId: string, idempotencyKey: string) {
  const existing = await tx.journalEntry.findUnique({
    where: { companyId_idempotencyKey: { companyId, idempotencyKey } },
    select: { id: true },
  })
  return Boolean(existing)
}

async function createInvoiceAccountingEntries(
  tx: TransactionClient,
  invoice: InvoiceReadModel,
  previousStatus: string | null,
  actorId: string
) {
  const status = invoice.status
  const isBillable = ['sent', 'overdue', 'paid', 'partially_paid'].includes(status)
  const becameBillable = isBillable && !['sent', 'overdue', 'paid', 'partially_paid'].includes(previousStatus ?? '')
  const becamePaid = status === 'paid' && previousStatus !== 'paid'
  if (!becameBillable && !becamePaid) return

  const transactionDate = invoice.paidAt ?? invoice.sentAt ?? invoice.issueDate ?? new Date()
  const [accounts, hasPeriod] = await Promise.all([
    findInvoiceAccountingAccounts(tx, invoice.companyId),
    hasOpenPeriodForInvoice(tx, invoice.companyId, transactionDate),
  ])
  if (!hasPeriod) return

  const cashAccountId = accounts.get('1000')
  const receivableAccountId = accounts.get('1100')
  const taxLiabilityAccountId = accounts.get('2200')
  const revenueAccountId = accounts.get('4000')
  if (!receivableAccountId || !revenueAccountId) return

  if (becameBillable) {
    const idempotencyKey = `invoice:${invoice.id}:issued:v1`
    if (!(await journalExists(tx, invoice.companyId, idempotencyKey))) {
      const lines = [
        {
          accountId: receivableAccountId,
          description: `Recognize ${invoice.invoiceNumber} receivable`,
          debit: invoice.total,
          credit: zeroDecimal(),
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          projectId: invoice.campaignId,
          taskId: invoice.briefId,
          targetType: 'invoice',
          targetId: invoice.id,
        },
        {
          accountId: revenueAccountId,
          description: `Recognize ${invoice.invoiceNumber} revenue`,
          debit: zeroDecimal(),
          credit: invoice.subtotal,
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          projectId: invoice.campaignId,
          taskId: invoice.briefId,
          targetType: 'invoice_revenue',
          targetId: invoice.id,
        },
      ]
      if (invoice.taxTotal.gt(0) && taxLiabilityAccountId) {
        lines.push({
          accountId: taxLiabilityAccountId,
          description: `Recognize ${invoice.invoiceNumber} tax liability`,
          debit: zeroDecimal(),
          credit: invoice.taxTotal,
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          projectId: invoice.campaignId,
          taskId: invoice.briefId,
          targetType: 'invoice_tax',
          targetId: invoice.id,
        })
      }

      await createJournalEntryInTransaction(tx, {
        companyId: invoice.companyId,
        actorId,
        invoiceId: invoice.id,
        sourceType: 'INVOICE',
        sourceId: invoice.id,
        memo: `Invoice ${invoice.invoiceNumber} sent to ${invoice.clientName}`,
        currency: invoice.currency,
        transactionDate,
        idempotencyKey,
        requiresApproval: false,
        postNow: true,
        metadata: { invoiceNumber: invoice.invoiceNumber, accountingEvent: 'invoice_sent' },
        lines,
      })
    }
  }

  if (becamePaid && cashAccountId && receivableAccountId) {
    const idempotencyKey = `invoice:${invoice.id}:paid:v1`
    if (!(await journalExists(tx, invoice.companyId, idempotencyKey))) {
      await createJournalEntryInTransaction(tx, {
        companyId: invoice.companyId,
        actorId,
        invoiceId: invoice.id,
        sourceType: 'PAYMENT',
        sourceId: invoice.id,
        memo: `Payment received for ${invoice.invoiceNumber}`,
        currency: invoice.currency,
        transactionDate,
        idempotencyKey,
        requiresApproval: false,
        postNow: true,
        metadata: { invoiceNumber: invoice.invoiceNumber, accountingEvent: 'invoice_paid' },
        lines: [
          {
            accountId: cashAccountId,
            description: `Cash received for ${invoice.invoiceNumber}`,
            debit: invoice.total,
            credit: zeroDecimal(),
            clientId: invoice.clientId,
            invoiceId: invoice.id,
            projectId: invoice.campaignId,
            taskId: invoice.briefId,
            targetType: 'invoice_payment',
            targetId: invoice.id,
          },
          {
            accountId: receivableAccountId,
            description: `Clear receivable for ${invoice.invoiceNumber}`,
            debit: zeroDecimal(),
            credit: invoice.total,
            clientId: invoice.clientId,
            invoiceId: invoice.id,
            projectId: invoice.campaignId,
            taskId: invoice.briefId,
            targetType: 'invoice_payment',
            targetId: invoice.id,
          },
        ],
      })
    }
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
      const invoice = await prisma.$transaction(async (tx) => {
        const created = await tx.invoice.create({
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
        await createInvoiceAccountingEntries(tx, created, 'draft', user.id)
        return created
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

    const updated = await tx.invoice.update({
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
    await createInvoiceAccountingEntries(tx, updated, existing.status, user.id)
    return updated
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
