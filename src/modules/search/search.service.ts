import { prisma } from '@/lib/db'
import { canManageWorkspace } from '@/modules/permissions/permissions'
import type { SessionUser } from '@/modules/shared/session'
import { searchWorkspaceIndex, type SearchResult } from '@/modules/search/search.repository'

function normalizeQuery(query: string | null | undefined) {
  return query?.trim().slice(0, 80) ?? ''
}

function dedupe(results: SearchResult[]) {
  const seen = new Set<string>()
  return results.filter((result) => {
    const key = `${result.entityType}:${result.entityId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function searchWorkspace(user: SessionUser, query: string | null | undefined, limit = 12) {
  const companyId = user.companyId
  const needle = normalizeQuery(query)
  if (!companyId || needle.length < 2) return []

  const canSeeWorkspace = canManageWorkspace(user)
  const indexed = canSeeWorkspace ? await searchWorkspaceIndex(companyId, needle, limit) : []

  const [tasks, projects, clients, invoices] = await Promise.all([
    prisma.task.findMany({
      where: {
        ...(canSeeWorkspace ? {} : { assigneeId: user.id }),
        project: { companyId },
        OR: [
          { title: { contains: needle, mode: 'insensitive' } },
          { description: { contains: needle, mode: 'insensitive' } },
          { deliverable: { title: { contains: needle, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        title: true,
        stage: true,
        projectId: true,
        project: { select: { title: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    }),
    prisma.project.findMany({
      where: {
        companyId,
        ...(canSeeWorkspace ? {} : { tasks: { some: { assigneeId: user.id } } }),
        OR: [
          { title: { contains: needle, mode: 'insensitive' } },
          { description: { contains: needle, mode: 'insensitive' } },
          { clientName: { contains: needle, mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true, clientName: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    }),
    canSeeWorkspace
      ? prisma.client.findMany({
          where: {
            companyId,
            OR: [
              { companyName: { contains: needle, mode: 'insensitive' } },
              { contactPerson: { contains: needle, mode: 'insensitive' } },
              { email: { contains: needle, mode: 'insensitive' } },
            ],
          },
          select: { id: true, companyName: true, contactPerson: true },
          orderBy: { updatedAt: 'desc' },
          take: limit,
        })
      : Promise.resolve([]),
    canSeeWorkspace
      ? prisma.invoice.findMany({
          where: {
            companyId,
            OR: [
              { invoiceNumber: { contains: needle, mode: 'insensitive' } },
              { clientName: { contains: needle, mode: 'insensitive' } },
              { clientEmail: { contains: needle, mode: 'insensitive' } },
            ],
          },
          select: { id: true, invoiceNumber: true, clientName: true, status: true },
          orderBy: { updatedAt: 'desc' },
          take: limit,
        })
      : Promise.resolve([]),
  ])

  return dedupe([
    ...indexed,
    ...tasks.map((task) => ({
      id: `task:${task.id}`,
      entityType: 'task',
      entityId: task.id,
      title: task.title,
      subtitle: `${task.project.title} - ${task.stage}`,
      href: canSeeWorkspace ? `/dashboard/admin/projects/${task.projectId}` : '/dashboard/employee',
    })),
    ...projects.map((project) => ({
      id: `project:${project.id}`,
      entityType: 'project',
      entityId: project.id,
      title: project.title,
      subtitle: project.clientName ?? 'Project',
      href: canSeeWorkspace ? `/dashboard/admin/projects/${project.id}` : '/dashboard/employee',
    })),
    ...clients.map((client) => ({
      id: `client:${client.id}`,
      entityType: 'client',
      entityId: client.id,
      title: client.companyName,
      subtitle: client.contactPerson ?? 'Client',
      href: `/dashboard/admin/clients/${client.id}`,
    })),
    ...invoices.map((invoice) => ({
      id: `invoice:${invoice.id}`,
      entityType: 'invoice',
      entityId: invoice.id,
      title: invoice.invoiceNumber,
      subtitle: `${invoice.clientName} - ${invoice.status}`,
      href: '/dashboard/admin/invoices',
    })),
  ]).slice(0, limit)
}
