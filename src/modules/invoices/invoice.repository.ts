import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { PaginationInput } from '@/modules/shared/pagination'

export const invoiceReadSelect = {
  id: true,
  companyId: true,
  createdById: true,
  clientId: true,
  campaignId: true,
  briefId: true,
  invoiceNumber: true,
  clientName: true,
  clientEmail: true,
  clientAddress: true,
  status: true,
  currency: true,
  locale: true,
  issueDate: true,
  dueDate: true,
  sentAt: true,
  paidAt: true,
  notes: true,
  taxRate: true,
  subtotal: true,
  taxTotal: true,
  total: true,
  createdAt: true,
  updatedAt: true,
  company: { select: { id: true, name: true, country: true, registrationNumber: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  client: { select: { id: true, companyName: true, contactPerson: true, email: true, address: true, avatarUrl: true } },
  campaign: { select: { id: true, title: true } },
  brief: { select: { id: true, title: true, projectId: true } },
  items: {
    select: {
      id: true,
      invoiceId: true,
      deliverableId: true,
      description: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.InvoiceSelect

export type InvoiceReadModel = Prisma.InvoiceGetPayload<{ select: typeof invoiceReadSelect }>

export function markOverdueInvoices(companyId: string) {
  return prisma.invoice.updateMany({
    where: {
      companyId,
      status: 'sent',
      dueDate: { lt: new Date() },
    },
    data: { status: 'overdue' },
  })
}

export function countInvoicesByPrefix(companyId: string, prefix: string) {
  return prisma.invoice.count({
    where: {
      companyId,
      invoiceNumber: { startsWith: prefix },
    },
  })
}

export function findInvoiceForCompany(id: string, companyId: string) {
  return prisma.invoice.findFirst({
    where: { id, companyId },
    select: invoiceReadSelect,
  })
}

export function listInvoices(input: { where: Prisma.InvoiceWhereInput; pagination: PaginationInput }) {
  return prisma.$transaction([
    prisma.invoice.findMany({
      where: input.where,
      select: invoiceReadSelect,
      orderBy: { createdAt: 'desc' },
      skip: input.pagination.skip,
      take: input.pagination.pageSize,
    }),
    prisma.invoice.count({ where: input.where }),
    prisma.invoice.aggregate({
      where: { companyId: input.where.companyId as string },
      _sum: { total: true },
      _count: { id: true },
    }),
  ])
}

export function getInvoiceLinkTargets(input: { companyId: string; campaignId?: string | null; briefId?: string | null }) {
  return Promise.all([
    input.campaignId
      ? prisma.project.findFirst({
          where: { id: input.campaignId, companyId: input.companyId },
          select: { id: true, title: true, clientId: true },
        })
      : Promise.resolve(null),
    input.briefId
      ? prisma.task.findFirst({
          where: { id: input.briefId, project: { companyId: input.companyId } },
          select: { id: true, title: true, projectId: true, project: { select: { clientId: true } } },
        })
      : Promise.resolve(null),
  ])
}

export { prisma as invoiceRepositoryPrisma }
