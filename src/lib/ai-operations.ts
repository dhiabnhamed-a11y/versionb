import { prisma } from '@/lib/db'

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
  policy: {
    role: string
    scope: 'workspace' | 'assigned-work' | 'none'
    financeVisible: boolean
  }
}

type ScopedTask = Awaited<ReturnType<typeof loadWorkspaceContext>>['tasks'][number]
type ScopedProject = Awaited<ReturnType<typeof loadWorkspaceContext>>['projects'][number]
type ScopedInvoice = Awaited<ReturnType<typeof loadWorkspaceContext>>['invoices'][number]
type ScopedClient = Awaited<ReturnType<typeof loadWorkspaceContext>>['clients'][number]
type ScopedDeliverable = Awaited<ReturnType<typeof loadWorkspaceContext>>['deliverables'][number]

const OPEN_STAGES = ['TODO', 'IN_PROGRESS', 'REVIEW']
const HIGH_PRIORITY = ['HIGH', 'CRITICAL']

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
      take: 200,
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
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 120,
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
  const q = question.toLowerCase()

  if (q.includes('automation') || q.includes('workflow execution') || q.includes('reminder')) return 'automations'
  if (q.includes('invoice') || q.includes('revenue') || q.includes('payment') || q.includes('cash') || q.includes('mrr') || q.includes('profit')) {
    return 'finance'
  }
  if (q.includes('client') || q.includes('follow-up') || q.includes('follow up') || q.includes('inactive')) return 'clients'
  if (q.includes('workload') || q.includes('productivity') || q.includes('overloaded') || q.includes('employee') || q.includes('team member')) {
    return 'workload'
  }
  if (q.includes('approval') || q.includes('feedback') || q.includes('deliverable')) return 'approvals'
  if (q.includes('risk') || q.includes('bottleneck') || q.includes('focus') || q.includes('executive') || q.includes('performance') || q.includes('week')) {
    return 'executive'
  }
  if (q.includes('task') || q.includes('overdue')) return 'tasks'
  if (q.includes('project') || q.includes('delayed')) return 'projects'

  return 'executive'
}

function summarizeTasks(tasks: ScopedTask[], now: Date) {
  const openTasks = tasks.filter((task) => task.stage !== 'DONE')
  const overdueTasks = openTasks.filter((task) => task.deadline && task.deadline < now)
  const dueThisWeek = openTasks.filter((task) => task.deadline && task.deadline >= now && task.deadline < addDays(now, 7))
  const completedThisMonth = tasks.filter((task) => task.stage === 'DONE' && task.updatedAt >= startOfMonth(now))

  return {
    total: tasks.length,
    open: openTasks.length,
    overdue: overdueTasks,
    dueThisWeek,
    completedThisMonth,
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
      (completionRate < 35 && project.tasks.length > 4 ? 10 : 0)

    return {
      project,
      openTasks,
      overdueTasks,
      reviewTasks,
      waitingDeliverables,
      overdueDeliverables,
      completionRate,
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
      const capacityScore = Math.min(100, openTasks.length * 12 + overdueTasks.length * 16 + critical.length * 8 + dueSoon.length * 5)

      return {
        member,
        openTasks,
        overdueTasks,
        dueSoon,
        critical,
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
  const olderThan30 = overdue.filter((invoice) => invoice.dueDate && daysBetween(now, invoice.dueDate) > 30)
  const primaryCurrency = invoices[0]?.currency ?? 'USD'
  const revenueThisMonth = paidThisMonth.reduce((sum, invoice) => sum + Number(invoice.total), 0)
  const outstandingTotal = outstanding.reduce((sum, invoice) => sum + Number(invoice.total), 0)
  const overdueTotal = overdue.reduce((sum, invoice) => sum + Number(invoice.total), 0)
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
    olderThan30,
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
      answer: 'I cannot show invoice, payment, or revenue data for your current role. I can still analyze your assigned tasks, deadlines, project blockers, and review workload.',
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
    `Revenue this month: ${formatMoney(finance.revenueThisMonth, finance.primaryCurrency)}`,
    `Outstanding invoices: ${formatMoney(finance.outstandingTotal, finance.primaryCurrency)}`,
    `Overdue invoices: ${formatMoney(finance.overdueTotal, finance.primaryCurrency)} across ${finance.overdue.length} invoice${finance.overdue.length === 1 ? '' : 's'}`,
    '',
    finance.topClients[0]
      ? `Highest revenue client: ${finance.topClients[0].clientName} (${formatMoney(finance.topClients[0].total, finance.primaryCurrency)})`
      : 'Highest revenue client: no paid invoice data found',
    finance.olderThan30.length
      ? `Cash-flow warning: ${finance.olderThan30.length} overdue invoice${finance.olderThan30.length === 1 ? '' : 's'} are older than 30 days.`
      : 'Cash-flow warning: no unpaid invoices older than 30 days were found.',
    '',
    ...visibleOverdue.map((invoice) => {
      const overdueBy = invoice.dueDate ? `${daysBetween(new Date(), invoice.dueDate)} days overdue` : 'no due date'
      return `- ${invoice.invoiceNumber} (${invoice.clientName}) - ${formatMoney(Number(invoice.total), invoice.currency)}, ${overdueBy}`
    }),
    '',
    'Recommendation: follow up on overdue invoices first, then review sent invoices with approaching due dates.',
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
      overdueInvoices: finance.overdue.length,
      unpaidOlderThan30: finance.olderThan30.length,
      topClients: finance.topClients,
    },
    policy: { role: 'OWNER', scope: 'workspace', financeVisible: true },
  }
}

function buildWorkloadAnswer(workload: ReturnType<typeof summarizeWorkload>): AiGroundedAnswer {
  const visible = compactList(workload, 7)
  const overloaded = workload.filter((item) => item.capacityScore >= 85)
  const answer = visible.length
    ? lines([
        `${overloaded.length} team member${overloaded.length === 1 ? '' : 's'} are above the 85% workload risk threshold.`,
        '',
        ...visible.map(({ member, openTasks, overdueTasks, dueSoon, doneThisMonth, capacityScore }) => {
          return `- ${member.name}: ${capacityScore}% capacity signal, ${openTasks.length} open, ${overdueTasks.length} overdue, ${dueSoon.length} due this week, ${doneThisMonth.length} completed this month`
        }),
        '',
        overloaded.length
          ? 'Recommendation: rebalance overdue and critical work from the highest-capacity people before adding new commitments.'
          : 'Recommendation: current workload looks manageable; keep an eye on tasks due this week.',
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
  const atRiskProjects = input.projectRisk.filter((item) => item.riskScore > 0).sort((a, b) => b.riskScore - a.riskScore)
  const overloaded = input.workload.filter((item) => item.capacityScore >= 85)
  const inactiveClients = input.clientHealth.filter((item) => item.client.status === 'inactive' || item.inactiveDays >= 21)
  const citations = [
    ...citeProjects(compactList(atRiskProjects.map((item) => item.project), 3)),
    ...citeTasks(compactList(input.taskSummary.overdue, 3)),
    ...citeClients(compactList(inactiveClients.map((item) => item.client), 2)),
  ]

  const risks = [
    atRiskProjects.length ? `${atRiskProjects.length} projects have delay or approval risk` : '',
    input.taskSummary.overdue.length ? `${input.taskSummary.overdue.length} tasks are overdue` : '',
    overloaded.length ? `${overloaded.length} team members are overloaded` : '',
    input.approvalQueue.length ? `${input.approvalQueue.length} deliverables need review or approval` : '',
    input.financeVisible && input.finance.overdue.length ? `${input.finance.overdue.length} invoices are overdue` : '',
    inactiveClients.length ? `${inactiveClients.length} clients need follow-up` : '',
  ].filter(Boolean)

  const answer = lines([
    'Executive operations summary',
    '',
    `- Open tasks: ${input.taskSummary.open}`,
    `- Overdue tasks: ${input.taskSummary.overdue.length}`,
    `- Projects at risk: ${atRiskProjects.length}`,
    `- Review/approval queue: ${input.approvalQueue.length}`,
    `- Overloaded team members: ${overloaded.length}`,
    input.financeVisible ? `- Revenue this month: ${formatMoney(input.finance.revenueThisMonth, input.finance.primaryCurrency)}` : '',
    input.financeVisible ? `- Outstanding invoices: ${formatMoney(input.finance.outstandingTotal, input.finance.primaryCurrency)}` : '',
    '',
    risks.length ? 'Biggest operational risks:' : 'Biggest operational risks: none detected from the current scoped records.',
    ...risks.map((risk) => `- ${risk}`),
    '',
    'Management focus today:',
    input.taskSummary.overdue.length ? '- Clear overdue tasks with deadlines already missed.' : '',
    atRiskProjects.length ? `- Review ${atRiskProjects[0].project.title}, the highest-risk project in scope.` : '',
    overloaded.length ? `- Rebalance work from ${overloaded[0].member.name}.` : '',
    input.financeVisible && input.finance.overdue.length ? '- Follow up on overdue invoices before new delivery commitments.' : '',
    input.approvalQueue.length ? '- Push pending approvals to unblock delivery and billing.' : '',
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
      projectsAtRisk: atRiskProjects.length,
      overloadedMembers: overloaded.length,
      approvalQueue: input.approvalQueue.length,
      inactiveClients: inactiveClients.length,
      revenueThisMonth: input.financeVisible ? input.finance.revenueThisMonth : null,
      outstandingInvoices: input.financeVisible ? input.finance.outstandingTotal : null,
    },
    policy: { role: 'MANAGER', scope: 'workspace' as const, financeVisible: input.financeVisible },
  }
}

function buildAutomationAnswer(): AiGroundedAnswer {
  return {
    answer:
      'Automation execution logs are not yet present in the active Prisma schema, so I cannot report failed workflow runs from real records. The safest next build step is to add AutomationRule and AutomationRun tables, then wire route handlers to emit run results for invoice.overdue, deliverable.approved, task.overdue, and project.completed events.',
    intent: 'automations',
    confidence: 'high',
    citations: [],
    quickActions: ['Create automation from instruction', 'Detect operational risks', 'Generate weekly report'],
    facts: { automationTablesAvailable: false },
    policy: { role: 'MANAGER', scope: 'workspace', financeVisible: false },
  }
}

export async function buildGroundedOperationalAnswer(input: {
  question: string
  user: AiSessionUser
  messages?: AiMessageInput[]
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

  const now = new Date()
  const context = await loadWorkspaceContext(input.user)
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
        task: activity.task.title,
        project: activity.task.project.title,
        user: activity.user.name,
        createdAt: activity.createdAt.toISOString(),
      })),
    },
    policy: {
      role,
      scope: isEmployee(input.user) ? 'assigned-work' : 'workspace',
      financeVisible,
    },
  }
}

