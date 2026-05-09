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

type InvoiceBody = {
  clientId?: string
  campaignId?: string
  briefId?: string
  clientName?: string
  clientEmail?: string
  clientAddress?: string
  status?: string
  currency?: string
  locale?: string
  issueDate?: string
  dueDate?: string
  notes?: string
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

async function markOverdueInvoices(companyId: string) {
  await prisma.invoice.updateMany({
    where: {
      companyId,
      status: 'sent',
      dueDate: { lt: new Date() },
    },
    data: { status: 'overdue' },
  })
}

async function nextInvoiceNumber(companyId: string) {
  const year = new Date().getFullYear()
  const count = await prisma.invoice.count({
    where: {
      companyId,
      invoiceNumber: { startsWith: `INV-${year}-` },
    },
  })

  return `INV-${year}-${String(count + 1).padStart(4, '0')}`
}

function buildStatusDates(status: InvoiceStatus) {
  const now = new Date()
  return {
    sentAt: status === 'sent' || status === 'overdue' ? now : null,
    paidAt: status === 'paid' ? now : null,
  }
}

function parsePagination(req: NextRequest) {
  const page = Math.max(Number(req.nextUrl.searchParams.get('page') ?? 1) || 1, 1)
  const pageSize = Math.min(Math.max(Number(req.nextUrl.searchParams.get('pageSize') ?? 30) || 30, 1), 100)
  return { page, pageSize, skip: (page - 1) * pageSize }
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

  const campaignId = campaign?.id ?? brief?.projectId ?? null
  const clientId = client?.id ?? campaign?.clientId ?? brief?.project.clientId ?? null

  return { client, campaignId, briefId: brief?.id ?? null, clientId }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (!user.companyId) return NextResponse.json([], { headers: NO_STORE_HEADERS })
  if (!canManageInvoices(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const status = req.nextUrl.searchParams.get('status')
  const query = cleanText(req.nextUrl.searchParams.get('q'))
  const clientId = cleanText(req.nextUrl.searchParams.get('clientId'))
  const campaignId = cleanText(req.nextUrl.searchParams.get('campaignId'))
  const briefId = cleanText(req.nextUrl.searchParams.get('briefId'))
  const { page, pageSize, skip } = parsePagination(req)
  await markOverdueInvoices(user.companyId)

  const where = {
    companyId: user.companyId,
    ...(status && isInvoiceStatus(status) ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(campaignId ? { campaignId } : {}),
    ...(briefId ? { briefId } : {}),
    ...(query
      ? {
          OR: [
            { invoiceNumber: { contains: query, mode: 'insensitive' as const } },
            { clientName: { contains: query, mode: 'insensitive' as const } },
            { clientEmail: { contains: query, mode: 'insensitive' as const } },
            { client: { companyName: { contains: query, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }

  const [invoices, total, summary] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      include: invoiceInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({
      where: { companyId: user.companyId },
      _sum: { total: true },
      _count: { id: true },
    }),
  ])

  return NextResponse.json(
    {
      items: invoices.map(serializeInvoice),
      pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
      summary: { total: Number(summary._sum.total ?? 0), count: summary._count.id },
    },
    { headers: NO_STORE_HEADERS }
  )
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  if (!canManageInvoices(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json()) as InvoiceBody
  const status = isInvoiceStatus(body.status) ? body.status : 'draft'
  const rawItems = Array.isArray(body.items) ? body.items : []
  const totals = calculateInvoiceTotals(rawItems, body.taxRate)
  const links = await resolveInvoiceLinks({
    companyId: user.companyId,
    clientId: body.clientId,
    campaignId: body.campaignId,
    briefId: body.briefId,
  }).catch((error) => error as Error)
  if (links instanceof Error) return NextResponse.json({ error: links.message }, { status: 400 })

  const clientName = links.client?.companyName ?? body.clientName?.trim()

  if (!clientName) return NextResponse.json({ error: 'Client name is required.' }, { status: 400 })
  if (totals.items.length === 0) return NextResponse.json({ error: 'Add at least one invoice item.' }, { status: 400 })

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const invoiceNumber = await nextInvoiceNumber(user.companyId)
      const invoice = await prisma.invoice.create({
        data: {
          companyId: user.companyId,
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
          issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
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
        include: invoiceInclude,
      })

      const serialized = serializeInvoice(invoice)
      emitCompanyRealtime(user.companyId, 'invoice_created', { invoice: serialized })
      await logClientActivity({
        companyId: user.companyId,
        clientId: invoice.clientId,
        actorId: user.id,
        type: 'invoice.created',
        title: `Invoice ${invoice.invoiceNumber} created`,
        metadata: { invoiceId: invoice.id, total: Number(invoice.total), status: invoice.status },
      })
      return NextResponse.json(serialized, { status: 201 })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        continue
      }

      console.error(error)
      return NextResponse.json({ error: 'Unable to create invoice.' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unable to allocate invoice number. Please try again.' }, { status: 409 })
}
