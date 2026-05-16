import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export { findClientForCompany, logClientActivity } from '@/lib/clients'

export type ClientListInput = {
  companyId: string
  pageSize: number
  query?: string
  skip: number
  status?: string | null
}

export type ClientCreateData = {
  address?: string | null
  avatarUrl?: string | null
  companyId: string
  companyName: string
  contactPerson?: string | null
  country?: string | null
  email?: string | null
  notes?: string | null
  phone?: string | null
  status: 'active' | 'inactive'
  userId: string
}

function clientListWhere(input: Pick<ClientListInput, 'companyId' | 'query' | 'status'>): Prisma.ClientWhereInput {
  return {
    companyId: input.companyId,
    ...(input.status === 'active' || input.status === 'inactive' ? { status: input.status } : {}),
    ...(input.query
      ? {
          OR: [
            { companyName: { contains: input.query, mode: 'insensitive' as const } },
            { contactPerson: { contains: input.query, mode: 'insensitive' as const } },
            { email: { contains: input.query, mode: 'insensitive' as const } },
            { phone: { contains: input.query, mode: 'insensitive' as const } },
            { country: { contains: input.query, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }
}

export async function listClientsForCompany(input: ClientListInput) {
  const where = clientListWhere(input)

  const [clients, total, activeCount, inactiveCount, unpaidAggregate] = await prisma.$transaction([
    prisma.client.findMany({
      where,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      skip: input.skip,
      take: input.pageSize,
      include: {
        _count: {
          select: {
            invoices: true,
            projects: true,
          },
        },
        invoices: {
          where: { status: { in: ['sent', 'overdue'] } },
          select: { total: true },
        },
      },
    }),
    prisma.client.count({ where }),
    prisma.client.count({ where: { companyId: input.companyId, status: 'active' } }),
    prisma.client.count({ where: { companyId: input.companyId, status: 'inactive' } }),
    prisma.invoice.aggregate({
      where: {
        clientId: { not: null },
        companyId: input.companyId,
        status: { in: ['sent', 'overdue'] },
      },
      _sum: { total: true },
    }),
  ])

  return { activeCount, clients, inactiveCount, total, unpaidTotal: Number(unpaidAggregate._sum.total ?? 0) }
}

export function createClientForCompany(input: ClientCreateData) {
  return prisma.client.create({
    data: {
      address: input.address,
      avatarUrl: input.avatarUrl,
      companyId: input.companyId,
      companyName: input.companyName,
      contactPerson: input.contactPerson,
      country: input.country,
      email: input.email,
      notes: input.notes,
      phone: input.phone,
      status: input.status,
      activities: {
        create: {
          actorId: input.userId,
          companyId: input.companyId,
          title: 'Client created',
          type: 'client.created',
        },
      },
    },
    include: {
      _count: { select: { invoices: true, projects: true } },
    },
  })
}

export const clientRepository = {
  createClientForCompany,
  listClientsForCompany,
  prisma,
}
