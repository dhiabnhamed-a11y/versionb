'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useLocale } from '@/components/i18n/LocaleProvider'
import { getLocalizedCompanyCopy } from '@/lib/company-copy-i18n'
import { isAgencyCompanyType, isHealthcareCompanyType, normalizeCompanyType } from '@/lib/company-types'
import HealthcareOverview from '@/components/healthcare/HealthcareOverview'
import type { TranslationKey } from '@/lib/i18n'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  FolderKanban,
  ShieldCheck,
  UploadCloud,
  Users,
  X,
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
}

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

type PipelineStageId = 'request' | 'scope' | 'planning' | 'work' | 'review' | 'approval' | 'delivery' | 'invoice'

type PipelineStage = {
  id: PipelineStageId
  label: string
  count: number
  state: string
  tone: IntelligenceTone
}

type PipelineCluster = {
  id: 'intake' | 'execution' | 'closure'
  label: string
  stages: PipelineStage[]
  total: number
}

type LocalizedRisk = {
  id: string
  title: string
  impact: string
  why: string
  action: string
  severity: Exclude<IntelligenceTone, 'good' | 'neutral'>
  href?: string
}

type LocalizedAgent = {
  id: string
  agent: string
  status: string
  tone: IntelligenceTone
  signal: string
  reasoning: string
  recommendedAction: string
  href?: string
}

type HealthComponent = {
  id: string
  label: string
  score: number
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

const PIPELINE_STAGE_IDS: PipelineStageId[] = [
  'request',
  'scope',
  'planning',
  'work',
  'review',
  'approval',
  'delivery',
  'invoice',
]

const PIPELINE_LABEL_KEYS: Record<PipelineStageId, TranslationKey> = {
  request: 'pipeline.clientRequest',
  scope: 'pipeline.scope',
  planning: 'pipeline.planning',
  work: 'pipeline.work',
  review: 'pipeline.review',
  approval: 'pipeline.approval',
  delivery: 'pipeline.delivery',
  invoice: 'pipeline.invoice',
}

const PIPELINE_STATE_KEYS: Record<PipelineStageId, TranslationKey> = {
  request: 'pipeline.needsTriage',
  scope: 'pipeline.approvedBriefs',
  planning: 'pipeline.readyWork',
  work: 'pipeline.inProduction',
  review: 'pipeline.internalReview',
  approval: 'pipeline.waiting',
  delivery: 'pipeline.readyToDeliver',
  invoice: 'pipeline.revenueWorkflow',
}

function ChartLoadingState({ label = 'Loading chart' }: { label?: string }) {
  return (
    <div className="taskit-empty-state" aria-label={label}>
      <div className="loading-shimmer h-4 w-36 rounded-full" />
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

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function numberFromText(value: string | undefined) {
  const match = value?.match(/-?\d+(\.\d+)?/)
  return match ? Number(match[0]) : 0
}

function localeForDate(locale: string) {
  if (locale === 'fr') return 'fr-FR'
  if (locale === 'ar') return 'ar'
  return 'en-US'
}

function formatMoney(value: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(localeForDate(locale), {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${currency || 'USD'} ${Math.round(value).toLocaleString(localeForDate(locale))}`
  }
}

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

function ToneBadge({ tone }: { tone: IntelligenceTone }) {
  const { t } = useLocale()
  const toneKey = {
    good: 'tone.good',
    watch: 'tone.watch',
    risk: 'tone.risk',
    critical: 'tone.critical',
    neutral: 'tone.neutral',
  } as const

  return <span className={`taskit-tone-badge taskit-tone-${tone}`}>{t(toneKey[tone])}</span>
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="taskit-empty-state">
      <p className="taskit-body">{label}</p>
    </div>
  )
}

function localizeRisk(
  risk: OperationalRisk,
  data: OperationalCommandCenter,
  t: (key: TranslationKey) => string,
  locale: string
): LocalizedRisk {
  const firstNumber = numberFromText(risk.impact)

  if (risk.id === 'approval-blockers') {
    return {
      ...risk,
      title: t('risk.approval.title'),
      impact: `${firstNumber} ${t('risk.approval.impact')}`,
      why: t('risk.approval.why'),
      action: t('risk.approval.action'),
    }
  }

  if (risk.id === 'cash-collection-risk') {
    return {
      ...risk,
      title: t('risk.cash.title'),
      impact: `${formatMoney(data.financial.overdueTotal, data.financial.currency, locale)} ${t('risk.cash.impact')}`,
      why: t('risk.cash.why'),
      action: t('risk.cash.action'),
    }
  }

  if (risk.id === 'capacity-pressure') {
    return {
      ...risk,
      title: t('risk.capacity.title'),
      impact: `${firstNumber} ${t('risk.capacity.impact')}`,
      why: t('risk.capacity.why'),
      action: t('risk.capacity.action'),
    }
  }

  if (risk.id === 'client-health-risk') {
    return {
      ...risk,
      title: t('risk.clientHealth.title'),
      impact: `${firstNumber} ${t('risk.clientHealth.impact')}`,
      why: t('risk.clientHealth.why'),
      action: t('risk.clientHealth.action'),
    }
  }

  if (risk.id === 'automation-observability') {
    return {
      ...risk,
      title: t('risk.automation.title'),
      impact: `${firstNumber} ${t('risk.automation.impact')}`,
      why: t('risk.automation.why'),
      action: t('risk.automation.action'),
    }
  }

  if (risk.id === 'margin-instrumentation') {
    return {
      ...risk,
      title: t('risk.margin.title'),
      impact: t('risk.margin.impact'),
      why: t('risk.margin.why'),
      action: t('risk.margin.action'),
    }
  }

  if (risk.id === 'operational-memory-quality') {
    return {
      ...risk,
      title: t('risk.memory.title'),
      impact: t('risk.memory.impact'),
      why: t('risk.memory.why'),
      action: t('risk.memory.action'),
    }
  }

  return {
    ...risk,
    title: t('risk.delivery.title'),
    impact: `${firstNumber} ${t('risk.delivery.impact')}`,
    why: t('risk.delivery.why'),
    action: t('risk.delivery.action'),
  }
}

function localizeAgent(
  agent: AgentSignal,
  data: OperationalCommandCenter,
  topRisk: LocalizedRisk | undefined,
  t: (key: TranslationKey) => string
): LocalizedAgent {
  if (agent.id === 'executive') {
    return {
      ...agent,
      agent: t('agent.executive.name'),
      status: `${data.briefing.healthScore}% ${t('agent.statusHealth')}`,
      signal: topRisk?.title ?? t('agent.signalPortfolioStable'),
      reasoning: topRisk?.why ?? t('agent.reasoningExecutiveStable'),
      recommendedAction: topRisk?.action ?? t('agent.actionKeepCurrent'),
    }
  }

  if (agent.id === 'operations') {
    const count = numberFromText(agent.status)
    return {
      ...agent,
      agent: t('agent.operations.name'),
      status: `${count} ${t('agent.statusAtRisk')}`,
      signal: count ? agent.signal : t('agent.signalDeliveryHealthy'),
      reasoning: t('agent.reasoningOperations'),
      recommendedAction: count ? t('agent.actionOpenRiskiest') : t('agent.actionKeepCurrent'),
    }
  }

  if (agent.id === 'approval') {
    const count = numberFromText(agent.status)
    return {
      ...agent,
      agent: t('agent.approval.name'),
      status: `${count} ${t('agent.statusOverdue')}`,
      signal: count ? agent.signal : t('agent.signalApprovalClear'),
      reasoning: t('agent.reasoningApproval'),
      recommendedAction: count ? t('agent.actionEscalateApproval') : t('agent.actionApprovalSameDay'),
    }
  }

  if (agent.id === 'finance') {
    const visible = data.financial.financeVisible
    return {
      ...agent,
      agent: t('agent.finance.name'),
      status: visible ? agent.status : t('agent.statusRestricted'),
      signal: visible ? agent.signal : t('agent.signalFinanceHidden'),
      reasoning: visible ? t('agent.reasoningFinanceVisible') : t('agent.reasoningFinanceHidden'),
      recommendedAction: visible ? t('agent.actionChaseInvoices') : t('agent.actionAskFinance'),
    }
  }

  if (agent.id === 'resource-planning') {
    const count = numberFromText(agent.status)
    return {
      ...agent,
      agent: t('agent.resource.name'),
      status: `${count} ${t('agent.statusOverloaded')}`,
      signal: count ? agent.signal : t('agent.signalCapacityBalanced'),
      reasoning: t('agent.reasoningResource'),
      recommendedAction: count ? t('agent.actionRebalanceCapacity') : t('agent.actionReviewCapacity'),
    }
  }

  if (agent.id === 'client-success') {
    const count = numberFromText(agent.status)
    return {
      ...agent,
      agent: t('agent.client.name'),
      status: `${count} ${t('agent.statusWeak')}`,
      signal: count ? agent.signal : t('agent.signalClientHealthy'),
      reasoning: t('agent.reasoningClient'),
      recommendedAction: count ? t('agent.actionScheduleCheckIn') : t('agent.actionKeepClientUpdates'),
    }
  }

  if (agent.id === 'creative-director') {
    const count = numberFromText(agent.status)
    return {
      ...agent,
      agent: t('agent.creative.name'),
      status: `${count} ${t('agent.statusRevisionHeavy')}`,
      signal: count ? agent.signal : t('agent.signalReviewNormal'),
      reasoning: t('agent.reasoningCreative'),
      recommendedAction: count ? t('agent.actionReviewRevisions') : t('agent.actionKeepReviewNotes'),
    }
  }

  if (agent.id === 'automation') {
    const count = numberFromText(agent.status)
    return {
      ...agent,
      agent: t('agent.automation.name'),
      status: `${count} ${t('agent.statusFailed')}`,
      signal: count ? agent.signal : t('agent.signalAutomationPending'),
      reasoning: t('agent.reasoningAutomation'),
      recommendedAction: count ? t('agent.actionInspectFailedJobs') : t('agent.actionUseJobHistory'),
    }
  }

  return agent
}

function stageStateKey(stage: OperatingLoopStage | undefined, id: PipelineStageId) {
  if (!stage) return PIPELINE_STATE_KEYS[id]
  if (id === 'request' && stage.count === 0) return 'pipeline.quiet'
  if (id === 'review' && stage.count === 0) return 'pipeline.clear'
  if (id === 'approval' && stage.tone === 'risk') return 'pipeline.overdue'
  if (id === 'delivery' && stage.count === 0) return 'pipeline.synced'
  if (id === 'invoice' && stage.state.toLowerCase().includes('restricted')) return 'pipeline.restricted'
  return PIPELINE_STATE_KEYS[id]
}

function buildPipelineClusters(
  data: OperationalCommandCenter | null,
  t: (key: TranslationKey) => string
): PipelineCluster[] {
  const stages = PIPELINE_STAGE_IDS.map((id) => {
    const source = data?.operatingLoop.find((stage) => stage.id === id)
    return {
      id,
      label: t(PIPELINE_LABEL_KEYS[id]),
      count: source?.count ?? 0,
      state: t(stageStateKey(source, id)),
      tone: source?.tone ?? 'neutral',
    }
  })

  const clusterDefinitions: Array<{ id: PipelineCluster['id']; label: string; stageIds: PipelineStageId[] }> = [
    { id: 'intake', label: t('overview.clusterIntake'), stageIds: ['request', 'scope', 'planning'] },
    { id: 'execution', label: t('overview.clusterExecution'), stageIds: ['work', 'review', 'approval'] },
    { id: 'closure', label: t('overview.clusterClosure'), stageIds: ['delivery', 'invoice'] },
  ]

  return clusterDefinitions.map((cluster) => {
    const clusterStages = stages.filter((stage) => cluster.stageIds.includes(stage.id))
    return {
      id: cluster.id,
      label: cluster.label,
      stages: clusterStages,
      total: clusterStages.reduce((sum, stage) => sum + stage.count, 0),
    }
  })
}

function buildHealthComponents(stats: Stats | null, data: OperationalCommandCenter | null, t: (key: TranslationKey) => string) {
  const deliveryRisk = numberFromText(data?.metrics.find((metric) => metric.id === 'delivery-risk')?.value)
  const approvalRisk = numberFromText(data?.metrics.find((metric) => metric.id === 'approval-latency')?.value)
  const clientRisk = numberFromText(data?.metrics.find((metric) => metric.id === 'client-health')?.value)
  const marginScore =
    data?.financial.marginVisibility === 'instrumented'
      ? 90
      : data?.financial.marginVisibility === 'partial'
        ? 68
        : data?.financial.financeVisible
          ? 48
          : 60

  return [
    {
      id: 'delivery',
      label: t('overview.healthDeliveryCadence'),
      score: clampScore(100 - deliveryRisk * 18 - (stats?.overdueTasks ?? 0) * 3),
    },
    {
      id: 'approval',
      label: t('overview.healthApprovalRate'),
      score: clampScore(100 - approvalRisk * 16),
    },
    {
      id: 'margin',
      label: t('overview.healthMarginHealth'),
      score: clampScore(marginScore),
    },
    {
      id: 'completion',
      label: t('overview.healthBriefCompletion'),
      score: clampScore(stats?.completionRate ?? 0),
    },
    {
      id: 'client-response',
      label: t('overview.healthClientResponseTime'),
      score: clampScore(100 - clientRisk * 14),
    },
  ] satisfies HealthComponent[]
}

function agentStatusLabel(tone: IntelligenceTone, t: (key: TranslationKey) => string) {
  if (tone === 'critical') return t('overview.agentStatusCritical')
  if (tone === 'risk' || tone === 'watch') return t('overview.agentStatusWarning')
  if (tone === 'good') return t('overview.agentStatusHealthy')
  return t('overview.agentStatusMonitor')
}

function formatActivityAction(action: string, t: (key: TranslationKey) => string) {
  if (action === 'Task created') return t('activity.taskCreated')
  if (action === 'Task deleted') return t('activity.taskDeleted')
  if (/^Invoice .+ created$/.test(action)) return t('activity.invoiceCreated')
  if (/^Invoice .+ marked paid$/.test(action)) return t('activity.invoicePaid')
  if (/^Invoice .+ updated$/.test(action)) return t('activity.invoiceUpdated')
  if (/^Invoice .+ deleted$/.test(action)) return t('activity.invoiceDeleted')
  return t('activity.updatedRecord')
}

function localizedRoleLabel(role: string, t: (key: TranslationKey) => string) {
  const normalized = role.trim().toUpperCase()
  if (normalized === 'OWNER') return t('role.owner')
  if (normalized === 'MANAGER') return t('role.manager')
  if (normalized === 'EMPLOYEE' || normalized === 'WORKER') return t('role.employee')
  if (normalized === 'SUPER ADMIN' || normalized === 'SUPER_ADMIN') return t('role.superAdmin')
  return role
}

function PipelineClusterCard({
  cluster,
  expanded,
  onToggle,
}: {
  cluster: PipelineCluster
  expanded: boolean
  onToggle: () => void
}) {
  const { t } = useLocale()
  const maxStageCount = Math.max(...cluster.stages.map((stage) => stage.count), 1)

  return (
    <article className="taskit-cluster-card">
      <button
        type="button"
        className="taskit-cluster-button"
        aria-expanded={expanded}
        aria-label={expanded ? t('overview.collapseCluster') : t('overview.expandCluster')}
        onClick={onToggle}
      >
        <div className="taskit-row-main">
          <span className="taskit-label">{cluster.label}</span>
          <span className="taskit-body">{t('overview.clusterTotal')}</span>
        </div>
        <div className="taskit-row-main text-right">
          <span className="taskit-cluster-total tabular-nums">{cluster.total}</span>
          <ChevronDown size={20} aria-hidden style={{ transform: expanded ? 'rotate(180deg)' : undefined }} />
        </div>
      </button>

      {expanded && (
        <div className="taskit-stage-list">
          {cluster.stages.map((stage) => (
            <div key={stage.id} className="taskit-stage-row">
              <div className="taskit-row-main">
                <span className="taskit-label">{stage.label}</span>
                <span className="taskit-body">{stage.state}</span>
              </div>
              <div className="taskit-row-main" style={{ minWidth: 112 }}>
                <span className="taskit-stage-count tabular-nums">{stage.count}</span>
                <div className="taskit-progress-track" aria-hidden>
                  <span className="taskit-progress-fill" style={{ width: `${Math.max(6, (stage.count / maxStageCount) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

function HealthScoreCard({
  score,
  tone,
  components,
}: {
  score: number
  tone: IntelligenceTone
  components: HealthComponent[]
}) {
  const { t } = useLocale()
  const [tooltipOpen, setTooltipOpen] = useState(false)

  return (
    <article className="taskit-card taskit-health-score-card">
      <div className="taskit-card-header">
        <div className="taskit-row-main">
          <span className="taskit-label">{t('overview.healthScore')}</span>
          <h2 className="taskit-heading">
            <span className="tabular-nums">{score}</span> / 100
          </h2>
        </div>
        <div className="taskit-tooltip-wrap">
          <button
            type="button"
            className="taskit-help-button"
            aria-label={t('overview.healthTooltipTitle')}
            aria-expanded={tooltipOpen}
            onClick={() => setTooltipOpen((current) => !current)}
          >
            ?
          </button>
          {tooltipOpen && (
            <div className="taskit-tooltip" role="tooltip">
              <div className="taskit-row-main">
                <strong className="taskit-heading">{t('overview.healthTooltipTitle')}</strong>
                <p className="taskit-body">{t('overview.healthTooltipIntro')}</p>
              </div>
              <div className="taskit-health-components mt-4">
                {components.map((component) => (
                  <div key={component.id} className="taskit-health-row">
                    <div className="taskit-row-main">
                      <span className="taskit-body">{component.label}</span>
                      <div className="taskit-health-meter" aria-hidden>
                        <span style={{ width: `${component.score}%` }} />
                      </div>
                    </div>
                    <span className="taskit-label tabular-nums">{component.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`taskit-health-score ops-health-${tone}`}>
        <span className="taskit-health-number tabular-nums">{score}</span>
        <ToneBadge tone={tone} />
      </div>
    </article>
  )
}

function AgentDrawer({
  open,
  agents,
  tone,
  onClose,
}: {
  open: boolean
  agents: LocalizedAgent[]
  tone: IntelligenceTone
  onClose: () => void
}) {
  const { t } = useLocale()

  useEffect(() => {
    if (!open) return

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <button type="button" className="taskit-drawer-backdrop" aria-label={t('action.close')} onClick={onClose} />
      <aside className="taskit-agent-drawer" aria-label={t('overview.agentDrawerTitle')}>
        <div className="taskit-drawer-header">
          <div className="taskit-row-main">
            <span className="taskit-label">{t('overview.agentStatus')}</span>
            <h2 className="taskit-heading">{t('overview.agentDrawerTitle')}</h2>
            <p className="taskit-body">{t('overview.agentDrawerMeta')}</p>
          </div>
          <button type="button" className="taskit-icon-button" aria-label={t('action.close')} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="taskit-drawer-body">
          <ToneBadge tone={tone} />
          {!agents.length ? (
            <div className="taskit-empty-state">
              <p className="taskit-body">{t('overview.noAgentSignals')}</p>
            </div>
          ) : (
            <div className="taskit-agent-list">
              {agents.map((agent) => {
                const body = (
                  <>
                    <div className="taskit-row-between">
                      <span className="taskit-label">{agent.agent}</span>
                      <ToneBadge tone={agent.tone} />
                    </div>
                    <div className="taskit-row-main">
                      <strong className="taskit-heading">{agent.signal}</strong>
                      <p className="taskit-body">{agent.reasoning}</p>
                      <div className="taskit-body">
                        <ArrowRight size={16} aria-hidden style={{ display: 'inline', marginInlineEnd: 8 }} />
                        {agent.recommendedAction}
                      </div>
                    </div>
                  </>
                )

                return agent.href ? (
                  <Link key={agent.id} href={agent.href} className="taskit-agent-row" onClick={onClose}>
                    {body}
                  </Link>
                ) : (
                  <article key={agent.id} className="taskit-agent-row">
                    {body}
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

function GraphCoverageLabel({ label }: { label: string }) {
  const { t } = useLocale()
  const lower = label.toLowerCase()
  if (lower === 'clients') return <>{t('nav.clients')}</>
  if (lower === 'campaigns') return <>{t('entity.campaigns')}</>
  if (lower === 'briefs') return <>{t('entity.briefs')}</>
  if (lower === 'deliverables') return <>{t('entity.deliverables')}</>
  if (lower === 'tasks') return <>{t('entity.tasks')}</>
  if (lower === 'invoices') return <>{t('nav.invoices')}</>
  return <>{label}</>
}

export default function AdminDashboard() {
  const { data: session } = useSession()
  const { locale, t } = useLocale()
  const [stats, setStats] = useState<Stats | null>(null)
  const [commandCenter, setCommandCenter] = useState<OperationalCommandCenter | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedClusters, setExpandedClusters] = useState<Record<PipelineCluster['id'], boolean>>({
    intake: false,
    execution: false,
    closure: false,
  })
  const [additionalInsightsOpen, setAdditionalInsightsOpen] = useState(false)
  const [agentDrawerOpen, setAgentDrawerOpen] = useState(false)

  const loadStats = useCallback(async () => {
    const [analyticsResponse, commandCenterResponse] = await Promise.all([
      fetch('/api/analytics', { cache: 'no-store' }),
      fetch('/api/operations/command-center', { cache: 'no-store' }),
    ])
    const data = analyticsResponse.ok ? ((await analyticsResponse.json()) as Stats) : null
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
      const data = analyticsResponse.ok ? ((await analyticsResponse.json()) as Stats) : null
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

  // Healthcare workspaces get a dedicated operations dashboard
  if (isHealthcareCompanyType(companyType)) {
    return <HealthcareOverview />
  }

  const entityCopy = getLocalizedCompanyCopy(companyType, t)
  const isAgency = isAgencyCompanyType(companyType)
  const isIndustry = companyType === 'INDUSTRY'
  const dateLocale = localeForDate(locale)
  const formattedToday = new Intl.DateTimeFormat(dateLocale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date())

  const localizedRisks = useMemo(
    () => commandCenter?.risks.slice(0, 4).map((risk) => localizeRisk(risk, commandCenter, t, locale)) ?? [],
    [commandCenter, locale, t]
  )
  const topRisk = localizedRisks[0]
  const localizedAgents = useMemo(
    () => commandCenter?.agentSignals.map((agent) => localizeAgent(agent, commandCenter, topRisk, t)) ?? [],
    [commandCenter, topRisk, t]
  )
  const pipelineClusters = useMemo(() => buildPipelineClusters(commandCenter, t), [commandCenter, t])
  const healthComponents = useMemo(() => buildHealthComponents(stats, commandCenter, t), [stats, commandCenter, t])
  const healthTone = commandCenter?.briefing.tone ?? 'neutral'
  const healthScore = commandCenter?.briefing.healthScore ?? stats?.completionRate ?? 0
  const agentStatus = agentStatusLabel(healthTone, t)

  const urgentSentence =
    topRisk?.action ??
    (stats?.overdueTasks ? t('overview.todayOverdueTasks') : loading ? t('overview.loadingPriority') : t('overview.noUrgentItem'))

  const localizedActivitySeries =
    stats?.activitySeries?.map((item) => ({
      ...item,
      label: new Intl.DateTimeFormat(dateLocale, { weekday: 'short' }).format(new Date(item.date)),
    })) ?? []

  const localizedStageBreakdown =
    stats?.taskStageBreakdown?.map((item) => {
      const name =
        item.stage === 'DONE'
          ? t('overview.completed')
          : item.stage === 'IN_PROGRESS'
            ? t('overview.inProgress')
            : item.stage === 'REVIEW'
              ? t('pipeline.review')
              : t('pipeline.planning')
      return { ...item, name }
    }) ?? []

  const localizedRoleDistribution =
    stats?.rolesDistribution?.map((item) => ({
      ...item,
      name: localizedRoleLabel(item.name, t),
    })) ?? []

  const completionRate = stats?.totalTasks ? Math.round((stats.doneTasks / stats.totalTasks) * 100) : 0
  const teamRows = stats?.performance ? [...stats.performance].sort((a, b) => b.score - a.score).slice(0, 5) : []
  const recentRows = stats?.recentActivity?.slice(0, 4) ?? []
  const breakdownItems = stats
    ? [
        { label: t('overview.completed'), value: stats.doneTasks, color: '#059669', icon: CheckCircle2 },
        { label: t('overview.inProgress'), value: stats.inProgressTasks, color: '#d97706', icon: Zap },
        { label: t('overview.overdue'), value: stats.overdueTasks, color: '#dc2626', icon: AlertTriangle },
      ]
    : []

  const workspaceSignalCards = stats
    ? [
        ...(isIndustry
          ? [
              {
                label: entityCopy.groupPluralLabel,
                value: stats.roomCount,
                icon: Building2,
                detail: t('overview.operationalSpaces'),
              },
            ]
          : isAgency
            ? [
                {
                  label: t('entity.deliverables'),
                  value: stats.submissionCount,
                  icon: UploadCloud,
                  detail: t('overview.filesUploaded'),
                },
              ]
            : []),
        { label: t('nav.team'), value: stats.totalEmployees, icon: Users, detail: t('overview.employees') },
        { label: t('overview.total'), value: stats.totalUsers, icon: Users, detail: t('overview.allMembers') },
        { label: t('overview.activeThisWeek'), value: stats.activeUsers, icon: Zap, detail: t('overview.activeThisWeek') },
        { label: entityCopy.projectPluralLabel, value: stats.totalProjects, icon: FolderKanban, detail: t('overview.totalProjects') },
        { label: entityCopy.taskPluralLabel, value: stats.totalTasks, icon: ClipboardList, detail: t('overview.totalTasks') },
        { label: t('overview.completed'), value: stats.doneTasks, icon: CheckCircle2, detail: t('overview.finishedWork') },
        { label: t('overview.inProgress'), value: stats.inProgressTasks, icon: Zap, detail: t('overview.currentlyActive') },
        { label: t('overview.overdue'), value: stats.overdueTasks, icon: AlertTriangle, detail: t('overview.needsAttention') },
      ]
    : []

  const graphCoverage = commandCenter?.graph.coverage.filter((item) => item.count > 0).slice(0, 6) ?? []

  return (
    <div className="dashboard-page taskit-overview">
      {/* REDLINE 02 - Greeting becomes a two-line daily briefing: user/date, then the one action that matters today. */}
      <section className="taskit-overview-header">
        <div className="taskit-overview-header-copy">
          <span className="taskit-label">{t('overview.contextLabel')}</span>
          <h1 className="taskit-display">
            {user?.name?.split(' ')[0] || 'TASKIT'} - <span suppressHydrationWarning>{formattedToday}</span>
          </h1>
          <p className="taskit-body">{urgentSentence}</p>
        </div>

        <div className="taskit-overview-header-actions">
          <button
            type="button"
            className={`taskit-agent-status-button taskit-agent-status-${healthTone}`}
            onClick={() => setAgentDrawerOpen(true)}
          >
            <Bot size={20} />
            <span>{t('overview.agentStatus')}</span>
            <strong>{agentStatus}</strong>
          </button>
          <Link href="/dashboard/admin/projects" className="taskit-secondary-action">
            <FolderKanban size={20} />
            {t('action.viewProjects')}
          </Link>
        </div>
      </section>

      {/* REDLINE 03 - Tier 1 only: critical alert, priority action, and health score. Agent details are intentionally absent here. */}
      <section className="taskit-tier-one-grid" aria-label={t('overview.commandBriefing')}>
        <article className="taskit-card taskit-critical-card">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">{topRisk ? t('overview.criticalAlert') : t('overview.commandBriefing')}</span>
              <h2 className="taskit-heading">{topRisk?.title ?? t('overview.stableOperations')}</h2>
            </div>
            <ToneBadge tone={topRisk?.severity ?? healthTone} />
          </div>

          <p className="taskit-body">{topRisk?.impact ?? t('overview.summaryDefault')}</p>

          <div className="taskit-alert-list">
            <div className="taskit-alert-row">
              <div className="taskit-row-main">
                <span className="taskit-label">{t('overview.priorityAction')}</span>
                <span className="taskit-body">{topRisk?.action ?? urgentSentence}</span>
              </div>
              {topRisk?.href && (
                <Link href={topRisk.href} className="taskit-secondary-action">
                  <ArrowRight size={20} />
                </Link>
              )}
            </div>
            {!!localizedRisks.length && (
              <div className="taskit-action-list">
                {localizedRisks.slice(0, 3).map((risk) => (
                  <div key={risk.id} className="taskit-action-row">
                    <ShieldCheck size={20} aria-hidden />
                    <div className="taskit-row-main">
                      <span className="taskit-body">{risk.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </article>

        <HealthScoreCard score={healthScore} tone={healthTone} components={healthComponents} />
      </section>

      {/* REDLINE 05 - Eight pipeline stages are grouped into three expandable clusters for progressive disclosure. */}
      <section className="taskit-card" aria-label={t('overview.pipelineKpis')}>
        <div className="taskit-card-header">
          <div className="taskit-row-main">
            <span className="taskit-label">{t('overview.pipelineKpis')}</span>
            <h2 className="taskit-heading">{t('overview.pipelineMeta')}</h2>
          </div>
        </div>

        <div className="taskit-pipeline-grid">
          {pipelineClusters.map((cluster) => (
            <PipelineClusterCard
              key={cluster.id}
              cluster={cluster}
              expanded={expandedClusters[cluster.id]}
              onToggle={() => setExpandedClusters((current) => ({ ...current, [cluster.id]: !current[cluster.id] }))}
            />
          ))}
        </div>
      </section>

      <section className="taskit-detail-grid">
        <article className="taskit-card">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">{t('overview.activityOverTime')}</span>
              <h2 className="taskit-heading">{t('overview.activityMeta')}</h2>
            </div>
            <span className="taskit-tone-badge taskit-tone-neutral">{t('overview.thisWeekVsLastWeek')}</span>
          </div>
          {!localizedActivitySeries.some((item) => item.created || item.completed) ? (
            <EmptyChartState label={t('overview.noActivityTrend')} />
          ) : (
            <ActivityLineChart data={localizedActivitySeries} createdLabel={t('chart.created')} completedLabel={t('chart.completed')} />
          )}
        </article>

        <article className="taskit-card">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">{isAgency ? t('overview.briefBreakdown') : t('overview.taskBreakdown')}</span>
              <h2 className="taskit-heading">{t('overview.breakdownMeta')}</h2>
            </div>
          </div>

          <div className="taskit-metric-row">
            <div className="taskit-row-main">
              <span className="taskit-label">{t('overview.overallCompletion')}</span>
              <span className="taskit-heading tabular-nums">{completionRate}%</span>
            </div>
            <div className="taskit-progress-track" style={{ minWidth: 112 }} aria-hidden>
              <span className="taskit-progress-fill" style={{ width: `${completionRate}%` }} />
            </div>
          </div>

          {stats && stats.totalTasks > 0 ? (
            <div className="taskit-metric-list">
              {breakdownItems.map((item) => {
                const Icon = item.icon
                const pct = stats.totalTasks ? Math.round((item.value / stats.totalTasks) * 100) : 0
                return (
                  <div key={item.label} className="taskit-metric-row">
                    <div className="taskit-row-main">
                      <span className="taskit-body">
                        <Icon size={20} aria-hidden style={{ color: item.color, display: 'inline', marginInlineEnd: 8 }} />
                        {item.label}
                      </span>
                      <div className="taskit-progress-track" aria-hidden>
                        <span className="taskit-progress-fill" style={{ width: `${pct}%`, background: item.color }} />
                      </div>
                    </div>
                    <span className="taskit-label tabular-nums">{item.value} ({pct}%)</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="taskit-empty-state">
              <div className="taskit-row-main">
                <CheckSquare size={20} aria-hidden />
                <p className="taskit-heading">{t('overview.noTasksYet')}</p>
                <p className="taskit-body">{t('overview.noTasksYetDescription')}</p>
              </div>
            </div>
          )}

          <div className="taskit-overview-header-actions">
            <Link href="/dashboard/admin/tasks" className="taskit-secondary-action">
              <CheckSquare size={20} />
              {t('action.viewTasks')}
            </Link>
            <Link href="/dashboard/admin/alerts" className="taskit-secondary-action">
              <AlertTriangle size={20} />
              {t('action.sendAlert')}
            </Link>
          </div>
        </article>
      </section>

      <section className="taskit-detail-grid">
        <article className="taskit-card">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">{t('overview.teamPerformance')}</span>
              <h2 className="taskit-heading">{t('overview.teamMeta')}</h2>
            </div>
            <Link href="/dashboard/admin/employees" className="taskit-secondary-action">
              <Users size={20} />
              {t('nav.team')}
            </Link>
          </div>

          {!teamRows.length ? (
            <div className="taskit-empty-state">
              <div className="taskit-row-main">
                <Users size={20} aria-hidden />
                <p className="taskit-heading">{t('overview.noTeamMembers')}</p>
                <p className="taskit-body">{t('overview.noTeamMembersMeta')}</p>
              </div>
            </div>
          ) : (
            <div className="taskit-activity-list">
              {teamRows.map((employee, index) => (
                <div key={employee.name} className="taskit-activity-row">
                  <div className="taskit-row-main">
                    <span className="taskit-label">{index + 1}. {employee.name}</span>
                    <span className="taskit-body">{employee.done}/{employee.total} {t('overview.completed').toLowerCase()}</span>
                    <div className="taskit-progress-track" aria-hidden>
                      <span
                        className="taskit-progress-fill"
                        style={{
                          width: `${employee.score}%`,
                          background: employee.score >= 80 ? '#059669' : employee.score >= 50 ? '#d97706' : '#dc2626',
                        }}
                      />
                    </div>
                  </div>
                  <span className="taskit-heading tabular-nums">{employee.score}%</span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="taskit-card">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">{t('overview.recentActivity')}</span>
              <h2 className="taskit-heading">{t('overview.recentMeta')}</h2>
            </div>
            <Link href="/dashboard/admin/tasks" className="taskit-secondary-action">
              <ArrowRight size={20} />
            </Link>
          </div>

          {!recentRows.length ? (
            <div className="taskit-empty-state">
              <p className="taskit-body">{t('overview.noActivityLogged')}</p>
            </div>
          ) : (
            <div className="taskit-activity-list">
              {recentRows.map((activity) => (
                <div key={activity.id} className="taskit-activity-row">
                  <div className="taskit-row-main">
                    <span className="taskit-label">{activity.user.name}</span>
                    <span className="taskit-body">{formatActivityAction(activity.action, t)}</span>
                    <span className="taskit-body">
                      {activity.task.project.title} / {activity.task.title}
                    </span>
                  </div>
                  <span className="taskit-label" suppressHydrationWarning>
                    {new Date(activity.createdAt).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="taskit-card">
        <div className="taskit-card-header">
          <div className="taskit-row-main">
            <span className="taskit-label">{t('overview.workspaceSignals')}</span>
            <h2 className="taskit-heading">{t('overview.workspaceSignalsMeta')}</h2>
          </div>
        </div>
        <div className="compact-stat-grid">
          {workspaceSignalCards.map((card) => {
            const Icon = card.icon
            return (
              <div key={card.label} className="compact-stat">
                <div className="taskit-row-main">
                  <span className="taskit-label">
                    <Icon size={20} aria-hidden style={{ display: 'inline', marginInlineEnd: 8 }} />
                    {card.label}
                  </span>
                  <span className="taskit-heading tabular-nums">
                    <AnimatedCounter value={card.value} />
                  </span>
                  <span className="taskit-body">{card.detail}</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <details className="taskit-card taskit-disclosure" onToggle={(event) => setAdditionalInsightsOpen(event.currentTarget.open)}>
        <summary className="taskit-cluster-button">
          <span className="taskit-heading">{t('overview.additionalInsights')}</span>
          <ChevronDown size={20} aria-hidden />
        </summary>
        {additionalInsightsOpen && (
          <div className="taskit-insight-grid">
            <article className="taskit-card">
              <div className="taskit-card-header">
                <div className="taskit-row-main">
                  <span className="taskit-label">{t('overview.statusMix')}</span>
                  <h2 className="taskit-heading">{t('overview.statusMixMeta')}</h2>
                </div>
              </div>
              {!localizedStageBreakdown.some((item) => item.value) ? (
                <EmptyChartState label={t('overview.noTaskData')} />
              ) : (
                <StatusBarChart data={localizedStageBreakdown} valueLabel={t('chart.tasks')} />
              )}
            </article>

            <article className="taskit-card">
              <div className="taskit-card-header">
                <div className="taskit-row-main">
                  <span className="taskit-label">{t('overview.rolesDistribution')}</span>
                  <h2 className="taskit-heading">{t('overview.rolesMeta')}</h2>
                </div>
              </div>
              {!localizedRoleDistribution.some((item) => item.value) ? (
                <EmptyChartState label={t('overview.noRoleData')} />
              ) : (
                <RolesPieChart data={localizedRoleDistribution} />
              )}
            </article>
          </div>
        )}
      </details>

      {commandCenter && (
        <section className="taskit-detail-grid">
          <article className="taskit-card">
            <div className="taskit-card-header">
              <div className="taskit-row-main">
                <span className="taskit-label">{t('overview.operationalGraph')}</span>
                <h2 className="taskit-heading">{t('overview.operationalGraphMeta')}</h2>
              </div>
              <BarChart3 size={20} aria-hidden />
            </div>
            <div className="taskit-graph-list">
              <div className="taskit-graph-row">
                <span className="taskit-label">{t('overview.nodes')}</span>
                <span className="taskit-heading tabular-nums">{commandCenter.graph.nodes}</span>
              </div>
              <div className="taskit-graph-row">
                <span className="taskit-label">{t('overview.edges')}</span>
                <span className="taskit-heading tabular-nums">{commandCenter.graph.edges}</span>
              </div>
              {graphCoverage.map((item) => (
                <div key={item.label} className="taskit-graph-row">
                  <span className="taskit-body">
                    <GraphCoverageLabel label={item.label} />
                  </span>
                  <span className="taskit-label tabular-nums">{item.count}</span>
                </div>
              ))}
            </div>
          </article>

          {isAgency && (
            <article className="taskit-card">
              <div className="taskit-card-header">
                <div className="taskit-row-main">
                  <span className="taskit-label">{t('overview.agencySetup')}</span>
                  <h2 className="taskit-heading">{t('overview.agencySetupMeta')}</h2>
                </div>
                <BriefcaseBusiness size={20} aria-hidden />
              </div>
              <Link href="/dashboard/admin/projects" className="taskit-secondary-action">
                <ArrowRight size={20} />
                {t('overview.organizeCampaigns')}
              </Link>
            </article>
          )}
        </section>
      )}

      {/* REDLINE 06 - The right drawer preserves every AI agent signal while keeping load state calm. */}
      <AgentDrawer
        open={agentDrawerOpen}
        agents={localizedAgents}
        tone={healthTone}
        onClose={() => setAgentDrawerOpen(false)}
      />
    </div>
  )
}
