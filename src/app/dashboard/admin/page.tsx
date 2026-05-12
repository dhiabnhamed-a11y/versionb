'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useLocale } from '@/components/i18n/LocaleProvider'
import { getCompanyTypeCopy, isAgencyCompanyType, normalizeCompanyType } from '@/lib/company-types'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CheckSquare,
  CircleDollarSign,
  ClipboardList,
  FolderKanban,
  Gauge,
  GitBranch,
  Plus,
  ShieldCheck,
  Sparkles,
  TimerReset,
  UploadCloud,
  Users,
  Zap,
} from 'lucide-react'

interface Stats {
  totalTasks: number
  doneTasks: number
  inProgressTasks: number
  reviewTasks: number
  todoTasks: number
  overdueTasks: number
  totalEmployees: number
  totalUsers: number
  activeUsers: number
  totalProjects: number
  completionRate: number
  roomCount: number
  submissionCount: number
  companyType?: string
  performance: { name: string; done: number; total: number; score: number }[]
  teamPerformance?: { name: string; done: number; total: number; score: number }[]
  activitySeries?: { date: string; label: string; created: number; completed: number }[]
  taskStageBreakdown?: { name: string; value: number; stage: string; color: string }[]
  rolesDistribution?: { name: string; value: number }[]
  recentActivity?: {
    id: string
    action: string
    createdAt: string
    user: { name: string; role?: string; avatar?: string | null }
    task: { title: string; stage: string; project: { title: string } }
  }[]
  growth?: {
    users: number
    activeUsers: number
    projects: number
    tasks: number
    completedTasks: number
  }
  comparison?: {
    thisWeek: { users: number; activeUsers: number; projects: number; tasks: number; completedTasks: number }
    lastWeek: { users: number; activeUsers: number; projects: number; tasks: number; completedTasks: number }
  }
}

const DASHBOARD_REALTIME_EVENTS = [
  'task_created',
  'task_updated',
  'task_deleted',
  'task_submission_created',
  'project_created',
  'project_updated',
  'room_created',
  'project_category_created',
  'client_created',
  'client_updated',
  'invoice_created',
  'invoice_updated',
  'invoice_deleted',
  'comment_created',
  'employee_invited',
  'user_online',
  'user_offline',
] as const

type IntelligenceTone = 'good' | 'watch' | 'risk' | 'critical' | 'neutral'

type CommandCenterMetric = {
  id: string
  label: string
  value: string
  detail: string
  tone: IntelligenceTone
  href?: string
}

type OperationalRisk = {
  id: string
  type: string
  severity: Exclude<IntelligenceTone, 'good' | 'neutral'>
  title: string
  impact: string
  why: string
  action: string
  href?: string
}

type AgentSignal = {
  id: string
  agent: string
  status: string
  tone: IntelligenceTone
  signal: string
  reasoning: string
  recommendedAction: string
  href?: string
}

type OperatingLoopStage = {
  id: string
  label: string
  count: number
  state: string
  tone: IntelligenceTone
}

type OperationalCommandCenter = {
  briefing: {
    generatedAt: string
    title: string
    summary: string
    focus: string
    healthScore: number
    tone: IntelligenceTone
    recommendedActions: string[]
  }
  metrics: CommandCenterMetric[]
  risks: OperationalRisk[]
  agentSignals: AgentSignal[]
  operatingLoop: OperatingLoopStage[]
  graph: {
    nodes: number
    edges: number
    coverage: { label: string; count: number }[]
  }
  financial: {
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
}

function ChartLoadingState({ label = 'Loading chart' }: { label?: string }) {
  return (
    <div className="flex h-[250px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="loading-shimmer h-4 w-36 rounded-full" aria-label={label} />
    </div>
  )
}

const ActivityLineChart = dynamic(
  () => import('@/components/dashboard/AdminCharts').then((module) => module.ActivityLineChart),
  {
    ssr: false,
    loading: () => <ChartLoadingState label="Loading activity chart" />,
  }
)

const StatusBarChart = dynamic(
  () => import('@/components/dashboard/AdminCharts').then((module) => module.StatusBarChart),
  {
    ssr: false,
    loading: () => <ChartLoadingState label="Loading status chart" />,
  }
)

const RolesPieChart = dynamic(
  () => import('@/components/dashboard/AdminCharts').then((module) => module.RolesPieChart),
  {
    ssr: false,
    loading: () => <ChartLoadingState label="Loading roles chart" />,
  }
)

function AnimatedCounter({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (value === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value)
      return
    }

    let frame = 0
    let startedAt = 0

    const tick = (time: number) => {
      startedAt ||= time
      const progress = Math.min((time - startedAt) / duration, 1)
      setDisplay(Math.floor(value * progress))

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick)
      } else {
        setDisplay(value)
      }
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [value, duration])

  return <span className="tabular-nums">{display}</span>
}

function GrowthBadge({ value }: { value: number }) {
  const isPositive = value >= 0

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums"
      style={{
        background: isPositive ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.08)',
        color: isPositive ? '#047857' : '#dc2626',
      }}
    >
      <ArrowUpRight size={11} style={{ transform: isPositive ? 'none' : 'rotate(90deg)' }} />
      {isPositive ? '+' : ''}
      {value}%
    </span>
  )
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] text-sm font-semibold text-[var(--text-muted)]">
      {label}
    </div>
  )
}

const metricIcons: Record<string, typeof Gauge> = {
  'delivery-risk': Gauge,
  'approval-latency': ShieldCheck,
  'cash-exposure': CircleDollarSign,
  'utilization-pressure': Users,
  'client-health': Building2,
  'automation-health': GitBranch,
  'sla-violations': TimerReset,
  'revenue-forecast': CircleDollarSign,
}

function ToneBadge({ tone }: { tone: IntelligenceTone }) {
  const { t } = useLocale()
  const toneKey = {
    good: 'tone.good',
    watch: 'tone.watch',
    risk: 'tone.risk',
    critical: 'tone.critical',
    neutral: 'tone.neutral',
  } as const

  return <span className={`ops-tone-badge ops-tone-${tone}`}>{t(toneKey[tone])}</span>
}

function CommandCenterSkeleton() {
  return (
    <section className="ops-command-grid" aria-label="Loading command center">
      <div className="card">
        <div className="loading-shimmer h-5 w-44 rounded-full" />
        <div className="loading-shimmer mt-5 h-11 w-32 rounded-[10px]" />
        <div className="loading-shimmer mt-5 h-4 w-full rounded-full" />
        <div className="loading-shimmer mt-3 h-4 w-4/5 rounded-full" />
      </div>
      <div className="card">
        <div className="loading-shimmer h-5 w-36 rounded-full" />
        <div className="mt-5 grid gap-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="loading-shimmer h-16 rounded-[var(--radius-sm)]" />
          ))}
        </div>
      </div>
    </section>
  )
}

function MetricCard({ metric }: { metric: CommandCenterMetric }) {
  const Icon = metricIcons[metric.id] ?? Gauge
  const content = (
    <>
      <div className="ops-signal-head">
        <span className="ops-signal-icon">
          <Icon size={16} />
        </span>
        <ToneBadge tone={metric.tone} />
      </div>
      <div className="ops-signal-value">{metric.value}</div>
      <div className="ops-signal-label">{metric.label}</div>
      <p className="ops-signal-detail">{metric.detail}</p>
    </>
  )

  if (metric.href) {
    return (
      <Link href={metric.href} className={`ops-signal-card ops-signal-${metric.tone}`}>
        {content}
      </Link>
    )
  }

  return <article className={`ops-signal-card ops-signal-${metric.tone}`}>{content}</article>
}

function OperationalCommandCenterPanel({ data }: { data: OperationalCommandCenter }) {
  const { t } = useLocale()
  const primaryMetrics = data.metrics.slice(0, 8)
  const primaryAgents = data.agentSignals.slice(0, 5)
  const primaryRisks = data.risks.slice(0, 4)
  const graphCoverage = data.graph.coverage.filter((item) => item.count > 0).slice(0, 6)

  return (
    <>
      <section className="ops-command-grid">
        <section className="card ops-briefing-panel">
          <div className="ops-panel-heading">
            <div>
              <div className="dashboard-hero-kicker">
                <BrainCircuit size={13} />
                {t('ops.executiveCommandCenter')}
              </div>
              <h2 className="ops-briefing-title">{data.briefing.title}</h2>
            </div>
            <div className={`ops-health-score ops-health-${data.briefing.tone}`}>
              <span>{data.briefing.healthScore}</span>
              <small>{t('ops.health')}</small>
            </div>
          </div>

          <p className="ops-briefing-summary">{data.briefing.summary}</p>
          <div className="ops-focus-row">
            <Sparkles size={16} />
            <span>{data.briefing.focus}</span>
          </div>

          <div className="ops-action-list">
            {data.briefing.recommendedActions.slice(0, 4).map((action) => (
              <div key={action} className="ops-action-item">
                <CheckCircle2 size={15} />
                <span>{action}</span>
              </div>
            ))}
          </div>

          <div className="ops-loop-track">
            {data.operatingLoop.map((stage) => (
              <div key={stage.id} className={`ops-loop-node ops-loop-${stage.tone}`} title={stage.state}>
                <span>{stage.label}</span>
                <strong>{stage.count}</strong>
              </div>
            ))}
          </div>
        </section>

        <aside className="card ops-agent-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">{t('ops.aiAgents')}</h2>
              <p className="panel-meta">{t('ops.aiAgentsMeta')}</p>
            </div>
            <ToneBadge tone={data.briefing.tone} />
          </div>

          <div className="ops-agent-list">
            {primaryAgents.map((agent) => {
              const body = (
                <>
                  <div className="ops-agent-topline">
                    <span>{agent.agent}</span>
                    <ToneBadge tone={agent.tone} />
                  </div>
                  <strong>{agent.signal}</strong>
                  <p>{agent.reasoning}</p>
                  <div className="ops-agent-action">
                    <ArrowRight size={14} />
                    {agent.recommendedAction}
                  </div>
                </>
              )

              return agent.href ? (
                <Link key={agent.id} href={agent.href} className="ops-agent-row">
                  {body}
                </Link>
              ) : (
                <div key={agent.id} className="ops-agent-row">
                  {body}
                </div>
              )
            })}
          </div>
        </aside>
      </section>

      <section className="ops-signal-grid">
        {primaryMetrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </section>

      <section className="dashboard-section-grid">
        <div className="card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">{t('ops.riskQueue')}</h2>
              <p className="panel-meta">{t('ops.riskQueueMeta')}</p>
            </div>
          </div>
          {!primaryRisks.length ? (
            <div className="ops-empty-state">
              <CheckCircle2 size={22} />
              {t('ops.noActiveRisks')}
            </div>
          ) : (
            <div className="ops-risk-list">
              {primaryRisks.map((risk) => {
                const body = (
                  <>
                    <div className="ops-risk-header">
                      <span className="ops-risk-type">{risk.type}</span>
                      <ToneBadge tone={risk.severity} />
                    </div>
                    <strong>{risk.title}</strong>
                    <p>{risk.impact}</p>
                    <small>{risk.why}</small>
                    <div className="ops-agent-action">
                      <ArrowRight size={14} />
                      {risk.action}
                    </div>
                  </>
                )

                return risk.href ? (
                  <Link key={risk.id} href={risk.href} className="ops-risk-row">
                    {body}
                  </Link>
                ) : (
                  <div key={risk.id} className="ops-risk-row">
                    {body}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">{t('ops.operationalGraph')}</h2>
              <p className="panel-meta">{t('ops.operationalGraphMeta')}</p>
            </div>
          </div>
          <div className="ops-graph-score">
            <div>
              <span>{data.graph.nodes}</span>
              <small>{t('ops.nodes')}</small>
            </div>
            <div>
              <span>{data.graph.edges}</span>
              <small>{t('ops.edges')}</small>
            </div>
          </div>
          <div className="ops-graph-coverage">
            {graphCoverage.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
          <div className="ops-focus-row mt-4">
            <CircleDollarSign size={16} />
            <span>{data.financial.marginNote}</span>
          </div>
        </div>
      </section>
    </>
  )
}

export default function AdminDashboard() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<Stats | null>(null)
  const [commandCenter, setCommandCenter] = useState<OperationalCommandCenter | null>(null)
  const [loading, setLoading] = useState(true)
  const [additionalInsightsOpen, setAdditionalInsightsOpen] = useState(false)

  const loadStats = useCallback(async () => {
    const [analyticsResponse, commandCenterResponse] = await Promise.all([
      fetch('/api/analytics', { cache: 'no-store' }),
      fetch('/api/operations/command-center', { cache: 'no-store' }),
    ])
    const data = (await analyticsResponse.json()) as Stats
    const commandData = commandCenterResponse.ok
      ? ((await commandCenterResponse.json()) as OperationalCommandCenter)
      : null
    setStats(data)
    setCommandCenter(commandData)
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true

    void (async () => {
      const [analyticsResponse, commandCenterResponse] = await Promise.all([
        fetch('/api/analytics', { cache: 'no-store' }),
        fetch('/api/operations/command-center', { cache: 'no-store' }),
      ])
      const data = (await analyticsResponse.json()) as Stats
      const commandData = commandCenterResponse.ok
        ? ((await commandCenterResponse.json()) as OperationalCommandCenter)
        : null
      if (!active) return
      setStats(data)
      setCommandCenter(commandData)
      setLoading(false)
    })()

    return () => {
      active = false
    }
  }, [])

  useRealtimeSubscription(DASHBOARD_REALTIME_EVENTS, () => {
    void loadStats()
  }, 450)

  const user = session?.user as { name?: string; companyType?: string | null }
  const companyType = normalizeCompanyType(stats?.companyType ?? user?.companyType)
  const companyCopy = getCompanyTypeCopy(companyType)
  const isAgency = isAgencyCompanyType(companyType)
  const isIndustry = companyType === 'INDUSTRY'

  const statCards = stats
    ? [
        ...(isIndustry
          ? [
              {
                label: companyCopy.groupPluralLabel,
                value: stats.roomCount,
                icon: Building2,
                color: '#2142ff',
                bg: 'rgba(33,66,255,0.09)',
                help: 'Operational spaces',
                growth: 0,
              },
            ]
          : isAgency
            ? [
              {
                label: 'Deliverables',
                value: stats.submissionCount,
                icon: UploadCloud,
                color: '#7c3aed',
                bg: 'rgba(124,58,237,0.08)',
                help: 'Files uploaded',
                growth: stats.growth?.completedTasks ?? 0,
              },
            ]
          : []),
        {
          label: 'Users',
          value: stats.totalUsers,
          icon: Users,
          color: '#0369a1',
          bg: 'rgba(3,105,161,0.09)',
          help: 'All members',
          growth: stats.growth?.users ?? 0,
        },
        {
          label: 'Active',
          value: stats.activeUsers,
          icon: Zap,
          color: '#0f766e',
          bg: 'rgba(15,118,110,0.1)',
          help: 'This week',
          growth: stats.growth?.activeUsers ?? 0,
        },
        {
          label: companyCopy.projectPluralLabel,
          value: stats.totalProjects,
          icon: FolderKanban,
          color: '#7c3aed',
          bg: 'rgba(124,58,237,0.08)',
          help: 'Total projects',
          growth: stats.growth?.projects ?? 0,
        },
        {
          label: companyCopy.taskPluralLabel,
          value: stats.totalTasks,
          icon: ClipboardList,
          color: '#0f766e',
          bg: 'rgba(15,118,110,0.1)',
          help: 'Total work items',
          growth: stats.growth?.tasks ?? 0,
        },
        {
          label: 'Completed',
          value: stats.doneTasks,
          icon: CheckCircle2,
          color: '#059669',
          bg: 'rgba(5,150,105,0.09)',
          help: 'Finished work',
          growth: stats.growth?.completedTasks ?? 0,
        },
        {
          label: 'In progress',
          value: stats.inProgressTasks,
          icon: Zap,
          color: '#d97706',
          bg: 'rgba(217,119,6,0.1)',
          help: 'Currently active',
          growth: 0,
        },
        {
          label: 'Overdue',
          value: stats.overdueTasks,
          icon: AlertTriangle,
          color: '#dc2626',
          bg: 'rgba(220,38,38,0.08)',
          help: 'Needs attention',
          growth: 0,
        },
        {
          label: 'Team',
          value: stats.totalEmployees,
          icon: Users,
          color: '#0e7490',
          bg: 'rgba(14,116,144,0.09)',
          help: 'Employees',
          growth: stats.growth?.users ?? 0,
        },
      ]
    : []

  const completionRate = stats?.totalTasks ? Math.round((stats.doneTasks / stats.totalTasks) * 100) : 0
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  const workspaceMessage = isIndustry
    ? `Track rooms, ${companyCopy.projectPluralLabel.toLowerCase()}, and ${companyCopy.taskPluralLabel.toLowerCase()} from one operational view.`
    : isAgency
      ? 'Track client campaigns, briefs, uploaded deliverables, and team execution from one studio view.'
      : `Track ${companyCopy.projectPluralLabel.toLowerCase()}, ${companyCopy.taskPluralLabel.toLowerCase()}, and team execution from one clean workspace.`

  const priorityStatLabels = new Set([
    isIndustry ? companyCopy.groupPluralLabel : isAgency ? 'Deliverables' : companyCopy.projectPluralLabel,
    companyCopy.taskPluralLabel,
    'Completed',
    'Overdue',
  ])
  const overviewCards = statCards.filter((card) => priorityStatLabels.has(card.label)).slice(0, 4)
  const secondaryCards = statCards.filter((card) => !priorityStatLabels.has(card.label))
  const teamRows = stats?.performance ? [...stats.performance].sort((a, b) => b.score - a.score).slice(0, 5) : []
  const recentRows = stats?.recentActivity?.slice(0, 4) ?? []
  const breakdownItems = stats
    ? [
        { label: 'Completed', value: stats.doneTasks, color: '#059669', icon: CheckCircle2 },
        { label: 'In progress', value: stats.inProgressTasks, color: '#d97706', icon: Zap },
        { label: 'Overdue', value: stats.overdueTasks, color: '#dc2626', icon: AlertTriangle },
      ]
    : []

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div className="min-w-0">
          <div className="dashboard-hero-kicker">
            <Sparkles size={13} />
            {companyCopy.workspaceLabel}
          </div>
          <h1 className="page-heading mt-4">
            <span suppressHydrationWarning>{greeting}</span>, {user?.name?.split(' ')[0] || 'there'}
          </h1>
          <p className="page-sub max-w-2xl">{workspaceMessage}</p>
        </div>

        <div className="dashboard-hero-actions">
          <Link href="/dashboard/admin/projects" className="btn-secondary">
            <FolderKanban size={16} />
            {companyCopy.projectPluralLabel}
          </Link>
          <Link href="/dashboard/admin/tasks" className="btn-primary">
            <Plus size={16} />
            New {companyCopy.taskLabel}
          </Link>
        </div>
      </section>

      {commandCenter ? <OperationalCommandCenterPanel data={commandCenter} /> : loading ? <CommandCenterSkeleton /> : null}

      {loading ? (
        <div className="dashboard-stat-grid">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="stat-card loading-shimmer" aria-label="Loading overview metric">
              <div className="h-10 w-10 rounded-[10px] bg-white/70" />
              <div className="mt-5 h-8 w-20 rounded-[8px] bg-white/70" />
              <div className="mt-3 h-3 w-28 rounded-full bg-white/70" />
            </div>
          ))}
        </div>
      ) : (
        <div className="dashboard-stat-grid">
          {overviewCards.map((card, index) => {
            const Icon = card.icon
            return (
              <article key={card.label} className="stat-card animate-fade-in" style={{ animationDelay: `${index * 45}ms` }}>
                <div className="stat-card-header">
                  <span className="stat-card-label">{card.label}</span>
                  <div className="stat-card-icon" style={{ background: card.bg }}>
                    <Icon size={18} style={{ color: card.color }} />
                  </div>
                </div>
                <div className="stat-card-value" style={{ color: card.color }}>
                  <AnimatedCounter value={card.value} />
                </div>
                <div className="stat-card-delta">
                  <span>{card.help}</span>
                  <GrowthBadge value={card.growth} />
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="dashboard-section-grid">
        <section className="card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Activity over time</h2>
              <p className="panel-meta">Created and completed work across the last 7 days.</p>
            </div>
            <span className="rounded-full bg-[var(--bg-elevated)] px-3 py-1 text-[11px] font-bold text-[var(--text-muted)]">
              This week vs last week
            </span>
          </div>
          {!stats?.activitySeries?.some((item) => item.created || item.completed) ? (
            <EmptyChartState label="No activity trend yet" />
          ) : (
            <ActivityLineChart data={stats.activitySeries} />
          )}
        </section>

        <section className="card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">{isAgency ? 'Brief breakdown' : 'Task breakdown'}</h2>
              <p className="panel-meta">A quick read on what is finished, active, or late.</p>
            </div>
          </div>

          <div className="mb-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Overall completion</span>
              <span className="text-2xl font-bold text-[var(--accent)]">{completionRate}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${completionRate}%` }} />
            </div>
          </div>

          {stats && stats.totalTasks > 0 ? (
            <div className="metric-list">
              {breakdownItems.map((item) => {
                const Icon = item.icon
                const pct = stats.totalTasks ? Math.round((item.value / stats.totalTasks) * 100) : 0
                return (
                  <div key={item.label} className="metric-row">
                    <div className="metric-row-header">
                      <span className="metric-label">
                        <Icon size={15} style={{ color: item.color }} />
                        {item.label}
                      </span>
                      <span className="metric-value" style={{ color: item.color }}>
                        {item.value} <span className="font-medium text-[var(--text-muted)]">({pct}%)</span>
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: item.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-white px-5 py-8 text-center">
              <CheckSquare size={28} style={{ opacity: 0.35, margin: '0 auto 10px', color: 'var(--text-muted)' }} />
              <p className="text-sm font-semibold text-[var(--text-primary)]">No {companyCopy.taskPluralLabel.toLowerCase()} yet</p>
              <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-[var(--text-muted)]">
                Create a {companyCopy.projectLabel.toLowerCase()} first, then split it into clear {companyCopy.taskPluralLabel.toLowerCase()}.
              </p>
            </div>
          )}

          <div className="dashboard-action-row mt-5">
            <Link href="/dashboard/admin/tasks" className="btn-secondary">
              <CheckSquare size={15} />
              View {companyCopy.taskPluralLabel}
            </Link>
            <Link href="/dashboard/admin/alerts" className="btn-primary">
              <Bell size={15} />
              Send alert
            </Link>
          </div>
        </section>
      </div>

      <div className="dashboard-section-grid">
        <section className="card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Team performance</h2>
              <p className="panel-meta">Top contributors by completed work.</p>
            </div>
            <Link href="/dashboard/admin/employees" className="btn-secondary btn-sm">
              Team
              <ArrowRight size={14} />
            </Link>
          </div>

          {!teamRows.length ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-10 text-center">
              <Users size={30} style={{ opacity: 0.34, margin: '0 auto 10px', color: 'var(--text-muted)' }} />
              <p className="text-sm font-semibold text-[var(--text-primary)]">No team members yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[var(--text-muted)]">
                Invite employees to start seeing workload, progress, and completion trends here.
              </p>
            </div>
          ) : (
            <div className="activity-list">
              {teamRows.map((employee, index) => (
                <div key={employee.name} className="team-card">
                  <div className="team-row-header">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="icon-box h-8 w-8 rounded-full text-xs font-bold text-[var(--accent)]" style={{ background: 'var(--accent-subtle)' }}>
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{employee.name}</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {employee.done}/{employee.total} complete
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-bold" style={{ color: employee.score >= 80 ? '#059669' : employee.score >= 50 ? '#d97706' : '#dc2626' }}>
                      {employee.score}%
                    </div>
                  </div>
                  <div className="progress-bar mt-3">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${employee.score}%`,
                        background: employee.score >= 80 ? '#059669' : employee.score >= 50 ? '#d97706' : '#dc2626',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Recent activity</h2>
              <p className="panel-meta">Newest task and project movement.</p>
            </div>
            <Link href="/dashboard/admin/tasks" className="btn-secondary btn-sm">
              View tasks
              <ArrowRight size={14} />
            </Link>
          </div>

          {!recentRows.length ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-10 text-center text-sm font-semibold text-[var(--text-muted)]">
              No activity logged yet
            </div>
          ) : (
            <div className="activity-list">
              {recentRows.map((activity) => (
                <div key={activity.id} className="activity-card">
                  <div className="activity-row">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="icon-box h-9 w-9 rounded-full text-xs font-bold text-[var(--accent)]" style={{ background: 'var(--accent-subtle)' }}>
                        {activity.user.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">{activity.user.name}</span>
                          <span className="text-xs font-medium text-[var(--text-muted)]">{activity.action}</span>
                        </div>
                        <div className="mt-1 truncate text-xs text-[var(--text-muted)]">
                          {activity.task.project.title} / {activity.task.title}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-[var(--text-muted)]">
                      {new Date(activity.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {!!secondaryCards.length && (
        <section className="card mt-4">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Workspace signals</h2>
              <p className="panel-meta">Secondary metrics are grouped here to keep the overview scannable.</p>
            </div>
          </div>
          <div className="compact-stat-grid">
            {secondaryCards.map((card) => (
              <div key={card.label} className="compact-stat">
                <div className="compact-stat-label">{card.label}</div>
                <div className="compact-stat-value">
                  <AnimatedCounter value={card.value} />
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">{card.help}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <details className="dashboard-disclosure" onToggle={(event) => setAdditionalInsightsOpen(event.currentTarget.open)}>
        <summary>Additional insights</summary>
        <div className="dashboard-disclosure-body">
          {additionalInsightsOpen && (
          <div className="dashboard-section-grid mt-0">
            <section className="card">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Status mix</h2>
                  <p className="panel-meta">A stage-level breakdown of all work.</p>
                </div>
              </div>
              {!stats?.taskStageBreakdown?.some((item) => item.value) ? (
                <EmptyChartState label="No task data yet" />
              ) : (
                <StatusBarChart data={stats.taskStageBreakdown} />
              )}
            </section>

            <section className="card">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Roles distribution</h2>
                  <p className="panel-meta">Workspace access composition.</p>
                </div>
              </div>
              {!stats?.rolesDistribution?.some((item) => item.value) ? (
                <EmptyChartState label="No role data yet" />
              ) : (
                <RolesPieChart data={stats.rolesDistribution} />
              )}
            </section>
          </div>
          )}
        </div>
      </details>

      {isAgency && (
        <section className="card mt-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="icon-box h-11 w-11" style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>
                <BriefcaseBusiness size={20} />
              </div>
              <div>
                <h2 className="panel-title">Agency setup</h2>
                <p className="panel-meta max-w-2xl">
                  Create client categories, add campaigns under each category, then split every campaign into briefs.
                </p>
              </div>
            </div>
            <Link href="/dashboard/admin/projects" className="btn-secondary">
              Organize campaigns
              <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
