import { prisma } from '@/lib/db'
import { deleteClientGraph } from '@/lib/delete-graph'
import { serializeInvoice } from '@/lib/invoices'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import { badRequest, forbidden, notFound } from '@/modules/shared/errors'
import { offsetPaginationMeta } from '@/lib/pagination'
import { clientCreateSchema, clientPatchSchema, type ClientCreateInput, type ClientPatchInput } from '@/modules/clients/validation'
import { canManageClients } from '@/modules/clients/policy'
import { createClientForCompany, listClientsForCompany, logClientActivity } from '@/modules/clients/repository'

export {
  cleanText,
  getClientDisplayName,
  normalizeClientStatus,
  nullableText,
  serializeDate,
} from '@/lib/clients'

import {
  cleanText,
  normalizeClientStatus,
  nullableText,
  serializeClient,
  type BillingSessionUser,
} from '@/lib/clients'

function requireClientCompany(user: BillingSessionUser) {
  if (!user.companyId) throw badRequest('No company found for this account')
  return user.companyId
}

function assertClientAccess(user: BillingSessionUser) {
  if (!canManageClients(user)) throw forbidden()
}

export async function listClients(
  user: BillingSessionUser,
  filters: { query?: string | null; status?: string | null },
  pagination: { page: number; pageSize: number; skip: number }
) {
  if (!user.companyId) {
    return {
      items: [],
      pagination: offsetPaginationMeta({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: 0,
      }),
      summary: {
        activeCount: 0,
        inactiveCount: 0,
        unpaidTotal: 0,
      },
    }
  }

  const companyId = user.companyId
  assertClientAccess(user)

  const result = await listClientsForCompany({
    companyId,
    pageSize: pagination.pageSize,
    query: cleanText(filters.query),
    skip: pagination.skip,
    status: filters.status,
  })

  return {
    items: result.clients.map((client) => ({
      ...serializeClient(client),
      invoices: undefined,
      unpaidTotal: client.invoices.reduce((sum, invoice) => sum + Number(invoice.total), 0),
    })),
    pagination: offsetPaginationMeta({
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: result.total,
    }),
    summary: {
      activeCount: result.activeCount,
      inactiveCount: result.inactiveCount,
      unpaidTotal: result.unpaidTotal,
    },
  }
}

export async function createClient(user: BillingSessionUser, rawInput: unknown) {
  const companyId = requireClientCompany(user)
  assertClientAccess(user)

  const input: ClientCreateInput = clientCreateSchema.parse(rawInput)
  const companyName = cleanText(input.companyName)
  if (!companyName) throw badRequest('Company name is required.')

  const client = await createClientForCompany({
    address: nullableText(input.address),
    avatarUrl: nullableText(input.avatarUrl),
    companyId,
    companyName,
    contactPerson: nullableText(input.contactPerson),
    country: nullableText(input.country),
    email: nullableText(input.email)?.toLowerCase() ?? null,
    notes: nullableText(input.notes),
    phone: nullableText(input.phone),
    status: normalizeClientStatus(input.status),
    userId: user.id,
  })

  const serialized = { ...serializeClient(client), unpaidTotal: 0 }
  emitCompanyRealtime(companyId, 'client_created', { client: serialized })
  await logClientActivity({
    actorId: user.id,
    body: 'Projects, deliverables, invoices, and notes can now be tracked from this profile.',
    clientId: client.id,
    companyId,
    title: 'Client profile is ready',
    type: 'client.profile_ready',
  })

  return serialized
}

async function authorizeClient(user: BillingSessionUser, id: string) {
  const companyId = requireClientCompany(user)
  assertClientAccess(user)
  const existing = await prisma.client.findFirst({ where: { id, companyId } })
  if (!existing) throw notFound('Client not found.')
  return { companyId, existing }
}

export async function getClientDetail(user: BillingSessionUser, id: string) {
  const { companyId } = await authorizeClient(user, id)

  const client = await prisma.client.findFirst({
    where: { id, companyId },
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
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { projects: true, invoices: true } },
    },
  })

  if (!client) throw notFound('Client not found.')

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
      where: { companyId, clientId: id },
      select: { id: true, tasks: { select: { id: true, stage: true } } },
    }),
    prisma.invoice.aggregate({
      where: { companyId, clientId: id, status: { in: ['sent', 'overdue'] } },
      _sum: { total: true },
      _count: { id: true },
    }),
  ])

  const activeProjects = allProjectStats.filter((project) => project.tasks.some((task) => task.stage !== 'DONE')).length
  const completedProjects = allProjectStats.filter(
    (project) => project.tasks.length > 0 && project.tasks.every((task) => task.stage === 'DONE')
  ).length

  return {
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
  }
}

export async function updateClient(user: BillingSessionUser, id: string, rawInput: unknown) {
  const { companyId } = await authorizeClient(user, id)
  const body: ClientPatchInput = clientPatchSchema.parse(rawInput)

  const companyName = body.companyName === undefined ? undefined : cleanText(body.companyName)
  if (body.companyName !== undefined && !companyName) throw badRequest('Company name is required.')

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
    include: { _count: { select: { projects: true, invoices: true } } },
  })

  await logClientActivity({
    companyId,
    clientId: id,
    actorId: user.id,
    type: 'client.updated',
    title: 'Client profile updated',
  })

  const serialized = serializeClient(client)
  emitCompanyRealtime(companyId, 'client_updated', { client: serialized })
  return serialized
}

export async function deleteClient(user: BillingSessionUser, id: string) {
  const { companyId } = await authorizeClient(user, id)
  await prisma.$transaction((tx) => deleteClientGraph(tx, id))
  emitCompanyRealtime(companyId, 'client_deleted', { clientId: id })
  return { ok: true }
}
