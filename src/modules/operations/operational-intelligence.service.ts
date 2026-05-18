import { prisma } from '@/lib/db'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'

export type IntelligenceTone = 'good' | 'watch' | 'risk' | 'critical' | 'neutral'

export type CommandCenterMetric = {
  id: string
  label: string
  value: string
  detail: string
  tone: IntelligenceTone
  href?: string
}

export type OperationalRisk = {
  id: string
  type: 'delivery' | 'approval' | 'finance' | 'workload' | 'client' | 'automation' | 'sla' | 'instrumentation'
  severity: Exclude<IntelligenceTone, 'good' | 'neutral'>
  title: string
  impact: string
  why: string
  action: string
  href?: string
}

export type AgentSignal = {
  id: string
  agent: string
  status: string
  tone: IntelligenceTone
  signal: string
  reasoning: string
  recommendedAction: string
  href?: string
}

export type OperatingLoopStage = {
  id: string
  label: string
  count: number
  state: string
  tone: IntelligenceTone
}

export type WorkloadPressure = {
  memberId: string
  name: string
  role: string
  openTasks: number
  overdueTasks: number
  dueSoonTasks: number
  criticalTasks: number
  capacityScore: number
}

export type ClientHealthSignal = {
  clientId: string
  name: string
  status: string
  healthScore: number
  inactiveDays: number
  activeProjects: number
  openInvoiceValue: number
  riskDrivers: string[]
  href: string
}

export type FinancialIntelligence = {
  financeVisible: boolean
  currency: string
  revenueThisMonth: number
  outstandingTotal: number
  overdueTotal: number
  dueSoonTotal: number
  draftPipeline: number
  revenueForecast30Days: number
  collectionRiskScore: number
  marginVisibility: 'instrumented' | 'partial' | 'missing'
  marginNote: string
}

export type OperationalGraphSnapshot = {
  nodes: number
  edges: number
  coverage: Array<{
    label: string
    count: number
  }>
}

export type ExecutiveBriefing = {
  generatedAt: string
  title: string
  summary: string
  focus: string
  healthScore: number
  tone: IntelligenceTone
  recommendedActions: string[]
}

export type OperationalCommandCenter = {
  company: {
    id: string
    name: string
    companyType: string
  } | null
  briefing: ExecutiveBriefing
  metrics: CommandCenterMetric[]
  risks: OperationalRisk[]
  agentSignals: AgentSignal[]
  operatingLoop: OperatingLoopStage[]
  workload: WorkloadPressure[]
  clientHealth: ClientHealthSignal[]
  financial: FinancialIntelligence
  graph: OperationalGraphSnapshot
}

type CommandCenterUser = {
  id: string
  role?: string | null
  companyId?: string | null
}

type JobRunRecord = {
  id: string
  queue: string
  name: string
  status: string
  attempts: number
  maxAttempts: number
  entityType: string | null
  entityId: string | null
  error: string | null
  createdAt: Date
  finishedAt: Date | null
}

const HIGH_PRIORITIES = ['HIGH', 'CRITICAL']

function normalizeRole(role?: string | null) {
  return role?.trim().toUpperCase() ?? 'EMPLOYEE'
}

function canViewFinance(user: CommandCenterUser) {
  const role = normalizeRole(user.role)
  return role === 'OWNER' || role === 'MANAGER'
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function daysBetween(from: Date, to: Date) {
  const ms = startOfDay(from).getTime() - startOfDay(to).getTime()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

function percent(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

function toneForScore(score: number): IntelligenceTone {
  if (score >= 88) return 'good'
  if (score >= 72) return 'watch'
  if (score >= 52) return 'risk'
  return 'critical'
}

function riskTone(score: number): Exclude<IntelligenceTone, 'good' | 'neutral'> {
  if (score >= 75) return 'critical'
  if (score >= 48) return 'risk'
  return 'watch'
}

function moneyLabel(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`
}

function projectHref(id: string) {
  return `/dashboard/admin/projects/${id}`
}

function clientHref(id: string) {
  return `/dashboard/admin/clients/${id}`
}

function invoicesHref() {
  return '/dashboard/admin/invoices'
}

function tasksHref() {
  return '/dashboard/admin/tasks'
}

async function loadJobRuns(companyId: string): Promise<JobRunRecord[]> {
  try {
    return await prisma.jobRun.findMany({
      where: { companyId },
      select: {
        id: true,
        queue: true,
        name: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        entityType: true,
        entityId: true,
        error: true,
        createdAt: true,
        finishedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    })
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) return []
    throw error
  }
}

function emptyCommandCenter(): OperationalCommandCenter {
  const generatedAt = new Date().toISOString()

  return {
    company: null,
    briefing: {
      generatedAt,
      title: 'Workspace intelligence unavailable',
      summary: 'Connect this user to an active workspace before TASKIT OS can calculate operational risk, delivery health, finance exposure, and client health.',
      focus: 'Workspace setup',
      healthScore: 0,
      tone: 'neutral',
      recommendedActions: ['Assign the user to a workspace', 'Confirm the company account is active'],
    },
    metrics: [],
    risks: [],
    agentSignals: [],
    operatingLoop: [],
    workload: [],
    clientHealth: [],
    financial: {
      financeVisible: false,
      currency: 'USD',
      revenueThisMonth: 0,
      outstandingTotal: 0,
      overdueTotal: 0,
      dueSoonTotal: 0,
      draftPipeline: 0,
      revenueForecast30Days: 0,
      collectionRiskScore: 0,
      marginVisibility: 'missing',
      marginNote: 'No active workspace is available.',
    },
    graph: { nodes: 0, edges: 0, coverage: [] },
  }
}

export async function buildOperationalCommandCenter(user: CommandCenterUser): Promise<OperationalCommandCenter> {
  if (!user.companyId) return emptyCommandCenter()

  const companyId = user.companyId
  const financeVisible = canViewFinance(user)
  const now = new Date()
  const monthStart = startOfMonth(now)
  const nextWeek = addDays(now, 7)
  const next30Days = addDays(now, 30)
  const staleCutoff = addDays(now, -7)

  const [
    company,
    tasks,
    projects,
    deliverables,
    invoices,
    clients,
    members,
    briefs,
    jobRuns,
    activityCount,
    aiMemoryCount,
    searchIndexCount,
  ] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, companyType: true },
    }),
    prisma.task.findMany({
      where: { project: { companyId } },
      select: {
        id: true,
        title: true,
        priority: true,
        deadline: true,
        stage: true,
        progress: true,
        updatedAt: true,
        createdAt: true,
        assigneeId: true,
        projectId: true,
        assignee: { select: { id: true, name: true, role: true } },
        project: {
          select: {
            id: true,
            title: true,
            clientId: true,
            clientName: true,
            updatedAt: true,
          },
        },
      },
      orderBy: [{ deadline: 'asc' }, { updatedAt: 'desc' }],
      take: 600,
    }),
    prisma.project.findMany({
      where: { companyId },
      select: {
        id: true,
        title: true,
        clientId: true,
        clientName: true,
        createdAt: true,
        updatedAt: true,
        manager: { select: { id: true, name: true } },
        client: { select: { id: true, companyName: true, status: true } },
        tasks: {
          select: {
            id: true,
            title: true,
            stage: true,
            priority: true,
            deadline: true,
            updatedAt: true,
            assigneeId: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 40,
        },
        deliverables: {
          select: {
            id: true,
            title: true,
            status: true,
            approvalState: true,
            dueAt: true,
            deliveredAt: true,
            revisionCount: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 20,
        },
        invoices: financeVisible
          ? {
              select: {
                id: true,
                status: true,
                total: true,
                currency: true,
                dueDate: true,
                paidAt: true,
              },
              take: 10,
            }
          : false,
      },
      orderBy: { updatedAt: 'desc' },
      take: 180,
    }),
    prisma.deliverable.findMany({
      where: { companyId },
      select: {
        id: true,
        title: true,
        status: true,
        approvalState: true,
        dueAt: true,
        deliveredAt: true,
        revisionCount: true,
        updatedAt: true,
        campaignId: true,
        campaign: { select: { id: true, title: true, clientId: true, clientName: true } },
      },
      orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
      take: 250,
    }),
    financeVisible
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
            sentAt: true,
            paidAt: true,
            total: true,
            campaignId: true,
            createdAt: true,
          },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
          take: 400,
        })
      : Promise.resolve([]),
    prisma.client.findMany({
      where: { companyId },
      select: {
        id: true,
        companyName: true,
        status: true,
        updatedAt: true,
        projects: {
          select: { id: true, title: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 12,
        },
        invoices: financeVisible
          ? {
              select: {
                id: true,
                status: true,
                total: true,
                currency: true,
                dueDate: true,
                paidAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 24,
            }
          : false,
        activities: {
          select: { id: true, type: true, title: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 6,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 180,
    }),
    prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        role: true,
        assignedTasks: {
          where: { project: { companyId } },
          select: { id: true, stage: true, priority: true, deadline: true, updatedAt: true },
        },
      },
      orderBy: { name: 'asc' },
      take: 120,
    }),
    prisma.brief.findMany({
      where: { companyId },
      select: {
        id: true,
        title: true,
        status: true,
        campaignId: true,
        clientId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 180,
    }),
    loadJobRuns(companyId),
    prisma.activity.count({ where: { companyId } }),
    prisma.aiMemory.count({ where: { companyId } }),
    prisma.searchIndex.count({ where: { companyId } }),
  ])

  const openTasks = tasks.filter((task) => task.stage !== 'DONE')
  const overdueTasks = openTasks.filter((task) => task.deadline && task.deadline < now)
  const staleTasks = openTasks.filter((task) => task.updatedAt < staleCutoff)
  const reviewTasks = openTasks.filter((task) => task.stage === 'REVIEW')
  const unassignedTasks = openTasks.filter((task) => !task.assigneeId)

  const approvalQueue = deliverables.filter(
    (deliverable) =>
      deliverable.status === 'CLIENT_REVIEW' ||
      deliverable.status === 'INTERNAL_REVIEW' ||
      deliverable.approvalState === 'PENDING' ||
      deliverable.approvalState === 'CHANGES_REQUESTED'
  )
  const overdueApprovals = approvalQueue.filter((deliverable) => deliverable.dueAt && deliverable.dueAt < now)
  const deliveredThisMonth = deliverables.filter((deliverable) => deliverable.deliveredAt && deliverable.deliveredAt >= monthStart)
  const revisionPressure = deliverables.filter((deliverable) => deliverable.revisionCount >= 3)

  const projectRisk = projects
    .map((project) => {
      const projectOpenTasks = project.tasks.filter((task) => task.stage !== 'DONE')
      const projectOverdueTasks = projectOpenTasks.filter((task) => task.deadline && task.deadline < now)
      const projectReviewTasks = projectOpenTasks.filter((task) => task.stage === 'REVIEW')
      const projectOverdueDeliverables = project.deliverables.filter(
        (deliverable) => deliverable.dueAt && deliverable.dueAt < now && !deliverable.deliveredAt
      )
      const projectWaitingApprovals = project.deliverables.filter(
        (deliverable) =>
          deliverable.status === 'CLIENT_REVIEW' ||
          deliverable.approvalState === 'PENDING' ||
          deliverable.approvalState === 'CHANGES_REQUESTED'
      )
      const projectDoneTasks = project.tasks.filter((task) => task.stage === 'DONE').length
      const completionRate = percent(projectDoneTasks, project.tasks.length)
      const isStalled = projectOpenTasks.length > 0 && project.updatedAt < addDays(now, -14)
      const invoiceExposure =
        'invoices' in project && Array.isArray(project.invoices)
          ? project.invoices.filter((invoice) => invoice.status === 'overdue' || (invoice.dueDate && invoice.dueDate < now && invoice.status !== 'paid')).length
          : 0
      const score = clamp(
        projectOverdueTasks.length * 22 +
          projectOverdueDeliverables.length * 18 +
          projectWaitingApprovals.length * 8 +
          projectReviewTasks.length * 5 +
          invoiceExposure * 10 +
          (isStalled ? 12 : 0) +
          (completionRate < 35 && projectOpenTasks.length > 4 ? 8 : 0) +
          (projectOpenTasks.length > 12 ? 8 : 0)
      )

      return {
        project,
        score,
        severity: riskTone(score),
        completionRate,
        openTasks: projectOpenTasks.length,
        overdueTasks: projectOverdueTasks.length,
        overdueDeliverables: projectOverdueDeliverables.length,
        waitingApprovals: projectWaitingApprovals.length,
        stalledDays: isStalled ? daysBetween(now, project.updatedAt) : 0,
      }
    })
    .sort((a, b) => b.score - a.score)

  const atRiskProjects = projectRisk.filter((item) => item.score >= 28)
  const highRiskProjects = projectRisk.filter((item) => item.score >= 55)

  const workload = members
    .map((member): WorkloadPressure => {
      const memberOpen = member.assignedTasks.filter((task) => task.stage !== 'DONE')
      const memberOverdue = memberOpen.filter((task) => task.deadline && task.deadline < now)
      const memberDueSoon = memberOpen.filter((task) => task.deadline && task.deadline >= now && task.deadline < nextWeek)
      const memberCritical = memberOpen.filter((task) => HIGH_PRIORITIES.includes(task.priority))
      const memberStale = memberOpen.filter((task) => task.updatedAt < staleCutoff)
      const capacityScore = clamp(
        memberOpen.length * 12 +
          memberOverdue.length * 18 +
          memberCritical.length * 10 +
          memberDueSoon.length * 5 +
          memberStale.length * 4
      )

      return {
        memberId: member.id,
        name: member.name,
        role: member.role,
        openTasks: memberOpen.length,
        overdueTasks: memberOverdue.length,
        dueSoonTasks: memberDueSoon.length,
        criticalTasks: memberCritical.length,
        capacityScore,
      }
    })
    .sort((a, b) => b.capacityScore - a.capacityScore)

  const overloadedMembers = workload.filter((member) => member.capacityScore >= 85)

  const primaryCurrency = invoices[0]?.currency ?? 'USD'
  const paidThisMonth = invoices.filter((invoice) => invoice.status === 'paid' && invoice.paidAt && invoice.paidAt >= monthStart)
  const sentInvoices = invoices.filter((invoice) => invoice.status === 'sent')
  const draftInvoices = invoices.filter((invoice) => invoice.status === 'draft')
  const overdueInvoices = invoices.filter(
    (invoice) => invoice.status === 'overdue' || (invoice.status !== 'paid' && invoice.dueDate && invoice.dueDate < now)
  )
  const dueSoonInvoices = sentInvoices.filter((invoice) => invoice.dueDate && invoice.dueDate >= now && invoice.dueDate < nextWeek)
  const forecastInvoices = invoices.filter(
    (invoice) =>
      invoice.status !== 'paid' &&
      invoice.status !== 'overdue' &&
      ((invoice.dueDate && invoice.dueDate <= next30Days) || invoice.status === 'draft')
  )
  const olderThan30Invoices = overdueInvoices.filter((invoice) => invoice.dueDate && daysBetween(now, invoice.dueDate) > 30)
  const revenueThisMonth = paidThisMonth.reduce((sum, invoice) => sum + Number(invoice.total), 0)
  const outstandingTotal = [...sentInvoices, ...overdueInvoices].reduce((sum, invoice) => sum + Number(invoice.total), 0)
  const overdueTotal = overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0)
  const dueSoonTotal = dueSoonInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0)
  const draftPipeline = draftInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0)
  const revenueForecast30Days = forecastInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0)
  const collectionRiskScore = clamp(
    overdueInvoices.length * 12 +
      olderThan30Invoices.length * 18 +
      (outstandingTotal ? (overdueTotal / outstandingTotal) * 58 : 0)
  )

  const financial: FinancialIntelligence = {
    financeVisible,
    currency: primaryCurrency,
    revenueThisMonth: financeVisible ? revenueThisMonth : 0,
    outstandingTotal: financeVisible ? outstandingTotal : 0,
    overdueTotal: financeVisible ? overdueTotal : 0,
    dueSoonTotal: financeVisible ? dueSoonTotal : 0,
    draftPipeline: financeVisible ? draftPipeline : 0,
    revenueForecast30Days: financeVisible ? revenueForecast30Days : 0,
    collectionRiskScore: financeVisible ? collectionRiskScore : 0,
    marginVisibility: 'partial',
    marginNote: financeVisible
      ? 'Revenue and collection risk are instrumented. True margin requires labor cost, expense, and time-entry capture.'
      : 'Financial intelligence is restricted for this role.',
  }

  const clientHealth = clients
    .map((client): ClientHealthSignal => {
      const latestActivity = client.activities[0]?.createdAt ?? client.projects[0]?.updatedAt ?? client.updatedAt
      const inactiveDays = daysBetween(now, latestActivity)
      const clientInvoices = 'invoices' in client && Array.isArray(client.invoices) ? client.invoices : []
      const openInvoiceValue = clientInvoices
        .filter((invoice) => invoice.status === 'sent' || invoice.status === 'overdue' || (invoice.dueDate && invoice.dueDate < now && invoice.status !== 'paid'))
        .reduce((sum, invoice) => sum + Number(invoice.total), 0)
      const hasOverdueInvoice = clientInvoices.some(
        (invoice) => invoice.status === 'overdue' || (invoice.dueDate && invoice.dueDate < now && invoice.status !== 'paid')
      )
      const riskDrivers = [
        client.status === 'inactive' ? 'Inactive account' : '',
        inactiveDays >= 21 ? `${inactiveDays} days without activity` : '',
        hasOverdueInvoice ? 'Payment exposure' : '',
        client.projects.length === 0 ? 'No active delivery history' : '',
      ].filter(Boolean)
      const healthScore = clamp(
        100 -
          (client.status === 'inactive' ? 35 : 0) -
          (inactiveDays >= 45 ? 30 : inactiveDays >= 21 ? 18 : inactiveDays >= 14 ? 8 : 0) -
          (hasOverdueInvoice ? 18 : openInvoiceValue > 0 ? 8 : 0) -
          (client.projects.length === 0 ? 10 : 0)
      )

      return {
        clientId: client.id,
        name: client.companyName,
        status: client.status,
        healthScore,
        inactiveDays,
        activeProjects: client.projects.length,
        openInvoiceValue: financeVisible ? openInvoiceValue : 0,
        riskDrivers: riskDrivers.length ? riskDrivers : ['Healthy cadence'],
        href: clientHref(client.id),
      }
    })
    .sort((a, b) => a.healthScore - b.healthScore)

  const unhealthyClients = clientHealth.filter((client) => client.healthScore < 70)
  const failedJobs = jobRuns.filter((job) => job.status === 'FAILED' || job.status === 'DEAD_LETTER')
  const deferredJobs = jobRuns.filter((job) => job.status === 'DEFERRED')
  const activeJobs = jobRuns.filter((job) => job.status === 'QUEUED' || job.status === 'ACTIVE')
  const automationFailureRate = percent(failedJobs.length, jobRuns.length)
  const slaViolations = overdueTasks.length + overdueApprovals.length

  const risks: OperationalRisk[] = [
    ...atRiskProjects.slice(0, 5).map((item): OperationalRisk => ({
      id: `project-${item.project.id}`,
      type: 'delivery',
      severity: item.severity,
      title: `${item.project.title} is carrying delivery risk`,
      impact: `${plural(item.overdueTasks, 'overdue task')} and ${plural(item.waitingApprovals, 'approval blocker')} can slow delivery.`,
      why: item.stalledDays
        ? `The campaign has open work and has not moved for ${item.stalledDays} days.`
        : `Risk score ${item.score}/100 from overdue work, approvals, review load, and completion pace.`,
      action: 'Open the campaign, clear the oldest blocker, and publish a recovery owner.',
      href: projectHref(item.project.id),
    })),
    ...(overdueApprovals.length
      ? [
          {
            id: 'approvals-overdue',
            type: 'approval',
            severity: riskTone(clamp(overdueApprovals.length * 18)),
            title: 'Approval queue is blocking delivery-to-cash',
            impact: `${plural(overdueApprovals.length, 'deliverable')} are past due in review or approval.`,
            why: 'Approval delays prevent final delivery, invoice confidence, and clean client accountability.',
            action: 'Escalate overdue approvals and send client-facing decision summaries.',
            href: '/dashboard/admin/projects',
          } satisfies OperationalRisk,
        ]
      : []),
    ...(financeVisible && overdueInvoices.length
      ? [
          {
            id: 'finance-collection-risk',
            type: 'finance',
            severity: riskTone(collectionRiskScore),
            title: 'Cash exposure needs finance follow-up',
            impact: `${moneyLabel(overdueTotal, primaryCurrency)} is overdue across ${plural(overdueInvoices.length, 'invoice')}.`,
            why: `${olderThan30Invoices.length} unpaid invoices are older than 30 days.`,
            action: 'Prioritize collection by invoice age, then connect delays to delivery or approval blockers.',
            href: invoicesHref(),
          } satisfies OperationalRisk,
        ]
      : []),
    ...(overloadedMembers.length
      ? [
          {
            id: 'resource-pressure',
            type: 'workload',
            severity: riskTone(clamp(overloadedMembers.length * 25)),
            title: 'Workload imbalance is creating execution risk',
            impact: `${plural(overloadedMembers.length, 'team member')} crossed the 85% pressure threshold.`,
            why: 'Capacity score combines open work, overdue work, critical priority, due-soon deadlines, and stale assignments.',
            action: 'Reassign overdue and critical work before accepting new delivery commitments.',
            href: '/dashboard/admin/employees',
          } satisfies OperationalRisk,
        ]
      : []),
    ...(unhealthyClients.length
      ? [
          {
            id: 'client-health-risk',
            type: 'client',
            severity: riskTone(clamp(unhealthyClients.length * 16)),
            title: 'Client health needs proactive retention work',
            impact: `${plural(unhealthyClients.length, 'client')} have weak health signals.`,
            why: 'Inactive accounts, limited recent activity, and payment exposure lower retention confidence.',
            action: 'Schedule account check-ins for the lowest-health clients first.',
            href: '/dashboard/admin/clients',
          } satisfies OperationalRisk,
        ]
      : []),
    ...(failedJobs.length || deferredJobs.length
      ? [
          {
            id: 'automation-observability',
            type: 'automation',
            severity: failedJobs.length ? 'risk' : 'watch',
            title: 'Automation execution needs operator visibility',
            impact: `${failedJobs.length} failed and ${deferredJobs.length} deferred operational jobs are visible.`,
            why: 'Automation must be observable before it can be trusted for delivery, finance, and AI actions.',
            action: 'Review failed runs and configure Redis queues for dependable background execution.',
          } satisfies OperationalRisk,
        ]
      : []),
    ...(financeVisible
      ? [
          {
            id: 'margin-instrumentation',
            type: 'instrumentation',
            severity: 'watch',
            title: 'Margin intelligence needs labor-cost instrumentation',
            impact: 'TASKIT can connect delivery and revenue now, but true profitability still needs time, cost, and expense capture.',
            why: 'The active schema has invoices and work records, but no time-entry or labor-cost model.',
            action: 'Add time entries and role cost rates before using margin as a management KPI.',
          } satisfies OperationalRisk,
        ]
      : []),
  ].sort((a, b) => {
    const order = { critical: 0, risk: 1, watch: 2 }
    return order[a.severity] - order[b.severity]
  })

  const healthScore = clamp(
    100 -
      overdueTasks.length * 3 -
      overdueApprovals.length * 5 -
      highRiskProjects.length * 9 -
      overloadedMembers.length * 7 -
      unhealthyClients.length * 3 -
      failedJobs.length * 6 -
      collectionRiskScore * 0.12
  )
  const briefingTone = toneForScore(healthScore)
  const topRisk = risks[0]
  const briefing: ExecutiveBriefing = {
    generatedAt: now.toISOString(),
    title: topRisk ? 'Executive command briefing' : 'Operations are stable',
    summary: topRisk
      ? `${topRisk.title}. ${topRisk.impact}`
      : 'No critical operational risks are visible from current workspace records.',
    focus: topRisk?.action ?? 'Keep approvals short, keep delivery current, and keep client activity fresh.',
    healthScore,
    tone: briefingTone,
    recommendedActions: risks.length
      ? risks.slice(0, 5).map((risk) => risk.action)
      : ['Review due-soon work', 'Confirm this week approvals', 'Keep client updates current'],
  }

  const metrics: CommandCenterMetric[] = [
    {
      id: 'delivery-risk',
      label: 'Delivery risk',
      value: `${atRiskProjects.length}`,
      detail: `${percent(atRiskProjects.length, projects.length)}% of campaigns need management attention`,
      tone: atRiskProjects.length ? riskTone(clamp(atRiskProjects.length * 18)) : 'good',
      href: '/dashboard/admin/projects',
    },
    {
      id: 'approval-latency',
      label: 'Overdue approvals',
      value: `${overdueApprovals.length}`,
      detail: `${approvalQueue.length} deliverables are in review or approval`,
      tone: overdueApprovals.length ? riskTone(clamp(overdueApprovals.length * 22)) : 'good',
      href: '/dashboard/admin/projects',
    },
    {
      id: 'cash-exposure',
      label: 'Cash exposure',
      value: financeVisible ? moneyLabel(overdueTotal, primaryCurrency) : 'Restricted',
      detail: financeVisible ? `${moneyLabel(outstandingTotal, primaryCurrency)} outstanding` : 'Finance visibility is limited for this role',
      tone: financeVisible ? (overdueTotal ? riskTone(collectionRiskScore) : 'good') : 'neutral',
      href: invoicesHref(),
    },
    {
      id: 'utilization-pressure',
      label: 'Utilization pressure',
      value: `${overloadedMembers.length}`,
      detail: `${Math.round(workload.reduce((sum, member) => sum + member.capacityScore, 0) / Math.max(workload.length, 1))}% average pressure signal`,
      tone: overloadedMembers.length ? riskTone(clamp(overloadedMembers.length * 25)) : 'good',
      href: '/dashboard/admin/employees',
    },
    {
      id: 'client-health',
      label: 'Client health',
      value: `${unhealthyClients.length}`,
      detail: `${clients.length} client accounts monitored`,
      tone: unhealthyClients.length ? riskTone(clamp(unhealthyClients.length * 16)) : 'good',
      href: '/dashboard/admin/clients',
    },
    {
      id: 'automation-health',
      label: 'Automation health',
      value: `${failedJobs.length}`,
      detail: jobRuns.length ? `${automationFailureRate}% failure rate, ${activeJobs.length} active or queued` : 'No job runs recorded yet',
      tone: failedJobs.length ? 'risk' : deferredJobs.length ? 'watch' : 'good',
    },
    {
      id: 'sla-violations',
      label: 'SLA violations',
      value: `${slaViolations}`,
      detail: `${overdueTasks.length} overdue tasks, ${overdueApprovals.length} overdue approvals`,
      tone: slaViolations ? riskTone(clamp(slaViolations * 7)) : 'good',
      href: tasksHref(),
    },
    {
      id: 'revenue-forecast',
      label: 'Revenue forecast',
      value: financeVisible ? moneyLabel(revenueForecast30Days, primaryCurrency) : 'Restricted',
      detail: financeVisible ? `Next 30 days plus draft pipeline ${moneyLabel(draftPipeline, primaryCurrency)}` : 'Owner or Manager role required',
      tone: financeVisible ? 'neutral' : 'neutral',
      href: invoicesHref(),
    },
  ]

  const agentSignals: AgentSignal[] = [
    {
      id: 'executive',
      agent: 'Executive Intelligence Agent',
      status: `${healthScore}% health`,
      tone: briefingTone,
      signal: topRisk?.title ?? 'Portfolio stable',
      reasoning: topRisk?.why ?? 'No high-signal operational bottleneck is visible right now.',
      recommendedAction: briefing.focus,
      href: topRisk?.href,
    },
    {
      id: 'operations',
      agent: 'Operations Agent',
      status: `${atRiskProjects.length} at risk`,
      tone: atRiskProjects.length ? riskTone(clamp(atRiskProjects.length * 18)) : 'good',
      signal: highRiskProjects[0]?.project.title ?? 'Delivery cadence healthy',
      reasoning: atRiskProjects.length
        ? 'Risk combines overdue work, approval blockers, stalled campaigns, and review load.'
        : 'No campaign currently crosses the delivery-risk threshold.',
      recommendedAction: atRiskProjects[0] ? 'Open the riskiest campaign and assign a recovery owner.' : 'Keep reviewing due-soon work daily.',
      href: atRiskProjects[0] ? projectHref(atRiskProjects[0].project.id) : '/dashboard/admin/projects',
    },
    {
      id: 'approval',
      agent: 'Approval Coordinator Agent',
      status: `${overdueApprovals.length} overdue`,
      tone: overdueApprovals.length ? riskTone(clamp(overdueApprovals.length * 22)) : approvalQueue.length ? 'watch' : 'good',
      signal: approvalQueue.length ? `${plural(approvalQueue.length, 'deliverable')} waiting` : 'Approval lane clear',
      reasoning: 'Deliverables in internal review, client review, pending, or changes-requested states block delivery certainty.',
      recommendedAction: overdueApprovals.length ? 'Escalate the oldest overdue approval.' : 'Keep approval decisions same-day.',
      href: '/dashboard/admin/projects',
    },
    {
      id: 'finance',
      agent: 'Finance Agent',
      status: financeVisible ? moneyLabel(overdueTotal, primaryCurrency) : 'Restricted',
      tone: financeVisible ? (overdueTotal ? riskTone(collectionRiskScore) : 'good') : 'neutral',
      signal: financeVisible ? `${moneyLabel(outstandingTotal, primaryCurrency)} outstanding` : 'Finance context hidden',
      reasoning: financeVisible
        ? 'Collection risk uses overdue value, invoice age, and outstanding concentration.'
        : 'This role does not receive finance exposure or revenue details.',
      recommendedAction: financeVisible ? 'Chase oldest unpaid invoices and connect blockers to client approvals.' : 'Ask an Owner or Manager for finance context.',
      href: invoicesHref(),
    },
    {
      id: 'resource-planning',
      agent: 'Resource Planning Agent',
      status: `${overloadedMembers.length} overloaded`,
      tone: overloadedMembers.length ? 'risk' : workload.some((member) => member.capacityScore >= 70) ? 'watch' : 'good',
      signal: overloadedMembers[0]?.name ?? 'Capacity balanced',
      reasoning: 'Capacity pressure reflects open assignments, due-soon deadlines, critical priority, overdue work, and stale tasks.',
      recommendedAction: overloadedMembers.length ? 'Move overdue critical tasks off the highest-pressure person.' : 'Keep capacity under review before accepting new work.',
      href: '/dashboard/admin/employees',
    },
    {
      id: 'client-success',
      agent: 'Client Success Agent',
      status: `${unhealthyClients.length} weak`,
      tone: unhealthyClients.length ? 'risk' : 'good',
      signal: unhealthyClients[0]?.name ?? 'Client base healthy',
      reasoning: 'Client health uses activity recency, inactive status, project volume, and payment exposure.',
      recommendedAction: unhealthyClients.length ? 'Schedule a check-in with the lowest-health account.' : 'Keep client updates flowing through the portal.',
      href: unhealthyClients[0]?.href ?? '/dashboard/admin/clients',
    },
    {
      id: 'creative-director',
      agent: 'Creative Director Agent',
      status: `${revisionPressure.length} revision-heavy`,
      tone: revisionPressure.length ? 'watch' : 'good',
      signal: reviewTasks.length ? `${plural(reviewTasks.length, 'task')} in review` : 'Review load normal',
      reasoning: 'Revision pressure and review queues are leading indicators for creative bottlenecks and scope creep.',
      recommendedAction: revisionPressure.length ? 'Review revision-heavy deliverables for scope or feedback quality.' : 'Keep review notes clear and decision-oriented.',
      href: '/dashboard/admin/projects',
    },
    {
      id: 'automation',
      agent: 'Automation Agent',
      status: `${failedJobs.length} failed`,
      tone: failedJobs.length ? 'risk' : deferredJobs.length ? 'watch' : 'good',
      signal: jobRuns.length ? `${jobRuns.length} job runs observed` : 'Automation logs pending',
      reasoning: 'Reliable automations require visible run history, retries, failures, and deferred states.',
      recommendedAction: failedJobs.length ? 'Inspect failed jobs before enabling more automated escalation.' : 'Use job history to graduate automations into trusted workflows.',
    },
  ]

  const draftBriefs = briefs.filter((brief) => brief.status === 'DRAFT')
  const approvedBriefs = briefs.filter((brief) => brief.status === 'APPROVED')
  const approvedUndelivered = deliverables.filter((deliverable) => deliverable.approvalState === 'APPROVED' && !deliverable.deliveredAt)

  const operatingLoop: OperatingLoopStage[] = [
    { id: 'request', label: 'Client Request', count: draftBriefs.length, state: draftBriefs.length ? 'Needs triage' : 'Quiet', tone: draftBriefs.length ? 'watch' : 'good' },
    { id: 'scope', label: 'Scope', count: approvedBriefs.length, state: approvedBriefs.length ? 'Approved briefs' : 'No approved briefs', tone: approvedBriefs.length ? 'good' : 'neutral' },
    { id: 'planning', label: 'Planning', count: openTasks.filter((task) => task.stage === 'TODO').length, state: 'Ready work', tone: 'neutral' },
    { id: 'work', label: 'Work', count: openTasks.filter((task) => task.stage === 'IN_PROGRESS').length, state: 'In production', tone: 'neutral' },
    { id: 'review', label: 'Review', count: reviewTasks.length, state: reviewTasks.length ? 'Internal review' : 'Clear', tone: reviewTasks.length > 8 ? 'watch' : 'good' },
    { id: 'approval', label: 'Approval', count: approvalQueue.length, state: overdueApprovals.length ? 'Overdue' : 'Waiting', tone: overdueApprovals.length ? 'risk' : approvalQueue.length ? 'watch' : 'good' },
    { id: 'delivery', label: 'Delivery', count: approvedUndelivered.length, state: approvedUndelivered.length ? 'Ready to deliver' : 'Synced', tone: approvedUndelivered.length ? 'watch' : 'good' },
    { id: 'invoice', label: 'Invoice', count: draftInvoices.length + sentInvoices.length, state: financeVisible ? 'Revenue workflow' : 'Restricted', tone: draftInvoices.length ? 'watch' : 'neutral' },
    { id: 'payment', label: 'Payment', count: overdueInvoices.length, state: overdueInvoices.length ? 'Collection risk' : 'Current', tone: overdueInvoices.length ? 'risk' : 'good' },
    { id: 'margin', label: 'Margin', count: deliveredThisMonth.length, state: 'Needs cost data', tone: 'watch' },
    { id: 'insight', label: 'Insight', count: activityCount, state: 'Activity memory', tone: activityCount ? 'good' : 'neutral' },
    { id: 'automation', label: 'Automation', count: jobRuns.length, state: failedJobs.length ? 'Failures visible' : 'Observable', tone: failedJobs.length ? 'risk' : jobRuns.length ? 'good' : 'watch' },
    { id: 'retention', label: 'Retention', count: unhealthyClients.length, state: unhealthyClients.length ? 'Needs follow-up' : 'Healthy', tone: unhealthyClients.length ? 'risk' : 'good' },
  ]

  const graph: OperationalGraphSnapshot = {
    nodes:
      clients.length +
      projects.length +
      briefs.length +
      deliverables.length +
      tasks.length +
      invoices.length +
      members.length +
      jobRuns.length +
      aiMemoryCount +
      searchIndexCount,
    edges:
      tasks.length * 2 +
      deliverables.length * 2 +
      invoices.length +
      briefs.length +
      clients.reduce((sum, client) => sum + client.projects.length, 0) +
      activityCount,
    coverage: [
      { label: 'Clients', count: clients.length },
      { label: 'Campaigns', count: projects.length },
      { label: 'Briefs', count: briefs.length },
      { label: 'Deliverables', count: deliverables.length },
      { label: 'Tasks', count: tasks.length },
      { label: 'Invoices', count: invoices.length },
      { label: 'Activities', count: activityCount },
      { label: 'AI memory', count: aiMemoryCount },
      { label: 'Search index', count: searchIndexCount },
      { label: 'Job runs', count: jobRuns.length },
    ],
  }

  const dataQualityRisks = [
    unassignedTasks.length ? `${plural(unassignedTasks.length, 'open task')} unassigned` : '',
    staleTasks.length ? `${plural(staleTasks.length, 'open task')} stale` : '',
    !activityCount ? 'No activity history captured yet' : '',
  ].filter(Boolean)
  if (dataQualityRisks.length) {
    risks.push({
      id: 'operational-memory-quality',
      type: 'instrumentation',
      severity: 'watch',
      title: 'Operational memory needs cleaner inputs',
      impact: dataQualityRisks.join(', '),
      why: 'AI operations becomes stronger when every assignment, activity, and owner is captured as structured history.',
      action: 'Assign owners to open work and keep task movement inside TASKIT OS.',
      href: tasksHref(),
    })
  }

  return {
    company: company
      ? {
          id: company.id,
          name: company.name,
          companyType: company.companyType,
        }
      : null,
    briefing,
    metrics,
    risks: risks.slice(0, 10),
    agentSignals,
    operatingLoop,
    workload: workload.slice(0, 8),
    clientHealth: clientHealth.slice(0, 8),
    financial,
    graph,
  }
}
