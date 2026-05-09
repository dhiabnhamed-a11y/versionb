import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NO_STORE_HEADERS } from '@/lib/http'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import {
  canManageClients,
  cleanText,
  logClientActivity,
  normalizeClientStatus,
  nullableText,
  serializeClient,
  type BillingSessionUser,
} from '@/lib/clients'

type ClientBody = {
  companyName?: unknown
  contactPerson?: unknown
  email?: unknown
  phone?: unknown
  country?: unknown
  address?: unknown
  notes?: unknown
  avatarUrl?: unknown
  status?: unknown
}

function parsePage(req: NextRequest) {
  const page = Math.max(Number(req.nextUrl.searchParams.get('page') ?? 1) || 1, 1)
  const pageSize = Math.min(Math.max(Number(req.nextUrl.searchParams.get('pageSize') ?? 24) || 24, 1), 100)
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as BillingSessionUser
  if (!user.companyId) return NextResponse.json({ items: [], pagination: { page: 1, pageSize: 24, total: 0, pageCount: 0 } }, { headers: NO_STORE_HEADERS })
  if (!canManageClients(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { page, pageSize, skip } = parsePage(req)
  const query = cleanText(req.nextUrl.searchParams.get('q'))
  const status = req.nextUrl.searchParams.get('status')
  const where = {
    companyId: user.companyId,
    ...(status === 'active' || status === 'inactive' ? { status } : {}),
    ...(query
      ? {
          OR: [
            { companyName: { contains: query, mode: 'insensitive' as const } },
            { contactPerson: { contains: query, mode: 'insensitive' as const } },
            { email: { contains: query, mode: 'insensitive' as const } },
            { phone: { contains: query, mode: 'insensitive' as const } },
            { country: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [clients, total, activeCount, inactiveCount, unpaidAggregate] = await prisma.$transaction([
    prisma.client.findMany({
      where,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      skip,
      take: pageSize,
      include: {
        _count: {
          select: {
            projects: true,
            invoices: true,
          },
        },
        invoices: {
          where: { status: { in: ['sent', 'overdue'] } },
          select: { total: true },
        },
      },
    }),
    prisma.client.count({ where }),
    prisma.client.count({ where: { companyId: user.companyId, status: 'active' } }),
    prisma.client.count({ where: { companyId: user.companyId, status: 'inactive' } }),
    prisma.invoice.aggregate({
      where: {
        companyId: user.companyId,
        clientId: { not: null },
        status: { in: ['sent', 'overdue'] },
      },
      _sum: { total: true },
    }),
  ])

  return NextResponse.json(
    {
      items: clients.map((client) => ({
        ...serializeClient(client),
        unpaidTotal: client.invoices.reduce((sum, invoice) => sum + Number(invoice.total), 0),
        invoices: undefined,
      })),
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
      summary: {
        activeCount,
        inactiveCount,
        unpaidTotal: Number(unpaidAggregate._sum.total ?? 0),
      },
    },
    { headers: NO_STORE_HEADERS }
  )
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as BillingSessionUser
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  if (!canManageClients(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as ClientBody
  const companyName = cleanText(body.companyName)
  if (!companyName) return NextResponse.json({ error: 'Company name is required.' }, { status: 400 })

  const client = await prisma.client.create({
    data: {
      companyId: user.companyId,
      companyName,
      contactPerson: nullableText(body.contactPerson),
      email: nullableText(body.email)?.toLowerCase() ?? null,
      phone: nullableText(body.phone),
      country: nullableText(body.country),
      address: nullableText(body.address),
      notes: nullableText(body.notes),
      avatarUrl: nullableText(body.avatarUrl),
      status: normalizeClientStatus(body.status),
      activities: {
        create: {
          companyId: user.companyId,
          actorId: user.id,
          type: 'client.created',
          title: 'Client created',
        },
      },
    },
    include: {
      _count: { select: { projects: true, invoices: true } },
    },
  })

  const serialized = { ...serializeClient(client), unpaidTotal: 0 }
  emitCompanyRealtime(user.companyId, 'client_created', { client: serialized })
  await logClientActivity({
    companyId: user.companyId,
    clientId: client.id,
    actorId: user.id,
    type: 'client.profile_ready',
    title: 'Client profile is ready',
    body: 'Projects, deliverables, invoices, and notes can now be tracked from this profile.',
  })

  return NextResponse.json(serialized, { status: 201 })
}
