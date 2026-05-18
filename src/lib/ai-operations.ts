import { cached } from '@/lib/cache'
import { prisma } from '@/lib/db'
import { executeAiWorkspaceAction } from '@/lib/ai-actions'
import type { AiAmbiguityPanelPayload, AILanguage, ResolvedIntent } from '@/lib/ai-intent'

export type AiMessageInput = {
  role: 'user' | 'assistant'
  content: string
}

export type AiSessionUser = {
  id: string
  name?: string | null
  email?: string | null
  role?: string | null
  companyId?: string | null
}

export type AiCitation = {
  type: 'project' | 'task' | 'invoice' | 'client' | 'deliverable' | 'user' | 'activity'
  id: string
  label: string
  href?: string
}

export type AiGroundedAnswer = {
  answer: string
  intent: string
  confidence: 'high' | 'medium' | 'low'
  citations: AiCitation[]
  quickActions: string[]
  facts: Record<string, unknown>
  language?: AILanguage
  dir?: 'ltr' | 'rtl'
  resolvedIntent?: ResolvedIntent
  ambiguity?: AiAmbiguityPanelPayload
  policy: {
    role: string
    scope: 'workspace' | 'assigned-work' | 'none'
    financeVisible: boolean
  }
}

export type AiMemoryItem = {
  id: string
  scope: 'workspace' | 'user'
  kind: string
  key: string
  value: string
  confidence: number
  lastSeenAt: string
}

export type AiMemoryContext = {
  memoryAvailable: boolean
  memories: AiMemoryItem[]
  notes: string[]
}

type ScopedTask = Awaited<ReturnType<typeof loadWorkspaceContext>>['tasks'][number]
type ScopedProject = Awaited<ReturnType<typeof loadWorkspaceContext>>['projects'][number]
type ScopedInvoice = Awaited<ReturnType<typeof loadWorkspaceContext>>['invoices'][number]
type ScopedClient = Awaited<ReturnType<typeof loadWorkspaceContext>>['clients'][number]
type ScopedDeliverable = Awaited<ReturnType<typeof loadWorkspaceContext>>['deliverables'][number]

const OPEN_STAGES = ['TODO', 'IN_PROGRESS', 'REVIEW']
const HIGH_PRIORITY = ['HIGH', 'CRITICAL']
const HIGH_RISK_PROJECT_SCORE = 45
const WORKLOAD_RISK_THRESHOLD = 85

function normalizeRole(role?: string | null) {
  return role?.trim().toUpperCase() || 'EMPLOYEE'
}

function isEmployee(user: AiSessionUser) {
  return normalizeRole(user.role) === 'EMPLOYEE'
}

function canViewFinance(user: AiSessionUser) {
  const role = normalizeRole(user.role)
  return role === 'OWNER' || role === 'MANAGER'
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function daysBetween(from: Date, to: Date) {
  const ms = startOfDay(from).getTime() - startOfDay(to).getTime()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

function formatDate(value?: Date | null) {
  if (!value) return 'No date'
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatMoney(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`
}

function taskHref(task: Pick<ScopedTask, 'projectId'>) {
  return `/dashboard/admin/projects/${task.projectId}`
}

function projectHref(project: Pick<ScopedProject, 'id'>) {
  return `/dashboard/admin/projects/${project.id}`
}

function clientHref(client: Pick<ScopedClient, 'id'>) {
  return `/dashboard/admin/clients/${client.id}`
}

function invoiceHref() {
  return '/dashboard/admin/invoices'
}

function asCitation(citation: AiCitation): AiCitation {
  return citation
}

function compactList<T>(items: T[], limit: number) {
  return items.slice(0, limit)
}

async function loadWorkspaceContext(user: AiSessionUser) {
  const companyId = user.companyId
  if (!companyId) {
    return {
      company: null,
      tasks: [],
      projects: [],
      deliverables: [],
      invoices: [],
      clients: [],
      members: [],
      activities: [],
    }
  }

  const employeeTaskWhere = isEmployee(user) ? { assigneeId: user.id } : {}
  const employeeProjectWhere = isEmployee(user) ? { tasks: { some: { assigneeId: user.id } } } : {}
  const employeeDeliverableWhere = isEmployee(user) ? { tasks: { some: { assigneeId: user.id } } } : {}
  const employeeClientWhere = isEmployee(user)
    ? {
        projects: {
          some: {
            tasks: { some: { assigneeId: user.id } },
          },
        },
      }
    : {}

  const [
    company,
    tasks,
    projects,
    deliverables,
    invoices,
    clients,
    members,
    activities,
  ] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, companyType: true },
    }),
    prisma.task.findMany({
      where: {
        ...employeeTaskWhere,
        project: { companyId },
      },
      select: {
        id: true,
        title: true,
        priority: true,
        deadline: true,
        stage: true,
        progress: true,
        updatedAt: true,
        projectId: true,
        assignee: { select: { id: true, name: true, email: true } },
        project: {
          select: {
            id: true,
            title: true,
            clientId: true,
            clientName: true,
            managerId: true,
          },
        },
        deliverable: {
          select: {
            id: true,
            title: true,
            status: true,
            approvalState: true,
            dueAt: true,
          },
        },
      },
      orderBy: [{ deadline: 'asc' }, { updatedAt: 'desc' }],
      take: 120,
    }),
    prisma.project.findMany({
      where: {
        companyId,
        ...employeeProjectWhere,
      },
      select: {
        id: true,
        title: true,
        clientId: true,
        clientName: true,
        managerId: true,
        createdAt: true,
        updatedAt: true,
        client: { select: { id: true, companyName: true, status: true } },
        manager: { select: { id: true, name: true } },
        tasks: {
          select: {
            id: true,
            title: true,
            stage: true,
            priority: true,
            deadline: true,
            progress: true,
            assigneeId: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 30,
        },
        deliverables: {
          select: {
            id: true,
            title: true,
            status: true,
            approvalState: true,
            dueAt: true,
            deliveredAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 15,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 80,
    }),
    prisma.deliverable.findMany({
      where: {
        companyId,
        ...employeeDeliverableWhere,
      },
      select: {
        id: true,
        title: true,
        status: true,
        approvalState: true,
        dueAt: true,
        updatedAt: true,
        campaignId: true,
        campaign: { select: { id: true, title: true, clientId: true, clientName: true } },
        brief: { select: { id: true, title: true, status: true } },
      },
      orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
      take: 120,
    }),
    canViewFinance(user)
      ? prisma.invoice.findMany({
          where: { companyId },
          select: {
            id: true,
            invoiceNumber: true,
            clientId: true,
            clientName: true,
            status: true,
            currency: true,
            issueDate: true,
            dueDate: true,
            paidAt: true,
            total: true,
            createdAt: true,
            campaignId: true,
          },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
          take: 200,
        })
      : Promise.resolve([]),
    prisma.client.findMany({
      where: {
        companyId,
        ...employeeClientWhere,
      },
      select: {
        id: true,
        companyName: true,
        contactPerson: true,
        email: true,
        status: true,
        updatedAt: true,
        projects: {
          select: { id: true, title: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 8,
        },
        invoices: canViewFinance(user)
          ? {
              select: { id: true, status: true, total: true, currency: true, paidAt: true, dueDate: true },
              orderBy: { createdAt: 'desc' },
              take: 12,
            }
          : false,
        activities: {
          select: { id: true, type: true, title: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 6,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 120,
    }),
    isEmployee(user)
      ? prisma.user.findMany({
          where: { id: user.id, companyId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            assignedTasks: {
              where: { project: { companyId } },
              select: { id: true, stage: true, priority: true, deadline: true, updatedAt: true },
            },
          },
          take: 1,
        })
      : prisma.user.findMany({
          where: { companyId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            assignedTasks: {
              where: { project: { companyId } },
              select: { id: true, stage: true, priority: true, deadline: true, updatedAt: true },
            },
          },
          orderBy: { name: 'asc' },
          take: 80,
        }),
    prisma.activity.findMany({
      where: {
        task: {
          project: { companyId },
          ...employeeTaskWhere,
        },
      },
      select: {
        id: true,
        action: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, projectId: true, project: { select: { title: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
  ])

  return { company, tasks, projects, deliverables, invoices, clients, members, activities }
}

function detectIntent(question: string) {
  const q = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (
    /\b(create|make|add|draft|generate|start|creer|ajouter|generer|demarrer)\b/.test(q) &&
    /\b(campaign|project|brief|invoice|bill|client|customer|campagne|projet|facture)\b/.test(q)
  ) return 'action'
  if (q.includes('انشاء') || q.includes('إنشاء') || q.includes('فاتورة') || q.includes('عميل') || q.includes('حملة') || q.includes('مشروع')) return 'action'
  if (q.includes('automation') || q.includes('workflow execution') || q.includes('reminder') || q.includes('alerte') || q.includes('تنبيه')) return 'automations'
  if (
    q.includes('invoice') ||
    q.includes('facture') ||
    q.includes('فاتورة') ||
    q.includes('revenue') ||
    q.includes('revenu') ||
    q.includes('payment') ||
    q.includes('paiement') ||
    q.includes('دفع') ||
    q.includes('cash') ||
    q.includes('mrr') ||
    q.includes('profit') ||
    q.includes('margin') ||
    q.includes('forecast')
  ) {
    return 'finance'
  }
  if (q.includes('client') || q.includes('عميل') || q.includes('follow-up') || q.includes('follow up') || q.includes('inactive') || q.includes('inactif') || q.includes('churn')) return 'clients'
  if (
    q.includes('workload') ||
    q.includes('charge') ||
    q.includes('productivity') ||
    q.includes('overloaded') ||
    q.includes('employee') ||
    q.includes('equipe') ||
    q.includes('team member') ||
    q.includes('capacity') ||
    q.includes('burnout')
  ) {
    return 'workload'
  }
  if (q.includes('approval') || q.includes('approbation') || q.includes('feedback') || q.includes('deliverable') || q.includes('موافقة')) return 'approvals'
  if (q.includes('remember') || q.includes('memory') || q.includes('memoire') || q.includes('ذاكرة') || q.includes('what do you know about') || q.includes('what do you know')) return 'memory'
  if (
    q.includes('risk') ||
    q.includes('risque') ||
    q.includes('bottleneck') ||
    q.includes('focus') ||
    q.includes('executive') ||
    q.includes('performance') ||
    q.includes('week') ||
    q.includes('today') ||
    q.includes('priority') ||
    q.includes('prioritize') ||
    q.includes('operate') ||
    q.includes('summary')
  ) {
    return 'executive'
  }
  if (q.includes('task') || q.includes('tache') || q.includes('overdue') || q.includes('متأخر')) return 'tasks'
  if (q.includes('project') || q.includes('projet') || q.includes('delayed') || q.includes('مشروع')) return 'projects'

  if (
    q.includes('hello') ||
    q.includes('hi') ||
    q.includes('help') ||
    q.includes('what can you do') ||
    q.includes('who are you') ||
    q.length < 32
  ) {
    return 'general'
  }

  return 'executive'
}

function summarizeTasks(tasks: ScopedTask[], now: Date) {
  const openTasks = tasks.filter((task) => task.stage !== 'DONE')
  const overdueTasks = openTasks.filter((task) => task.deadline && task.deadline < now)
  const dueThisWeek = openTasks.filter((task) => task.deadline && task.deadline >= now && task.deadline < addDays(now, 7))
  const completedThisMonth = tasks.filter((task) => task.stage === 'DONE' && task.updatedAt >= startOfMonth(now))
  const criticalOpen = openTasks.filter((task) => HIGH_PRIORITY.includes(task.priority))
  const unassignedOpen = openTasks.filter((task) => !task.assignee)
  const staleOpen = openTasks.filter((task) => task.updatedAt < addDays(now, -7))

  return {
    total: tasks.length,
    open: openTasks.length,
    overdue: overdueTasks,
    dueThisWeek,
    completedThisMonth,
    criticalOpen,
    unassignedOpen,
    staleOpen,
    byStage: OPEN_STAGES.concat('DONE').map((stage) => ({
      stage,
      count: tasks.filter((task) => task.stage === stage).length,
    })),
  }
}

function summarizeProjects(projects: ScopedProject[], now: Date) {
  return projects.map((project) => {
    const openTasks = project.tasks.filter((task) => task.stage !== 'DONE')
    const overdueTasks = openTasks.filter((task) => task.deadline && task.deadline < now)
    const reviewTasks = openTasks.filter((task) => task.stage === 'REVIEW')
    const waitingDeliverables = project.deliverables.filter(
      (deliverable) => deliverable.status === 'CLIENT_REVIEW' || deliverable.approvalState === 'PENDING'
    )
    const overdueDeliverables = project.deliverables.filter(
      (deliverable) => deliverable.dueAt && deliverable.dueAt < now && !deliverable.deliveredAt
    )
    const doneTasks = project.tasks.filter((task) => task.stage === 'DONE').length
    const completionRate = project.tasks.length ? Math.round((doneTasks / project.tasks.length) * 100) : 0
    const riskScore =
      overdueTasks.length * 25 +
      overdueDeliverables.length * 20 +
      reviewTasks.length * 8 +
      waitingDeliverables.length * 6 +
      (completionRate < 35 && project.tasks.length > 4 ? 10 : 0) +
      (openTasks.length > 0 && project.updatedAt < addDays(now, -14) ? 12 : 0)

    return {
      project,
      openTasks,
      overdueTasks,
      reviewTasks,
      waitingDeliverables,
      overdueDeliverables,
      completionRate,
      stalledDays: openTasks.length > 0 && project.updatedAt < addDays(now, -14) ? daysBetween(now, project.updatedAt) : 0,
      riskScore,
    }
  })
}

function summarizeWorkload(members: Awaited<ReturnType<typeof loadWorkspaceContext>>['members'], now: Date) {
  return members
    .map((member) => {
      const openTasks = member.assignedTasks.filter((task) => task.stage !== 'DONE')
      const overdueTasks = openTasks.filter((task) => task.deadline && task.deadline < now)
      const dueSoon = openTasks.filter((task) => task.deadline && task.deadline >= now && task.deadline < addDays(now, 7))
      const critical = openTasks.filter((task) => HIGH_PRIORITY.includes(task.priority))
      const doneThisMonth = member.assignedTasks.filter((task) => task.stage === 'DONE' && task.updatedAt >= startOfMonth(now))
      const staleOpen = openTasks.filter((task) => task.updatedAt < addDays(now, -7))
      const capacityScore = Math.min(100, openTasks.length * 12 + overdueTasks.length * 16 + critical.length * 8 + dueSoon.length * 5 + staleOpen.length * 3)

      return {
        member,
        openTasks,
        overdueTasks,
        dueSoon,
        critical,
        staleOpen,
        doneThisMonth,
        capacityScore,
      }
    })
    .sort((a, b) => b.capacityScore - a.capacityScore)
}

function summarizeFinance(invoices: ScopedInvoice[], now: Date) {
  const paidThisMonth = invoices.filter((invoice) => invoice.status === 'paid' && invoice.paidAt && invoice.paidAt >= startOfMonth(now))
  const outstanding = invoices.filter((invoice) => invoice.status === 'sent' || invoice.status === 'overdue')
  const overdue = outstanding.filter((invoice) => invoice.status === 'overdue' || (invoice.dueDate && invoice.dueDate < now))
  const dueSoon = outstanding.filter((invoice) => invoice.dueDate && invoice.dueDate >= now && invoice.dueDate < addDays(now, 7))
  const olderThan30 = overdue.filter((invoice) => invoice.dueDate && daysBetween(now, invoice.dueDate) > 30)
  const primaryCurrency = invoices[0]?.currency ?? 'USD'
  const revenueThisMonth = paidThisMonth.reduce((sum, invoice) => sum + Number(invoice.total), 0)
  const outstandingTotal = outstanding.reduce((sum, invoice) => sum + Number(invoice.total), 0)
  const overdueTotal = overdue.reduce((sum, invoice) => sum + Number(invoice.total), 0)
  const dueSoonTotal = dueSoon.reduce((sum, invoice) => sum + Number(invoice.total), 0)
  const clientRevenue = new Map<string, number>()

  for (const invoice of invoices.filter((item) => item.status === 'paid')) {
    clientRevenue.set(invoice.clientName, (clientRevenue.get(invoice.clientName) ?? 0) + Number(invoice.total))
  }

  return {
    primaryCurrency,
    revenueThisMonth,
    outstandingTotal,
    overdueTotal,
    overdue,
    dueSoon,
    olderThan30,
    dueSoonTotal,
    topClients: [...clientRevenue.entries()]
      .map(([clientName, total]) => ({ clientName, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
  }
}

function summarizeClients(clients: ScopedClient[], now: Date) {
  return clients
    .map((client) => {
      const latestActivity = client.activities[0]?.createdAt ?? client.projects[0]?.updatedAt ?? client.updatedAt
      const inactiveDays = daysBetween(now, latestActivity)
      const paidRevenue = 'invoices' in client && Array.isArray(client.invoices)
        ? client.invoices
            .filter((invoice) => invoice.status === 'paid')
            .reduce((sum, invoice) => sum + Number(invoice.total), 0)
        : 0
      const openInvoices = 'invoices' in client && Array.isArray(client.invoices)
        ? client.invoices.filter((invoice) => invoice.status === 'sent' || invoice.status === 'overdue')
        : []

      return {
        client,
        latestActivity,
        inactiveDays,
        paidRevenue,
        openInvoices,
        projectVolume: client.projects.length,
      }
    })
    .sort((a, b) => b.inactiveDays - a.inactiveDays)
}

function summarizeApprovals(deliverables: ScopedDeliverable[], now: Date) {
  return deliverables
    .filter(
      (deliverable) =>
        deliverable.status === 'CLIENT_REVIEW' ||
        deliverable.status === 'INTERNAL_REVIEW' ||
        deliverable.approvalState === 'PENDING' ||
        deliverable.approvalState === 'CHANGES_REQUESTED'
    )
    .map((deliverable) => ({
      deliverable,
      overdue: Boolean(deliverable.dueAt && deliverable.dueAt < now),
      daysOverdue: deliverable.dueAt && deliverable.dueAt < now ? daysBetween(now, deliverable.dueAt) : 0,
    }))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.deliverable.updatedAt.getTime() - b.deliverable.updatedAt.getTime())
}

function buildOperatingSignals(input: {
  taskSummary: ReturnType<typeof summarizeTasks>
  projectRisk: ReturnType<typeof summarizeProjects>
  workload: ReturnType<typeof summarizeWorkload>
  finance: ReturnType<typeof summarizeFinance>
  clientHealth: ReturnType<typeof summarizeClients>
  approvalQueue: ReturnType<typeof summarizeApprovals>
  financeVisible: boolean
}) {
  const atRiskProjects = input.projectRisk.filter((item) => item.riskScore > 0).sort((a, b) => b.riskScore - a.riskScore)
  const highRiskProjects = atRiskProjects.filter((item) => item.riskScore >= HIGH_RISK_PROJECT_SCORE)
  const overloaded = input.workload.filter((item) => item.capacityScore >= WORKLOAD_RISK_THRESHOLD)
  const inactiveClients = input.clientHealth.filter((item) => item.client.status === 'inactive' || item.inactiveDays >= 21)
  const overdueApprovals = input.approvalQueue.filter((item) => item.overdue)
  const stalledProjects = input.projectRisk.filter((item) => item.stalledDays >= 14).sort((a, b) => b.stalledDays - a.stalledDays)
  const unpaidRisk = input.financeVisible ? input.finance.overdueTotal : 0

  const primaryBottlenecks = [
    input.approvalQueue.length
      ? {
          label: 'Approval queue',
          impact: `${plural(input.approvalQueue.length, 'deliverable')} waiting for review or approval${overdueApprovals.length ? `; ${plural(overdueApprovals.length, 'item')} overdue` : ''}`,
          severity: overdueApprovals.length ? 95 : 70,
        }
      : null,
    input.taskSummary.overdue.length
      ? {
          label: 'Missed execution deadlines',
          impact: `${plural(input.taskSummary.overdue.length, 'task')} overdue; ${plural(input.taskSummary.criticalOpen.length, 'critical/high-priority task')} still open`,
          severity: Math.min(100, input.taskSummary.overdue.length * 12 + input.taskSummary.criticalOpen.length * 8),
        }
      : null,
    overloaded.length
      ? {
          label: 'Capacity concentration',
          impact: `${plural(overloaded.length, 'team member')} above ${WORKLOAD_RISK_THRESHOLD}% workload signal`,
          severity: Math.min(100, overloaded.length * 28),
        }
      : null,
    stalledProjects.length
      ? {
          label: 'Stalled delivery motion',
          impact: `${plural(stalledProjects.length, 'campaign')} open but inactive for 14+ days`,
          severity: Math.min(100, stalledProjects.length * 18),
        }
      : null,
    input.financeVisible && input.finance.overdue.length
      ? {
          label: 'Cash collection',
          impact: `${formatMoney(input.finance.overdueTotal, input.finance.primaryCurrency)} overdue across ${plural(input.finance.overdue.length, 'invoice')}`,
          severity: input.finance.olderThan30.length ? 100 : 80,
        }
      : null,
    inactiveClients.length
      ? {
          label: 'Client relationship drift',
          impact: `${plural(inactiveClients.length, 'client')} inactive or silent for 21+ days`,
          severity: Math.min(90, inactiveClients.length * 18),
        }
      : null,
  ]
    .filter((item): item is { label: string; impact: string; severity: number } => Boolean(item))
    .sort((a, b) => b.severity - a.severity)

  const nextActions = [
    input.taskSummary.overdue.length
      ? `Clear or reassign the ${plural(Math.min(input.taskSummary.overdue.length, 3), 'oldest overdue task')} before accepting new same-week commitments.`
      : '',
    atRiskProjects[0]
      ? `Run a manager review on ${atRiskProjects[0].project.title}; it is the highest-risk campaign in the current scope.`
      : '',
    input.approvalQueue.length
      ? 'Move pending approvals today, starting with overdue client-review deliverables because they block delivery and billing.'
      : '',
    overloaded[0]
      ? `Rebalance work from ${overloaded[0].member.name}; their capacity signal is ${overloaded[0].capacityScore}%.`
      : '',
    input.financeVisible && input.finance.overdue.length
      ? `Escalate overdue invoice follow-ups worth ${formatMoney(input.finance.overdueTotal, input.finance.primaryCurrency)}.`
      : '',
    inactiveClients[0]
      ? `Schedule a client-health check-in with ${inactiveClients[0].client.companyName}.`
      : '',
    input.taskSummary.unassignedOpen.length
      ? `Assign owners to ${plural(input.taskSummary.unassignedOpen.length, 'open task')} without an assignee.`
      : '',
  ].filter(Boolean)

  return {
    atRiskProjects,
    highRiskProjects,
    overloaded,
    inactiveClients,
    overdueApprovals,
    stalledProjects,
    unpaidRisk,
    primaryBottlenecks,
    nextActions,
  }
}

function lines(items: string[]) {
  return items.filter(Boolean).join('\n')
}

function citeTasks(tasks: ScopedTask[]): AiCitation[] {
  return tasks.map((task) =>
    asCitation({
      type: 'task',
      id: task.id,
      label: task.title,
      href: taskHref(task),
    })
  )
}

function citeProjects(projects: ScopedProject[]): AiCitation[] {
  return projects.map((project) =>
    asCitation({
      type: 'project',
      id: project.id,
      label: project.title,
      href: projectHref(project),
    })
  )
}

function citeInvoices(invoices: ScopedInvoice[]): AiCitation[] {
  return invoices.map((invoice) =>
    asCitation({
      type: 'invoice',
      id: invoice.id,
      label: `${invoice.invoiceNumber} - ${invoice.clientName}`,
      href: invoiceHref(),
    })
  )
}

function citeClients(clients: ScopedClient[]): AiCitation[] {
  return clients.map((client) =>
    asCitation({
      type: 'client',
      id: client.id,
      label: client.companyName,
      href: clientHref(client),
    })
  )
}

function buildTaskAnswer(question: string, tasks: ReturnType<typeof summarizeTasks>, now: Date): AiGroundedAnswer {
  const focus = question.toLowerCase().includes('week') ? tasks.dueThisWeek : tasks.overdue
  const title = question.toLowerCase().includes('week') ? 'Tasks due this week' : 'Overdue tasks'
  const visible = compactList(focus, 8)

  const answer = visible.length
    ? lines([
        `${title}: ${focus.length}`,
        '',
        ...visible.map((task) => {
          const suffix = task.deadline && task.deadline < now ? `${daysBetween(now, task.deadline)} days overdue` : `due ${formatDate(task.deadline)}`
          return `- ${task.title} (${task.project.title}) - ${task.stage}, ${suffix}${task.assignee?.name ? `, assigned to ${task.assignee.name}` : ''}`
        }),
        '',
        `Recommendation: clear the oldest ${focus.length > 1 ? 'items' : 'item'} first, then move review-stage work to approval or reassignment.`,
      ])
    : `No ${question.toLowerCase().includes('week') ? 'open tasks due this week' : 'overdue tasks'} were found in your permitted workspace scope.`

  return {
    answer,
    intent: 'tasks',
    confidence: 'high',
    citations: citeTasks(visible),
    quickActions: ['Analyze delayed projects', 'Analyze team workload', 'Generate executive summary'],
    facts: {
      totalTasks: tasks.total,
      openTasks: tasks.open,
      overdueTasks: tasks.overdue.length,
      dueThisWeek: tasks.dueThisWeek.length,
    },
    policy: { role: 'EMPLOYEE', scope: 'assigned-work', financeVisible: false },
  }
}

function buildProjectAnswer(projectRisk: ReturnType<typeof summarizeProjects>): AiGroundedAnswer {
  const risky = projectRisk.filter((item) => item.riskScore > 0).sort((a, b) => b.riskScore - a.riskScore)
  const visible = compactList(risky, 6)
  const answer = visible.length
    ? lines([
        `${risky.length} projects show delay or delivery risk.`,
        '',
        ...visible.map(({ project, overdueTasks, reviewTasks, waitingDeliverables, completionRate }) => {
          const blockers = [
            overdueTasks.length ? `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'}` : '',
            reviewTasks.length ? `${reviewTasks.length} in review` : '',
            waitingDeliverables.length ? `${waitingDeliverables.length} waiting approval` : '',
          ].filter(Boolean)
          return `- ${project.title} - ${completionRate}% complete; ${blockers.join(', ') || 'needs scheduling review'}`
        }),
        '',
        'Main bottleneck: overdue execution work and review queues are the strongest risk signals in the current records.',
        'Recommendation: prioritize blocked reviews, reassign overdue high-priority work, and confirm client approvals on the highest-risk projects.',
      ])
    : 'No delayed or at-risk projects were found in your permitted workspace scope.'

  return {
    answer,
    intent: 'projects',
    confidence: 'high',
    citations: citeProjects(visible.map((item) => item.project)),
    quickActions: ['Find overdue invoices', 'Analyze team workload', 'Summarize pending approvals'],
    facts: {
      atRiskProjects: risky.length,
      totalProjects: projectRisk.length,
      topRiskScores: visible.map((item) => ({ project: item.project.title, riskScore: item.riskScore })),
    },
    policy: { role: 'EMPLOYEE', scope: 'assigned-work', financeVisible: false },
  }
}

function buildFinanceAnswer(finance: ReturnType<typeof summarizeFinance>, financeVisible: boolean): AiGroundedAnswer {
  if (!financeVisible) {
    return {
      answer: lines([
        'Direct Answer',
        'I cannot show invoice, payment, or revenue data for your current role.',
        '',
        'What I can analyze instead',
        '- Assigned tasks, deadlines, project blockers, deliverable reviews, and workload signals visible to your role.',
      ]),
      intent: 'finance',
      confidence: 'high',
      citations: [],
      quickActions: ['Analyze my overdue tasks', 'Summarize assigned projects'],
      facts: { financeVisible: false },
      policy: { role: 'EMPLOYEE', scope: 'assigned-work', financeVisible: false },
    }
  }

  const visibleOverdue = compactList(finance.overdue, 6)
  const answer = lines([
    'Direct Answer',
    `Revenue this month is ${formatMoney(finance.revenueThisMonth, finance.primaryCurrency)}. Outstanding invoices total ${formatMoney(finance.outstandingTotal, finance.primaryCurrency)}, with ${formatMoney(finance.overdueTotal, finance.primaryCurrency)} overdue.`,
    '',
    'Key Insights',
    finance.topClients[0]
      ? `- Highest revenue client: ${finance.topClients[0].clientName} (${formatMoney(finance.topClients[0].total, finance.primaryCurrency)})`
      : '- Highest revenue client: no paid invoice data found.',
    finance.dueSoon.length
      ? `- ${formatMoney(finance.dueSoonTotal, finance.primaryCurrency)} is due within 7 days across ${plural(finance.dueSoon.length, 'invoice')}.`
      : '- No sent invoices are due within the next 7 days.',
    '- Profit margin and burn rate are unavailable because cost and time-entry data are not in the active workspace schema.',
    '',
    'Risks',
    finance.olderThan30.length
      ? `- Cash-flow risk: ${plural(finance.olderThan30.length, 'overdue invoice')} older than 30 days.`
      : '- No unpaid invoices older than 30 days were found.',
    finance.overdue.length ? `- ${plural(finance.overdue.length, 'invoice')} require collection follow-up.` : '',
    '',
    visibleOverdue.length ? 'Priority Follow-Ups' : '',
    ...visibleOverdue.map((invoice) => {
      const overdueBy = invoice.dueDate ? `${daysBetween(new Date(), invoice.dueDate)} days overdue` : 'no due date'
      return `- ${invoice.invoiceNumber} (${invoice.clientName}) - ${formatMoney(Number(invoice.total), invoice.currency)}, ${overdueBy}`
    }),
    '',
    'Suggested Next Actions',
    '- Follow up on overdue invoices first, then review sent invoices with approaching due dates.',
    '- Add cost/time tracking before using this assistant for true profitability, margin, or burn-rate decisions.',
  ])

  return {
    answer,
    intent: 'finance',
    confidence: 'high',
    citations: citeInvoices(visibleOverdue),
    quickActions: ['Analyze delayed projects', 'Generate weekly report', 'Detect operational risks'],
    facts: {
      revenueThisMonth: finance.revenueThisMonth,
      outstandingTotal: finance.outstandingTotal,
      overdueTotal: finance.overdueTotal,
      dueSoonTotal: finance.dueSoonTotal,
      overdueInvoices: finance.overdue.length,
      dueSoonInvoices: finance.dueSoon.length,
      unpaidOlderThan30: finance.olderThan30.length,
      topClients: finance.topClients,
      unavailableMetrics: ['profitMargin', 'burnRate', 'projectCost'],
    },
    policy: { role: 'OWNER', scope: 'workspace', financeVisible: true },
  }
}

function buildWorkloadAnswer(workload: ReturnType<typeof summarizeWorkload>): AiGroundedAnswer {
  const visible = compactList(workload, 7)
  const overloaded = workload.filter((item) => item.capacityScore >= WORKLOAD_RISK_THRESHOLD)
  const answer = visible.length
    ? lines([
        `${plural(overloaded.length, 'team member')} are above the ${WORKLOAD_RISK_THRESHOLD}% workload risk threshold.`,
        '',
        ...visible.map(({ member, openTasks, overdueTasks, dueSoon, doneThisMonth, capacityScore }) => {
          return `- ${member.name}: ${capacityScore}% capacity signal, ${openTasks.length} open, ${overdueTasks.length} overdue, ${dueSoon.length} due this week, ${doneThisMonth.length} completed this month`
        }),
        '',
        overloaded.length
          ? 'Recommendation: rebalance overdue and critical work from the highest-capacity people before adding new commitments.'
          : 'Recommendation: current workload looks manageable from task counts; true utilization requires time-entry capacity data, which is not in the active schema.',
      ])
    : 'No team workload records were found in your permitted workspace scope.'

  return {
    answer,
    intent: 'workload',
    confidence: 'high',
    citations: visible.map(({ member }) => asCitation({ type: 'user', id: member.id, label: member.name })),
    quickActions: ['Show overdue tasks', 'Analyze delayed projects', 'Generate executive summary'],
    facts: {
      overloadedMembers: overloaded.length,
      workload: visible.map(({ member, capacityScore, openTasks, overdueTasks }) => ({
        member: member.name,
        capacityScore,
        openTasks: openTasks.length,
        overdueTasks: overdueTasks.length,
      })),
    },
    policy: { role: 'MANAGER', scope: 'workspace', financeVisible: false },
  }
}

function buildClientsAnswer(clientHealth: ReturnType<typeof summarizeClients>): AiGroundedAnswer {
  const inactive = clientHealth.filter((item) => item.client.status === 'inactive' || item.inactiveDays >= 21)
  const visible = compactList(inactive.length ? inactive : clientHealth, 6)
  const answer = visible.length
    ? lines([
        `${inactive.length} clients need follow-up based on inactive status or 21+ days without visible activity.`,
        '',
        ...visible.map(({ client, inactiveDays, projectVolume, openInvoices }) => {
          return `- ${client.companyName}: ${inactiveDays} days since latest activity, ${projectVolume} active/recent projects${openInvoices.length ? `, ${openInvoices.length} open invoices` : ''}`
        }),
        '',
        'Recommendation: start with inactive clients that also have open invoices or active projects, then schedule relationship check-ins.',
      ])
    : 'No client records were found in your permitted workspace scope.'

  return {
    answer,
    intent: 'clients',
    confidence: 'high',
    citations: citeClients(visible.map((item) => item.client)),
    quickActions: ['Summarize client activity', 'Find overdue invoices', 'Generate weekly report'],
    facts: {
      inactiveClients: inactive.length,
      totalClients: clientHealth.length,
      topFollowUps: visible.map(({ client, inactiveDays }) => ({ client: client.companyName, inactiveDays })),
    },
    policy: { role: 'MANAGER', scope: 'workspace', financeVisible: false },
  }
}

function buildApprovalsAnswer(approvalQueue: ReturnType<typeof summarizeApprovals>): AiGroundedAnswer {
  const visible = compactList(approvalQueue, 8)
  const overdue = approvalQueue.filter((item) => item.overdue)
  const answer = visible.length
    ? lines([
        `${approvalQueue.length} deliverables are in review, pending approval, or need changes.`,
        `${overdue.length} are overdue.`,
        '',
        ...visible.map(({ deliverable, overdue: isOverdue, daysOverdue }) => {
          return `- ${deliverable.title} (${deliverable.campaign.title}) - ${deliverable.status}, ${deliverable.approvalState}${isOverdue ? `, ${daysOverdue} days overdue` : deliverable.dueAt ? `, due ${formatDate(deliverable.dueAt)}` : ''}`
        }),
        '',
        'Recommendation: move client-review deliverables first, because approval delays usually block delivery and billing.',
      ])
    : 'No deliverables waiting for review, feedback, or approval were found in your permitted workspace scope.'

  return {
    answer,
    intent: 'approvals',
    confidence: 'high',
    citations: visible.map(({ deliverable }) =>
      asCitation({
        type: 'deliverable',
        id: deliverable.id,
        label: deliverable.title,
        href: projectHref({ id: deliverable.campaignId }),
      })
    ),
    quickActions: ['Analyze delayed projects', 'Show overdue tasks', 'Generate client report'],
    facts: {
      approvalQueue: approvalQueue.length,
      overdueApprovals: overdue.length,
    },
    policy: { role: 'MANAGER', scope: 'workspace', financeVisible: false },
  }
}

function buildExecutiveAnswer(input: {
  taskSummary: ReturnType<typeof summarizeTasks>
  projectRisk: ReturnType<typeof summarizeProjects>
  workload: ReturnType<typeof summarizeWorkload>
  finance: ReturnType<typeof summarizeFinance>
  clientHealth: ReturnType<typeof summarizeClients>
  approvalQueue: ReturnType<typeof summarizeApprovals>
  financeVisible: boolean
}) {
  const signals = buildOperatingSignals(input)
  const citations = [
    ...citeProjects(compactList(signals.atRiskProjects.map((item) => item.project), 3)),
    ...citeTasks(compactList(input.taskSummary.overdue, 3)),
    ...citeClients(compactList(signals.inactiveClients.map((item) => item.client), 2)),
  ]

  const directAnswer =
    signals.primaryBottlenecks.length > 0
      ? `${plural(signals.primaryBottlenecks.length, 'operational bottleneck')} need attention now. The strongest signal is ${signals.primaryBottlenecks[0].label.toLowerCase()}: ${signals.primaryBottlenecks[0].impact}.`
      : 'No major operational bottlenecks were detected from the currently scoped records.'

  const answer = lines([
    'Direct Answer',
    directAnswer,
    '',
    'Operational Reasoning',
    `- Delivery pressure comes from ${input.taskSummary.open} open tasks with ${input.taskSummary.overdue.length} overdue and ${input.approvalQueue.length} items waiting on approval.`,
    signals.atRiskProjects[0]
      ? `- ${signals.atRiskProjects[0].project.title} is the highest-signal project risk because blockers compound across tasks and approvals.`
      : '- No single project is dominating risk signals; systemic risk is distributed across deadlines and approvals.',
    input.financeVisible && input.finance.overdueTotal > 0
      ? `- Cash exposure is tied to overdue invoice value (${formatMoney(input.finance.overdueTotal, input.finance.primaryCurrency)}), which can delay reinvestment even when production looks busy.`
      : '',
    '',
    'Key Insights',
    `- Open tasks: ${input.taskSummary.open}`,
    `- Overdue tasks: ${input.taskSummary.overdue.length}`,
    `- Critical/high-priority open tasks: ${input.taskSummary.criticalOpen.length}`,
    `- Unassigned open tasks: ${input.taskSummary.unassignedOpen.length}`,
    `- Projects at risk: ${signals.atRiskProjects.length}`,
    `- High-risk projects: ${signals.highRiskProjects.length}`,
    `- Review/approval queue: ${input.approvalQueue.length}`,
    `- Overloaded team members: ${signals.overloaded.length}`,
    `- Clients needing follow-up: ${signals.inactiveClients.length}`,
    input.financeVisible ? `- Revenue this month: ${formatMoney(input.finance.revenueThisMonth, input.finance.primaryCurrency)}` : '',
    input.financeVisible ? `- Outstanding invoices: ${formatMoney(input.finance.outstandingTotal, input.finance.primaryCurrency)}` : '',
    input.financeVisible ? `- Overdue invoices: ${formatMoney(input.finance.overdueTotal, input.finance.primaryCurrency)}` : '',
    input.financeVisible ? '' : '- Financial data is hidden for this role, so revenue and invoice risk are not included.',
    '',
    'Risks',
    signals.primaryBottlenecks.length
      ? ''
      : '- No high-signal risks were found in the visible records. Continue monitoring deadlines, approvals, and client activity.',
    ...signals.primaryBottlenecks.slice(0, 6).map((risk) => `- ${risk.label}: ${risk.impact}`),
    '',
    'Recommendations',
    signals.atRiskProjects[0]
      ? `- Treat ${signals.atRiskProjects[0].project.title} as the management-control project until blockers are cleared.`
      : '- Keep current project cadence; no campaign is signaling elevated risk.',
    input.approvalQueue.length
      ? '- Move approval decisions before opening more production work, because approvals are the cleanest path to delivery and billing.'
      : '- Keep approval queues short by reviewing new deliverables the same day they enter review.',
    signals.overloaded.length
      ? '- Rebalance work before capacity pressure turns into missed deadlines.'
      : '- Capacity looks manageable from task counts; validate with time-entry data when that model exists.',
    input.financeVisible
      ? '- Use overdue invoice value as the cash-risk floor; true margin impact is unavailable without cost/time tracking.'
      : '- Ask an Owner or Manager for finance visibility if cash-flow decisions are required.',
    '',
    'Workflow Path',
    '- Use analysis prompts for audits; use guided creation for client/campaign/brief/invoice; use direct commands for mark paid, delete, alerts, and task updates.',
  '',
    'Execution Checklist',
    '1. Clear overdue approvals blocking delivery.',
    '2. Reassign overloaded owners on the top at-risk project.',
    signals.overloaded.length ? '3. Rebalance tasks for overloaded team members before adding new scope.' : '3. Validate capacity before accepting new client work.',
    input.financeVisible && input.finance.overdueTotal > 0 ? '4. Chase overdue invoices tied to active delivery.' : '4. Confirm finance visibility if cash decisions are needed.',
    '',
    'Suggested Next Actions',
    ...(signals.nextActions.length ? compactList(signals.nextActions, 6).map((action) => `- ${action}`) : ['- No immediate corrective action is required from the current scoped records.']),
  ])

  return {
    answer,
    intent: 'executive',
    confidence: 'high' as const,
    citations,
    quickActions: ['Analyze delayed projects', 'Find overdue invoices', 'Analyze team workload', 'Generate weekly report'],
    facts: {
      openTasks: input.taskSummary.open,
      overdueTasks: input.taskSummary.overdue.length,
      criticalOpenTasks: input.taskSummary.criticalOpen.length,
      unassignedOpenTasks: input.taskSummary.unassignedOpen.length,
      projectsAtRisk: signals.atRiskProjects.length,
      highRiskProjects: signals.highRiskProjects.length,
      overloadedMembers: signals.overloaded.length,
      approvalQueue: input.approvalQueue.length,
      overdueApprovals: signals.overdueApprovals.length,
      inactiveClients: signals.inactiveClients.length,
      bottlenecks: signals.primaryBottlenecks,
      revenueThisMonth: input.financeVisible ? input.finance.revenueThisMonth : null,
      outstandingInvoices: input.financeVisible ? input.finance.outstandingTotal : null,
      overdueInvoiceValue: input.financeVisible ? input.finance.overdueTotal : null,
      unavailableMetrics: input.financeVisible ? ['profitMargin', 'burnRate', 'resourceUtilizationHours'] : ['finance'],
    },
    policy: { role: 'MANAGER', scope: 'workspace' as const, financeVisible: input.financeVisible },
  }
}

function buildAutomationAnswer(): AiGroundedAnswer {
  return {
    answer: lines([
      'Direct Answer',
      'Automation execution logs are not yet present in the active Prisma schema, so I cannot report failed workflow runs from real records.',
      '',
      'Recommended Build Path',
      '- Add AutomationRule and AutomationRun tables.',
      '- Emit run results for invoice.overdue, deliverable.approved, task.overdue, and project.completed events.',
      '- Compile natural-language automation requests into disabled drafts that require Owner or Manager confirmation before activation.',
    ]),
    intent: 'automations',
    confidence: 'high',
    citations: [],
    quickActions: ['Create automation from instruction', 'Detect operational risks', 'Generate weekly report'],
    facts: { automationTablesAvailable: false },
    policy: { role: 'MANAGER', scope: 'workspace', financeVisible: false },
  }
}

function buildMemoryAnswer(question: string, memory?: AiMemoryContext): AiGroundedAnswer {
  const q = question.toLowerCase()
  const wantsSave = /\b(remember|note|save)\b/.test(q)
  const visible = compactList(memory?.memories ?? [], 8)

  const answer = lines([
    'Direct Answer',
    memory?.memoryAvailable
      ? wantsSave
        ? 'I can store that as scoped AI memory and use it in future workspace intelligence responses.'
        : `${visible.length} relevant memory signal${visible.length === 1 ? '' : 's'} are available in your permitted scope.`
      : 'Persistent AI memory is not available yet. I can use recent messages in this conversation, but long-term recall requires the AI memory migration to be applied.',
    '',
    visible.length ? 'Relevant Memory' : '',
    ...visible.map((item) => `- ${item.value}`),
    '',
    'Governance',
    '- Memory is scoped by workspace and user role.',
    '- I will not use memory to expose finance, client, or operational data outside your permissions.',
  ])

  return {
    answer,
    intent: 'memory',
    confidence: memory?.memoryAvailable ? 'high' : 'medium',
    citations: [],
    quickActions: ['What should management focus on today?', 'Analyze delayed projects', 'Which clients need follow-up?'],
    facts: {
      memoryAvailable: Boolean(memory?.memoryAvailable),
      recalledMemories: visible,
      persistentMemoryRequired: !memory?.memoryAvailable,
    },
    policy: { role: 'EMPLOYEE', scope: 'assigned-work', financeVisible: false },
  }
}

function buildGeneralAnswer(role: string, financeVisible: boolean): AiGroundedAnswer {
  return {
    answer: [
      'Direct Answer',
      'I am TASKIT OS intelligence: a permission-scoped operating assistant for agency execution, client delivery, approvals, workload, and billing decisions.',
      '',
      'What I can do from live workspace records',
      '- Detect operational risks, delayed campaigns, overdue work, approval bottlenecks, inactive clients, and workload pressure.',
      financeVisible
        ? '- Analyze invoices, revenue, outstanding payments, cash-collection risk, and draft invoices when the client and amount are clear.'
        : '- Analyze assigned delivery work and project blockers; finance data is hidden for this role.',
      '- Create clients, campaigns, briefs, and invoice drafts through guided fields when your role has permission.',
      '- Use live workspace choices such as clients, campaigns, categories, managers, currencies, and invoice language instead of guessing names.',
      '- Let Owners and Managers mark specific invoices paid and delete identified workspace records by prompt.',
      '- Send direct in-app payment-deadline alerts for sent or overdue client invoices.',
      '',
      'Useful prompts',
      '- What should management focus on today?',
      '- Which campaigns are at risk and why?',
      '- Which clients need follow-up?',
      '- Where is the team overloaded?',
      '- Create campaign "Spring Launch" for Acme under Social Media',
      '- Create client',
      '- Send payment deadline alerts',
      '- Mark invoice INV-2026-0001 paid',
      '- Delete campaign "Spring Launch"',
      '',
      'Governance',
      'I will not invent metrics, clients, invoices, people, or events. If data is missing, I will say what is unavailable.',
    ].filter(Boolean).join('\n'),
    intent: 'general',
    confidence: 'high',
    citations: [],
    quickActions: ['Detect operational risks', 'Analyze delayed projects', 'Create client', 'Create campaign', 'Create brief', 'Create invoice', 'Mark invoice paid', 'Delete record', 'Send payment deadline alerts'],
    facts: {
      capabilities: ['analysis', 'summaries', 'risk detection', 'campaign creation', 'brief creation', 'invoice drafting', 'invoice payment updates', 'administrator deletion'],
    },
    policy: { role, scope: role === 'EMPLOYEE' ? 'assigned-work' : 'workspace', financeVisible },
  }
}

export async function buildGroundedOperationalAnswer(input: {
  question: string
  user: AiSessionUser
  messages?: AiMessageInput[]
  memory?: AiMemoryContext
  confirmationToken?: string | null
  conversationId?: string | null
}): Promise<AiGroundedAnswer> {
  const role = normalizeRole(input.user.role)
  if (!input.user.companyId || role === 'SUPER_ADMIN') {
    return {
      answer: 'The operations assistant needs an active workspace before it can answer with business data.',
      intent: 'workspace',
      confidence: 'high',
      citations: [],
      quickActions: [],
      facts: { hasWorkspace: false },
      policy: { role, scope: 'none', financeVisible: false },
    }
  }

  const action = await executeAiWorkspaceAction({
    message: input.question,
    user: input.user,
    confirmationToken: input.confirmationToken,
    conversationId: input.conversationId,
  })
  if (action.handled) {
    return {
      answer: action.answer ?? 'Done.',
      intent: action.intent ?? 'action',
      confidence: action.confidence ?? 'medium',
      citations: action.citations ?? [],
      quickActions: action.quickActions ?? ['Detect operational risks', 'Analyze delayed projects'],
      facts: {
        ...(action.facts ?? {}),
        ...(action.actionPreview ? { actionPreview: action.actionPreview } : {}),
        ...(action.executionReceipt ? { executionReceipt: action.executionReceipt } : {}),
        generatedAt: new Date().toISOString(),
      },
      language: action.resolvedIntent?.language,
      dir: action.resolvedIntent?.language === 'ar' ? 'rtl' : 'ltr',
      resolvedIntent: action.resolvedIntent,
      ambiguity: action.ambiguity,
      policy: {
        role,
        scope: isEmployee(input.user) ? 'assigned-work' : 'workspace',
        financeVisible: canViewFinance(input.user),
      },
    }
  }

  const now = new Date()
  const context = await cached(
    `ai-context:${input.user.companyId ?? 'none'}:${input.user.id}:${input.user.role ?? 'unknown'}`,
    30,
    () => loadWorkspaceContext(input.user)
  )
  const intent = detectIntent(input.question)
  const taskSummary = summarizeTasks(context.tasks, now)
  const projectRisk = summarizeProjects(context.projects, now)
  const workload = summarizeWorkload(context.members, now)
  const financeVisible = canViewFinance(input.user)
  const finance = summarizeFinance(context.invoices, now)
  const clientHealth = summarizeClients(context.clients, now)
  const approvalQueue = summarizeApprovals(context.deliverables, now)

  const answer =
    intent === 'finance'
      ? buildFinanceAnswer(finance, financeVisible)
      : intent === 'clients'
        ? buildClientsAnswer(clientHealth)
        : intent === 'workload'
          ? buildWorkloadAnswer(workload)
          : intent === 'approvals'
            ? buildApprovalsAnswer(approvalQueue)
            : intent === 'automations'
              ? buildAutomationAnswer()
              : intent === 'memory'
                ? buildMemoryAnswer(input.question, input.memory)
              : intent === 'general'
                ? buildGeneralAnswer(role, financeVisible)
              : intent === 'tasks'
                ? buildTaskAnswer(input.question, taskSummary, now)
                : intent === 'projects'
                  ? buildProjectAnswer(projectRisk)
                  : buildExecutiveAnswer({ taskSummary, projectRisk, workload, finance, clientHealth, approvalQueue, financeVisible })

  return {
    ...answer,
    facts: {
      ...answer.facts,
      workspace: context.company?.name ?? 'Workspace',
      generatedAt: now.toISOString(),
      recentActivity: compactList(context.activities, 5).map((activity) => ({
        action: activity.action,
        task: activity.task?.title ?? 'Workspace activity',
        project: activity.task?.project?.title ?? context.company?.name ?? 'Workspace',
        user: activity.user?.name ?? 'System',
        createdAt: activity.createdAt.toISOString(),
      })),
      memory: {
        available: Boolean(input.memory?.memoryAvailable),
        recalled: compactList(input.memory?.memories ?? [], 6),
        notes: input.memory?.notes ?? [],
      },
    },
    policy: {
      role,
      scope: isEmployee(input.user) ? 'assigned-work' : 'workspace',
      financeVisible,
    },
  }
}
