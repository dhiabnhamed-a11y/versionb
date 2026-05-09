import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NO_STORE_HEADERS } from '@/lib/http'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import { serializeInvoice } from '@/lib/invoices'
import {
  canManageClients,
  cleanText,
  logClientActivity,
  normalizeClientStatus,
  nullableText,
  serializeClient,
  type BillingSessionUser,
} from '@/lib/clients'

type ClientPatchBody = {
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

async function authorizeClient(user: BillingSessionUser, id: string) {
  if (!user.companyId) return null
  return prisma.client.findFirst({
    where: { id, companyId: user.companyId },
  })
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as BillingSessionUser
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  if (!canManageClients(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await context.params
  const client = await prisma.client.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      projects: {
        orderBy: { updatedAt: 'desc' },
        take: 12,
        select: {
          id: true,
          title: true,
          description: true,
          clientName: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true } },
          tasks: { select: { id: true, stage: true } },
        },
      },
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          currency: true,
          issueDate: true,
          dueDate: true,
          subtotal: true,
          taxRate: true,
          taxTotal: true,
          total: true,
          createdAt: true,
          campaign: { select: { id: true, title: true } },
          brief: { select: { id: true, title: true } },
        },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
      },
      _count: {
        select: {
          projects: true,
          invoices: true,
        },
      },
    },
  })

  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })

  const projectIds = client.projects.map((project) => project.id)
  const [recentDeliverables, allProjectStats, invoiceStats] = await Promise.all([
    projectIds.length
      ? prisma.projectMedia.findMany({
          where: { projectId: { in: projectIds } },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            projectId: true,
            url: true,
            thumbnailUrl: true,
            playbackUrl: true,
            type: true,
            originalFilename: true,
            createdAt: true,
            uploadedBy: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),
    prisma.project.findMany({
      where: { companyId: user.companyId, clientId: id },
      select: {
        id: true,
        tasks: { select: { id: true, stage: true } },
      },
    }),
    prisma.invoice.aggregate({
      where: {
        companyId: user.companyId,
        clientId: id,
        status: { in: ['sent', 'overdue'] },
      },
      _sum: { total: true },
      _count: { id: true },
    }),
  ])

  const activeProjects = allProjectStats.filter((project) => project.tasks.some((task) => task.stage !== 'DONE')).length
  const completedProjects = allProjectStats.filter((project) => project.tasks.length > 0 && project.tasks.every((task) => task.stage === 'DONE')).length

  return NextResponse.json(
    {
      client: {
        ...serializeClient(client),
        projects: client.projects.map((project) => ({
          ...project,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        })),
        invoices: client.invoices.map(serializeInvoice),
        activities: client.activities.map((activity) => ({
          ...activity,
          createdAt: activity.createdAt.toISOString(),
        })),
      },
      stats: {
        activeProjects,
        completedProjects,
        unpaidInvoiceCount: invoiceStats._count.id,
        unpaidTotal: Number(invoiceStats._sum.total ?? 0),
      },
      recentDeliverables: recentDeliverables.map((deliverable) => ({
        ...deliverable,
        createdAt: deliverable.createdAt.toISOString(),
      })),
    },
    { headers: NO_STORE_HEADERS }
  )
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as BillingSessionUser
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  if (!canManageClients(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await context.params
  const existing = await authorizeClient(user, id)
  if (!existing) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as ClientPatchBody
  const companyName = body.companyName === undefined ? undefined : cleanText(body.companyName)
  if (body.companyName !== undefined && !companyName) {
    return NextResponse.json({ error: 'Company name is required.' }, { status: 400 })
  }

  const client = await prisma.client.update({
    where: { id },
    data: {
      companyName,
      contactPerson: body.contactPerson === undefined ? undefined : nullableText(body.contactPerson),
      email: body.email === undefined ? undefined : nullableText(body.email)?.toLowerCase() ?? null,
      phone: body.phone === undefined ? undefined : nullableText(body.phone),
      country: body.country === undefined ? undefined : nullableText(body.country),
      address: body.address === undefined ? undefined : nullableText(body.address),
      notes: body.notes === undefined ? undefined : nullableText(body.notes),
      avatarUrl: body.avatarUrl === undefined ? undefined : nullableText(body.avatarUrl),
      status: body.status === undefined ? undefined : normalizeClientStatus(body.status),
    },
    include: {
      _count: { select: { projects: true, invoices: true } },
    },
  })

  await logClientActivity({
    companyId: user.companyId,
    clientId: id,
    actorId: user.id,
    type: 'client.updated',
    title: 'Client profile updated',
  })

  const serialized = serializeClient(client)
  emitCompanyRealtime(user.companyId, 'client_updated', { client: serialized })
  return NextResponse.json(serialized)
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as BillingSessionUser
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  if (!canManageClients(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await context.params
  const existing = await authorizeClient(user, id)
  if (!existing) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })

  await prisma.client.delete({ where: { id } })
  emitCompanyRealtime(user.companyId, 'client_deleted', { clientId: id })
  return NextResponse.json({ ok: true })
}
