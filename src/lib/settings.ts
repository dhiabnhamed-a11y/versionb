import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const SETTINGS_ADMIN_ROLES = ['OWNER', 'MANAGER'] as const
export const PUBLIC_WORKSPACE_ROLES = ['OWNER', 'MANAGER', 'WORKER'] as const

export type SettingsAdminRole = (typeof SETTINGS_ADMIN_ROLES)[number]
export type PublicWorkspaceRole = (typeof PUBLIC_WORKSPACE_ROLES)[number]
export type StoredWorkspaceRole = 'OWNER' | 'MANAGER' | 'EMPLOYEE'
export type ThemeMode = 'light' | 'dark'

export type WorkspaceThemeSettings = {
  primaryColor: string
  backgroundColor: string
  sidebarColor: string
  themeMode: ThemeMode
}

export type SettingsSessionUser = {
  id?: string
  role?: string | null
  companyId?: string | null
}

export class SettingsAccessError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'SettingsAccessError'
    this.status = status
  }
}

const DEFAULT_THEME_SETTINGS: WorkspaceThemeSettings = {
  primaryColor: '#0369a1',
  backgroundColor: '#f7f8fa',
  sidebarColor: '#ffffff',
  themeMode: 'light',
}

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

function normalizeUpper(value?: string | null) {
  return value?.trim().toUpperCase() ?? ''
}

export function canManageSettings(role?: string | null) {
  const normalizedRole = normalizeUpper(role)
  return normalizedRole === 'OWNER' || normalizedRole === 'MANAGER'
}

export function toPublicWorkspaceRole(role?: string | null): PublicWorkspaceRole {
  const normalizedRole = normalizeUpper(role)
  if (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER') return normalizedRole
  return 'WORKER'
}

export function toStoredWorkspaceRole(role?: string | null): StoredWorkspaceRole | null {
  const normalizedRole = normalizeUpper(role)
  if (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER') return normalizedRole
  if (normalizedRole === 'WORKER' || normalizedRole === 'EMPLOYEE') return 'EMPLOYEE'
  return null
}

export function roleLabel(role?: string | null) {
  const publicRole = toPublicWorkspaceRole(role)
  return publicRole === 'WORKER' ? 'Worker' : publicRole.charAt(0) + publicRole.slice(1).toLowerCase()
}

export function sanitizeThemeSettings(input: Partial<WorkspaceThemeSettings>) {
  const primaryColor = input.primaryColor?.trim()
  const backgroundColor = input.backgroundColor?.trim()
  const sidebarColor = input.sidebarColor?.trim()
  const themeMode = input.themeMode === 'dark' ? 'dark' : input.themeMode === 'light' ? 'light' : undefined

  if (primaryColor !== undefined && !HEX_COLOR_PATTERN.test(primaryColor)) {
    throw new SettingsAccessError('Primary color must be a 6-digit hex color.')
  }

  if (backgroundColor !== undefined && !HEX_COLOR_PATTERN.test(backgroundColor)) {
    throw new SettingsAccessError('Background color must be a 6-digit hex color.')
  }

  if (sidebarColor !== undefined && !HEX_COLOR_PATTERN.test(sidebarColor)) {
    throw new SettingsAccessError('Sidebar color must be a 6-digit hex color.')
  }

  if (input.themeMode !== undefined && themeMode === undefined) {
    throw new SettingsAccessError('Theme mode must be light or dark.')
  }

  return {
    ...(primaryColor !== undefined ? { primaryColor } : {}),
    ...(backgroundColor !== undefined ? { backgroundColor } : {}),
    ...(sidebarColor !== undefined ? { sidebarColor } : {}),
    ...(themeMode !== undefined ? { themeMode } : {}),
  }
}

export async function getWorkspaceThemeSettings(companyId?: string | null): Promise<WorkspaceThemeSettings> {
  if (!companyId) return DEFAULT_THEME_SETTINGS

  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: {
      primaryColor: true,
      backgroundColor: true,
      sidebarColor: true,
      themeMode: true,
    },
  })

  if (!settings) return DEFAULT_THEME_SETTINGS

  return {
    primaryColor: settings.primaryColor,
    backgroundColor: settings.backgroundColor,
    sidebarColor: settings.sidebarColor,
    themeMode: settings.themeMode === 'dark' ? 'dark' : 'light',
  }
}

type AdminActionClient = typeof prisma | Prisma.TransactionClient

export async function logAdminAction(
  client: AdminActionClient,
  input: {
    companyId: string
    actorId: string
    targetUserId?: string | null
    action: string
    metadata?: Prisma.InputJsonValue
  }
) {
  await client.adminActionLog.create({
    data: {
      companyId: input.companyId,
      actorId: input.actorId,
      targetUserId: input.targetUserId ?? null,
      action: input.action,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    },
  })
}

export async function updateWorkspaceThemeSettings(
  requester: SettingsSessionUser,
  input: Partial<WorkspaceThemeSettings>
) {
  if (!requester.id) throw new SettingsAccessError('Unauthorized', 401)
  if (!requester.companyId) throw new SettingsAccessError('No company found for this account.', 400)
  if (!canManageSettings(requester.role)) throw new SettingsAccessError('Forbidden', 403)

  const sanitized = sanitizeThemeSettings(input)
  const updated = await prisma.$transaction(async (tx) => {
    const settings = await tx.companySettings.upsert({
      where: { companyId: requester.companyId! },
      create: {
        companyId: requester.companyId!,
        ...DEFAULT_THEME_SETTINGS,
        ...sanitized,
      },
      update: sanitized,
      select: {
        primaryColor: true,
        backgroundColor: true,
        sidebarColor: true,
        themeMode: true,
      },
    })

    await logAdminAction(tx, {
      companyId: requester.companyId!,
      actorId: requester.id!,
      action: 'SETTINGS_THEME_UPDATED',
      metadata: sanitized as Prisma.InputJsonObject,
    })

    return settings
  })

  return {
    primaryColor: updated.primaryColor,
    backgroundColor: updated.backgroundColor,
    sidebarColor: updated.sidebarColor,
    themeMode: updated.themeMode === 'dark' ? 'dark' : 'light',
  }
}

function assertRoleChangeAllowed(input: {
  requesterRole: string
  currentRole: StoredWorkspaceRole
  nextRole: StoredWorkspaceRole
  remainingOwnerCount: number
}) {
  if (input.currentRole === input.nextRole) {
    throw new SettingsAccessError('That user already has this role.')
  }

  if (input.currentRole === 'OWNER' && input.nextRole !== 'OWNER' && input.remainingOwnerCount <= 1) {
    throw new SettingsAccessError('You cannot remove the last workspace owner.', 409)
  }

  if (input.requesterRole === 'OWNER') {
    return
  }

  if (input.requesterRole !== 'MANAGER') {
    throw new SettingsAccessError('Forbidden', 403)
  }

  const managerCanPromoteWorker = input.currentRole === 'EMPLOYEE' && input.nextRole === 'MANAGER'
  const managerCanDemoteManager = input.currentRole === 'MANAGER' && input.nextRole === 'EMPLOYEE'

  if (!managerCanPromoteWorker && !managerCanDemoteManager) {
    throw new SettingsAccessError('Managers can only promote workers to managers or demote managers to workers.', 403)
  }
}

export async function changeWorkspaceUserRole(input: {
  requester: SettingsSessionUser
  targetUserId: string
  nextRole: string
}) {
  const requester = input.requester
  if (!requester.id) throw new SettingsAccessError('Unauthorized', 401)
  if (!requester.companyId) throw new SettingsAccessError('No company found for this account.', 400)
  if (!canManageSettings(requester.role)) throw new SettingsAccessError('Forbidden', 403)

  const nextRole = toStoredWorkspaceRole(input.nextRole)
  if (!nextRole) {
    throw new SettingsAccessError('Role must be OWNER, MANAGER, or WORKER.')
  }

  if (input.targetUserId === requester.id) {
    throw new SettingsAccessError('No one can change their own role.', 403)
  }

  const requesterRole = toStoredWorkspaceRole(requester.role)
  if (!requesterRole || requesterRole === 'EMPLOYEE') {
    throw new SettingsAccessError('Forbidden', 403)
  }

  return prisma.$transaction(async (tx) => {
    const [targetUser, ownerCount] = await Promise.all([
      tx.user.findFirst({
        where: {
          id: input.targetUserId,
          companyId: requester.companyId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      }),
      tx.user.count({
        where: {
          companyId: requester.companyId,
          role: 'OWNER',
        },
      }),
    ])

    if (!targetUser) {
      throw new SettingsAccessError('User not found in this workspace.', 404)
    }

    const currentRole = toStoredWorkspaceRole(targetUser.role)
    if (!currentRole) {
      throw new SettingsAccessError('This user role cannot be managed from workspace settings.', 403)
    }

    assertRoleChangeAllowed({
      requesterRole,
      currentRole,
      nextRole,
      remainingOwnerCount: ownerCount,
    })

    const updatedUser = await tx.user.update({
      where: { id: targetUser.id },
      data: { role: nextRole },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })

    await logAdminAction(tx, {
      companyId: requester.companyId!,
      actorId: requester.id!,
      targetUserId: updatedUser.id,
      action: 'USER_ROLE_CHANGED',
      metadata: {
        previousRole: toPublicWorkspaceRole(currentRole),
        nextRole: toPublicWorkspaceRole(nextRole),
      },
    })

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: toPublicWorkspaceRole(updatedUser.role),
      storedRole: updatedUser.role,
    }
  })
}

export async function getSettingsTeamUsers(companyId: string, currentUserId: string) {
  const users = await prisma.user.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: toPublicWorkspaceRole(user.role),
    storedRole: user.role,
    roleLabel: roleLabel(user.role),
    isCurrentUser: user.id === currentUserId,
    joinedAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }))
}

function taskCompletionRate(done: number, total: number) {
  return total ? Math.round((done / total) * 100) : 0
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return 0
  const amount = typeof value === 'number' ? value : Number(value.toString())
  return Number.isFinite(amount) ? amount : 0
}

export async function buildWorkspaceStatsExport(companyId: string) {
  const [
    company,
    projects,
    tasks,
    team,
    taskActivities,
    adminActions,
    totalTasks,
    completedTasks,
    inProgressTasks,
    reviewTasks,
    todoTasks,
    overdueTasks,
    invoiceCurrencyGroups,
    paidInvoiceCurrencyGroups,
    outstandingInvoiceCurrencyGroups,
    invoiceStatusGroups,
    projectInvoiceGroups,
    recentInvoices,
  ] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, companyType: true },
    }),
    prisma.project.findMany({
      where: { companyId },
      select: {
        id: true,
        title: true,
        description: true,
        clientName: true,
        createdAt: true,
        updatedAt: true,
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.task.findMany({
      where: { project: { companyId } },
      select: {
        id: true,
        title: true,
        priority: true,
        deliverableType: true,
        stage: true,
        progress: true,
        deadline: true,
        createdAt: true,
        updatedAt: true,
        project: { select: { id: true, title: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        assignedTasks: {
          select: { id: true, stage: true, progress: true },
        },
        activities: {
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.activity.findMany({
      where: { task: { project: { companyId } } },
      select: {
        id: true,
        action: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, role: true } },
        task: {
          select: {
            id: true,
            title: true,
            stage: true,
            project: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.adminActionLog.findMany({
      where: { companyId },
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true, role: true } },
        targetUser: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.task.count({ where: { project: { companyId } } }),
    prisma.task.count({ where: { project: { companyId }, stage: 'DONE' } }),
    prisma.task.count({ where: { project: { companyId }, stage: 'IN_PROGRESS' } }),
    prisma.task.count({ where: { project: { companyId }, stage: 'REVIEW' } }),
    prisma.task.count({ where: { project: { companyId }, stage: 'TODO' } }),
    prisma.task.count({
      where: {
        project: { companyId },
        stage: { not: 'DONE' },
        deadline: { lt: new Date() },
      },
    }),
    prisma.invoice.groupBy({
      by: ['currency'],
      where: { companyId },
      _count: { _all: true },
      _sum: { subtotal: true, taxTotal: true, total: true },
    }),
    prisma.invoice.groupBy({
      by: ['currency'],
      where: { companyId, status: 'paid' },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.invoice.groupBy({
      by: ['currency'],
      where: { companyId, status: { in: ['sent', 'overdue'] } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.invoice.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.invoice.groupBy({
      by: ['campaignId', 'currency'],
      where: { companyId, campaignId: { not: null } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.invoice.findMany({
      where: { companyId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        currency: true,
        total: true,
        clientName: true,
        campaignId: true,
        issueDate: true,
        dueDate: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  const teamPerformance = team.map((member) => {
    const total = member.assignedTasks.length
    const done = member.assignedTasks.filter((task) => task.stage === 'DONE').length
    const averageProgress = total
      ? Math.round(member.assignedTasks.reduce((sum, task) => sum + task.progress, 0) / total)
      : 0

    return {
      id: member.id,
      name: member.name,
      email: member.email,
      role: toPublicWorkspaceRole(member.role),
      assignedTasks: total,
      completedTasks: done,
      completionRate: taskCompletionRate(done, total),
      averageProgress,
      activityCount: member.activities.length,
    }
  })
  const projectRevenue = new Map<string, Array<{ currency: string; invoiceCount: number; total: number }>>()
  for (const group of projectInvoiceGroups) {
    if (!group.campaignId) continue
    const rows = projectRevenue.get(group.campaignId) ?? []
    rows.push({
      currency: group.currency,
      invoiceCount: group._count._all,
      total: decimalToNumber(group._sum.total),
    })
    projectRevenue.set(group.campaignId, rows)
  }

  const moneyByCurrency = invoiceCurrencyGroups.map((group) => ({
    currency: group.currency,
    invoiceCount: group._count._all,
    subtotal: decimalToNumber(group._sum.subtotal),
    taxTotal: decimalToNumber(group._sum.taxTotal),
    total: decimalToNumber(group._sum.total),
    paidTotal: decimalToNumber(paidInvoiceCurrencyGroups.find((paid) => paid.currency === group.currency)?._sum.total),
    outstandingTotal: decimalToNumber(outstandingInvoiceCurrencyGroups.find((open) => open.currency === group.currency)?._sum.total),
  }))

  return {
    exportedAt: new Date().toISOString(),
    workspace: company,
    summary: {
      totalProjects: projects.length,
      totalTasks,
      completedTasks,
      inProgressTasks,
      reviewTasks,
      todoTasks,
      overdueTasks,
      completionRate: taskCompletionRate(completedTasks, totalTasks),
    },
    billing: {
      invoiceCount: invoiceCurrencyGroups.reduce((sum, group) => sum + group._count._all, 0),
      paidInvoiceCount: paidInvoiceCurrencyGroups.reduce((sum, group) => sum + group._count._all, 0),
      outstandingInvoiceCount: outstandingInvoiceCurrencyGroups.reduce((sum, group) => sum + group._count._all, 0),
      byCurrency: moneyByCurrency,
      byStatus: invoiceStatusGroups.map((group) => ({
        status: group.status,
        invoiceCount: group._count._all,
        total: decimalToNumber(group._sum.total),
      })),
      recentInvoices: recentInvoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        currency: invoice.currency,
        total: decimalToNumber(invoice.total),
        clientName: invoice.clientName,
        campaignId: invoice.campaignId,
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate?.toISOString() ?? null,
      })),
    },
    projects: projects.map((project) => ({
      id: project.id,
      title: project.title,
      description: project.description,
      clientName: project.clientName,
      manager: project.manager,
      taskCount: project._count.tasks,
      revenueByCurrency: projectRevenue.get(project.id) ?? [],
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      deliverableType: task.deliverableType,
      stage: task.stage,
      progress: task.progress,
      deadline: task.deadline?.toISOString() ?? null,
      project: task.project,
      assignee: task.assignee,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
    completionRates: {
      workspace: taskCompletionRate(completedTasks, totalTasks),
      byTeamMember: teamPerformance.map((member) => ({
        id: member.id,
        name: member.name,
        completionRate: member.completionRate,
      })),
    },
    teamPerformance,
    activityLogs: {
      taskActivity: taskActivities.map((activity) => ({
        id: activity.id,
        action: activity.action,
        createdAt: activity.createdAt.toISOString(),
        user: {
          ...activity.user,
          role: toPublicWorkspaceRole(activity.user.role),
        },
        task: activity.task,
      })),
      adminActions: adminActions.map((action) => ({
        id: action.id,
        action: action.action,
        metadata: action.metadata,
        createdAt: action.createdAt.toISOString(),
        actor: {
          ...action.actor,
          role: toPublicWorkspaceRole(action.actor.role),
        },
        targetUser: action.targetUser
          ? {
              ...action.targetUser,
              role: toPublicWorkspaceRole(action.targetUser.role),
            }
          : null,
      })),
    },
  }
}

function csvValue(value: unknown) {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function csvRows(headers: string[], rows: unknown[][]) {
  return [headers.map(csvValue).join(','), ...rows.map((row) => row.map(csvValue).join(','))].join('\n')
}

export function buildStatsCsv(exportData: Awaited<ReturnType<typeof buildWorkspaceStatsExport>>) {
  const sections = [
    '# Summary',
    csvRows(
      ['Total projects', 'Total tasks', 'Completed tasks', 'In progress', 'Review', 'To do', 'Overdue', 'Completion rate', 'Invoices', 'Paid invoices', 'Outstanding invoices'],
      [
        [
          exportData.summary.totalProjects,
          exportData.summary.totalTasks,
          exportData.summary.completedTasks,
          exportData.summary.inProgressTasks,
          exportData.summary.reviewTasks,
          exportData.summary.todoTasks,
          exportData.summary.overdueTasks,
          `${exportData.summary.completionRate}%`,
          exportData.billing.invoiceCount,
          exportData.billing.paidInvoiceCount,
          exportData.billing.outstandingInvoiceCount,
        ],
      ]
    ),
    '# Billing',
    csvRows(
      ['Currency', 'Invoices', 'Subtotal', 'Tax total', 'Total', 'Paid total', 'Outstanding total'],
      exportData.billing.byCurrency.map((money) => [
        money.currency,
        money.invoiceCount,
        money.subtotal,
        money.taxTotal,
        money.total,
        money.paidTotal,
        money.outstandingTotal,
      ])
    ),
    '# Projects',
    csvRows(
      ['ID', 'Title', 'Client', 'Manager', 'Task count', 'Revenue', 'Created at', 'Updated at'],
      exportData.projects.map((project) => [
        project.id,
        project.title,
        project.clientName,
        project.manager?.name ?? '',
        project.taskCount,
        project.revenueByCurrency.map((money) => `${money.currency} ${money.total}`).join('; '),
        project.createdAt,
        project.updatedAt,
      ])
    ),
    '# Tasks',
    csvRows(
      ['ID', 'Title', 'Project', 'Assignee', 'Stage', 'Progress', 'Priority', 'Deadline', 'Created at'],
      exportData.tasks.map((task) => [
        task.id,
        task.title,
        task.project.title,
        task.assignee?.name ?? '',
        task.stage,
        task.progress,
        task.priority,
        task.deadline,
        task.createdAt,
      ])
    ),
    '# Team Performance',
    csvRows(
      ['ID', 'Name', 'Email', 'Role', 'Assigned tasks', 'Completed tasks', 'Completion rate', 'Average progress', 'Activity count'],
      exportData.teamPerformance.map((member) => [
        member.id,
        member.name,
        member.email,
        member.role,
        member.assignedTasks,
        member.completedTasks,
        `${member.completionRate}%`,
        `${member.averageProgress}%`,
        member.activityCount,
      ])
    ),
    '# Task Activity',
    csvRows(
      ['ID', 'Action', 'User', 'Task', 'Project', 'Created at'],
      exportData.activityLogs.taskActivity.map((activity) => [
        activity.id,
        activity.action,
        activity.user.name,
        activity.task.title,
        activity.task.project.title,
        activity.createdAt,
      ])
    ),
    '# Admin Actions',
    csvRows(
      ['ID', 'Action', 'Actor', 'Target user', 'Metadata', 'Created at'],
      exportData.activityLogs.adminActions.map((action) => [
        action.id,
        action.action,
        action.actor.name,
        action.targetUser?.name ?? '',
        action.metadata,
        action.createdAt,
      ])
    ),
  ]

  return `${sections.join('\n\n')}\n`
}

export type WorkspaceStatsExport = Awaited<ReturnType<typeof buildWorkspaceStatsExport>>
