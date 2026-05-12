'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Eye,
  Headphones,
  Link2,
  Loader2,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  Video,
  Zap,
} from 'lucide-react'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import {
  PlatformBreakdownChart,
  PlatformRevenuePie,
  RevenueTrendChart,
  SocialGrowthChart,
} from '@/components/integrations/SocialAnalyticsCharts'

type SocialProvider = {
  id: string
  slug: string
  displayName: string
  category: string
  status: string
  capabilities: Record<string, boolean>
  requiredScopes: string[]
  optionalScopes: string[]
  connectedCount: number
}

type SocialDashboard = {
  generatedAt: string
  range: { start: string; end: string; days: number }
  totals: {
    connectedAccounts: number
    creators: number
    contentItems: number
    views: number
    impressions: number
    engagementActions: number
    watchTimeSeconds: number
    revenue: number
    openInsights: number
    engagementRate: number
    revenuePerMille: number
  }
  accounts: Array<{
    id: string
    platform: string
    platformName: string
    displayName: string
    handle: string | null
    avatarUrl: string | null
    status: string
    healthStatus: string
    lastSyncAt: string | null
    updatedAt: string
    creator: { id: string; displayName: string; avatarUrl: string | null; status: string } | null
  }>
  creators: Array<{
    id: string
    displayName: string
    avatarUrl: string | null
    status: string
    connectedAccounts: Array<{ id: string; platformSlug: string; displayName: string; healthStatus: string }>
    accountCount: number
  }>
  growthSeries: Array<{ date: string; views: number; impressions: number; engagement: number; revenue: number }>
  platformBreakdown: Array<{ platform: string; views: number; impressions: number; engagementActions: number; revenue: number; engagementRate: number }>
  audience: Array<{ platform: string; dimension: string; segment: string; value: number; percentage: number | null; metricDate: string }>
  realtime: Array<{ platform: string; accountId: string; metricKey: string; value: number; unit: string; observedAt: string }>
  content: Array<{
    id: string
    accountId: string
    platform: string
    providerContentId: string
    contentType: string
    title: string
    url: string | null
    thumbnailUrl: string | null
    publishedAt: string | null
    metrics: unknown
    revenue: unknown
    lastSyncedAt: string | null
  }>
  insights: Array<{
    id: string
    connectedAccountId: string | null
    insightType: string
    severity: string
    title: string
    summary: string
    recommendation: string
    confidence: number
    generatedAt: string
  }>
  syncHealth: Array<{
    id: string
    connectedAccountId: string | null
    providerSlug: string
    jobType: string
    status: string
    attempts: number
    maxAttempts: number
    scheduledFor: string
    startedAt: string | null
    completedAt: string | null
    error: string | null
    createdAt: string
  }>
}

type SocialTab =
  | 'overview'
  | 'youtube'
  | 'spotify'
  | 'audience'
  | 'revenue'
  | 'content'
  | 'growth'
  | 'realtime'
  | 'creators'
  | 'connected'

type SocialAnalyticsState = {
  tab: SocialTab
  provider: string
  days: number
  setTab: (tab: SocialTab) => void
  setProvider: (provider: string) => void
  setDays: (days: number) => void
}

const useSocialAnalyticsStore = create<SocialAnalyticsState>((set) => ({
  tab: 'overview',
  provider: 'all',
  days: 30,
  setTab: (tab) => set({ tab }),
  setProvider: (provider) => set({ provider }),
  setDays: (days) => set({ days }),
}))

const REALTIME_EVENTS = [
  'social_account_connected',
  'social_account_disconnected',
  'social_sync_completed',
  'social_metrics_updated',
  'social_insight_created',
  'social_webhook_processed',
] as const

const tabItems: Array<{ id: SocialTab; label: string; icon: typeof BarChart3 }> = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'youtube', label: 'YouTube', icon: Video },
  { id: 'spotify', label: 'Spotify', icon: Headphones },
  { id: 'audience', label: 'Audience', icon: Users },
  { id: 'revenue', label: 'Revenue', icon: CircleDollarSign },
  { id: 'content', label: 'Content', icon: Activity },
  { id: 'growth', label: 'Growth', icon: TrendingUp },
  { id: 'realtime', label: 'Realtime', icon: Radio },
  { id: 'creators', label: 'Creators', icon: UserRound },
  { id: 'connected', label: 'Connected', icon: Link2 },
]

function compactNumber(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: value >= 1000 ? 1 : 0 }).format(value)
}

function currency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value)
}

function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`
}

function dateLabel(value: string | null) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function healthTone(status: string) {
  if (status === 'HEALTHY') return { color: '#059669', bg: 'rgba(5,150,105,0.1)', icon: CheckCircle2 }
  if (status.includes('FAILED') || status === 'NEEDS_REAUTH') return { color: '#dc2626', bg: 'rgba(220,38,38,0.08)', icon: AlertTriangle }
  return { color: '#d97706', bg: 'rgba(217,119,6,0.1)', icon: Clock3 }
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-10 text-center text-sm font-semibold text-[var(--text-muted)]">
      {label}
    </div>
  )
}

function StatCard({ label, value, help, icon: Icon, color }: { label: string; value: string; help: string; icon: typeof Eye; color: string }) {
  return (
    <article className="stat-card">
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        <div className="stat-card-icon" style={{ background: `${color}16` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <div className="stat-card-value" style={{ color }}>
        {value}
      </div>
      <div className="stat-card-delta">
        <span>{help}</span>
      </div>
    </article>
  )
}

export default function SocialAnalyticsClient() {
  const { tab, provider, days, setTab, setProvider, setDays } = useSocialAnalyticsStore()
  const searchParams = useSearchParams()
  const [providers, setProviders] = useState<SocialProvider[]>([])
  const [dashboard, setDashboard] = useState<SocialDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const effectiveProvider = tab === 'youtube' ? 'youtube' : tab === 'spotify' ? 'spotify' : provider
  const oauthError = searchParams.get('integration_error')
  const connectedProvider = searchParams.get('connected')

  const load = useCallback(async () => {
    setError(null)
    const params = new URLSearchParams({ days: String(days) })
    if (effectiveProvider !== 'all') params.set('provider', effectiveProvider)
    const [providerResponse, dashboardResponse] = await Promise.all([
      fetch('/api/integrations/providers', { cache: 'no-store' }),
      fetch(`/api/integrations/analytics/overview?${params.toString()}`, { cache: 'no-store' }),
    ])
    if (!providerResponse.ok || !dashboardResponse.ok) {
      setError('Social analytics could not be loaded.')
      setLoading(false)
      return
    }
    const providerBody = (await providerResponse.json()) as { providers: SocialProvider[] }
    const dashboardBody = (await dashboardResponse.json()) as SocialDashboard
    setProviders(providerBody.providers)
    setDashboard(dashboardBody)
    setLoading(false)
  }, [days, effectiveProvider])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useRealtimeSubscription(REALTIME_EVENTS, () => {
    void load()
  }, { debounceMs: 450, pollingIntervalMs: 30_000 })

  const activeProviders = providers.filter((item) => item.status === 'ACTIVE')
  const connectedProviderSlugs = new Set(dashboard?.accounts.map((account) => account.platform) ?? [])
  const totalWatchHours = Math.round((dashboard?.totals.watchTimeSeconds ?? 0) / 3600)

  const scopedPlatformBreakdown = useMemo(
    () => dashboard?.platformBreakdown ?? [],
    [dashboard?.platformBreakdown]
  )

  async function runSync(accountId: string) {
    setSyncingAccountId(accountId)
    await fetch(`/api/integrations/accounts/${accountId}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncMode: 'incremental' }),
    }).finally(() => setSyncingAccountId(null))
    await load()
  }

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div className="min-w-0">
          <div className="dashboard-hero-kicker">
            <Sparkles size={13} />
            Creator intelligence
          </div>
          <h1 className="page-heading mt-4">Social analytics command center</h1>
          <p className="page-sub max-w-2xl">Cross-platform creator performance, revenue, audience, realtime metrics, and AI insights.</p>
        </div>
        <div className="dashboard-hero-actions">
          <select className="input max-w-[190px]" value={provider} onChange={(event) => setProvider(event.target.value)}>
            <option value="all">All platforms</option>
            {activeProviders.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.displayName}
              </option>
            ))}
          </select>
          <select className="input max-w-[150px]" value={days} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={365}>365 days</option>
          </select>
        </div>
      </section>

      <section className="card">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabItems.map((item) => {
            const Icon = item.icon
            const active = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`filter-chip ${active ? 'filter-chip-active' : ''} inline-flex shrink-0 items-center gap-2`}
                onClick={() => setTab(item.id)}
              >
                <Icon size={14} />
                {item.label}
              </button>
            )
          })}
        </div>
      </section>

      {(oauthError || error) && (
        <section className="card border-red-200 bg-red-50 text-sm font-semibold text-red-700">
          {oauthError ?? error}
        </section>
      )}

      {!oauthError && connectedProvider && (
        <section className="card border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700">
          {connectedProvider} connected. Initial sync is running.
        </section>
      )}

      {loading || !dashboard ? (
        <div className="dashboard-stat-grid">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="stat-card loading-shimmer" aria-label="Loading social metric" />
          ))}
        </div>
      ) : (
        <>
          <section className="dashboard-stat-grid">
            <StatCard label="Views" value={compactNumber(dashboard.totals.views)} help={`${compactNumber(dashboard.totals.impressions)} impressions`} icon={Eye} color="#0369a1" />
            <StatCard label="Engagement" value={percent(dashboard.totals.engagementRate)} help={`${compactNumber(dashboard.totals.engagementActions)} actions`} icon={Zap} color="#059669" />
            <StatCard label="Revenue" value={currency(dashboard.totals.revenue)} help={`${currency(dashboard.totals.revenuePerMille)} RPM`} icon={CircleDollarSign} color="#d97706" />
            <StatCard label="Watch time" value={compactNumber(totalWatchHours)} help="hours synced" icon={Clock3} color="#7c3aed" />
          </section>

          {(tab === 'overview' || tab === 'growth' || tab === 'youtube' || tab === 'spotify') && (
            <section className="dashboard-section-grid">
              <article className="card">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Growth trend</h2>
                    <p className="panel-meta">{dashboard.range.days} day performance window</p>
                  </div>
                  <TrendingUp size={19} className="text-[var(--accent)]" />
                </div>
                {dashboard.growthSeries.some((item) => item.views || item.engagement) ? <SocialGrowthChart data={dashboard.growthSeries} /> : <EmptyPanel label="No synced growth metrics yet" />}
              </article>

              <article className="card">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Platform mix</h2>
                    <p className="panel-meta">Views by connected platform</p>
                  </div>
                  <BarChart3 size={19} className="text-[var(--accent)]" />
                </div>
                {scopedPlatformBreakdown.some((item) => item.views) ? <PlatformBreakdownChart data={scopedPlatformBreakdown} /> : <EmptyPanel label="No platform metrics yet" />}
              </article>
            </section>
          )}

          {(tab === 'revenue' || tab === 'overview') && (
            <section className="dashboard-section-grid">
              <article className="card">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Revenue analytics</h2>
                    <p className="panel-meta">Estimated social revenue</p>
                  </div>
                  <CircleDollarSign size={19} className="text-[var(--gold)]" />
                </div>
                {dashboard.growthSeries.some((item) => item.revenue) ? <RevenueTrendChart data={dashboard.growthSeries} /> : <EmptyPanel label="No revenue metrics synced yet" />}
              </article>
              <article className="card">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Revenue mix</h2>
                    <p className="panel-meta">Revenue by platform</p>
                  </div>
                </div>
                {scopedPlatformBreakdown.some((item) => item.revenue) ? <PlatformRevenuePie data={scopedPlatformBreakdown} /> : <EmptyPanel label="No monetization rows yet" />}
              </article>
            </section>
          )}

          {(tab === 'audience' || tab === 'overview') && (
            <section className="card">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Audience intelligence</h2>
                  <p className="panel-meta">Demographic and geography segments</p>
                </div>
                <Users size={19} className="text-[var(--accent)]" />
              </div>
              {dashboard.audience.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {dashboard.audience.slice(0, 12).map((item) => (
                    <div key={`${item.platform}-${item.dimension}-${item.segment}`} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">{item.platform}</span>
                        <strong className="text-sm text-[var(--accent)]">{item.percentage === null ? compactNumber(item.value) : percent(item.percentage)}</strong>
                      </div>
                      <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{item.segment}</div>
                      <div className="text-xs text-[var(--text-muted)]">{item.dimension}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel label="No audience segments synced yet" />
              )}
            </section>
          )}

          {(tab === 'content' || tab === 'youtube' || tab === 'spotify') && (
            <section className="card">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Content performance</h2>
                  <p className="panel-meta">{dashboard.content.length} synced content records</p>
                </div>
                <Activity size={19} className="text-[var(--accent)]" />
              </div>
              {dashboard.content.length ? (
                <div className="mt-4 grid gap-3">
                  {dashboard.content.slice(0, 16).map((item) => (
                    <div key={item.id} className="grid gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                      <div className="icon-box h-10 w-10 bg-[var(--accent-subtle)] text-[var(--accent)]">
                        {item.platform === 'spotify' ? <Headphones size={18} /> : <Video size={18} />}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.title}</div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          {item.platform} / {item.contentType} / {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : 'Unpublished'}
                        </div>
                      </div>
                      {item.url && (
                        <Link href={item.url} target="_blank" className="btn-secondary btn-sm">
                          <Link2 size={14} />
                          Open
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel label="No content synced yet" />
              )}
            </section>
          )}

          {(tab === 'realtime' || tab === 'overview') && (
            <section className="card">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Realtime monitoring</h2>
                  <p className="panel-meta">Latest live metric observations</p>
                </div>
                <Radio size={19} className="text-[var(--success)]" />
              </div>
              {dashboard.realtime.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {dashboard.realtime.slice(0, 16).map((item) => (
                    <div key={`${item.accountId}-${item.metricKey}-${item.observedAt}`} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
                      <div className="text-xs font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">{item.platform}</div>
                      <div className="mt-2 text-xl font-bold text-[var(--text-primary)]">{compactNumber(item.value)}</div>
                      <div className="text-xs text-[var(--text-muted)]">{item.metricKey} / {item.unit}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel label="No realtime metrics yet" />
              )}
            </section>
          )}

          {(tab === 'creators' || tab === 'overview') && (
            <section className="dashboard-section-grid">
              <article className="card">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Creator management</h2>
                    <p className="panel-meta">{dashboard.creators.length} creator profiles</p>
                  </div>
                  <UserRound size={19} className="text-[var(--accent)]" />
                </div>
                {dashboard.creators.length ? (
                  <div className="mt-4 grid gap-3">
                    {dashboard.creators.map((creator) => (
                      <div key={creator.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-sm text-[var(--text-primary)]">{creator.displayName}</strong>
                          <span className="badge badge-employee">{creator.accountCount} accounts</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {creator.connectedAccounts.map((account) => (
                            <span key={account.id} className="filter-chip">
                              {account.platformSlug}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel label="No creator profiles yet" />
                )}
              </article>

              <article className="card">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">AI insights</h2>
                    <p className="panel-meta">{dashboard.insights.length} open recommendations</p>
                  </div>
                  <BrainCircuit size={19} className="text-[var(--accent)]" />
                </div>
                {dashboard.insights.length ? (
                  <div className="mt-4 grid gap-3">
                    {dashboard.insights.slice(0, 6).map((insight) => (
                      <div key={insight.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-sm text-[var(--text-primary)]">{insight.title}</strong>
                          <span className="text-xs font-bold text-[var(--accent)]">{Math.round(insight.confidence * 100)}%</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{insight.summary}</p>
                        <div className="mt-3 rounded-[var(--radius-sm)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">
                          {insight.recommendation}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel label="No AI insights generated yet" />
                )}
              </article>
            </section>
          )}

          {tab === 'connected' && (
            <section className="dashboard-section-grid">
              <article className="card">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Connected accounts</h2>
                    <p className="panel-meta">{dashboard.accounts.length} active connections</p>
                  </div>
                  <ShieldCheck size={19} className="text-[var(--success)]" />
                </div>
                {dashboard.accounts.length ? (
                  <div className="mt-4 grid gap-3">
                    {dashboard.accounts.map((account) => {
                      const tone = healthTone(account.healthStatus)
                      const HealthIcon = tone.icon
                      return (
                        <div key={account.id} className="grid gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <strong className="text-sm text-[var(--text-primary)]">{account.displayName}</strong>
                              <span className="badge badge-employee">{account.platformName}</span>
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: tone.bg, color: tone.color }}>
                                <HealthIcon size={11} />
                                {account.healthStatus}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-[var(--text-muted)]">Last sync {dateLabel(account.lastSyncAt)}</div>
                          </div>
                          <button type="button" className="btn-secondary btn-sm" onClick={() => runSync(account.id)} disabled={syncingAccountId === account.id}>
                            {syncingAccountId === account.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            Sync
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <EmptyPanel label="No connected accounts yet" />
                )}
              </article>

              <article className="card">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Available platforms</h2>
                    <p className="panel-meta">OAuth providers</p>
                  </div>
                  <Link2 size={19} className="text-[var(--accent)]" />
                </div>
                <div className="mt-4 grid gap-3">
                  {activeProviders.map((item) => (
                    <div key={item.slug} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <strong className="text-sm text-[var(--text-primary)]">{item.displayName}</strong>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">{item.requiredScopes.length + item.optionalScopes.length} OAuth scopes</div>
                        </div>
                        <Link href={`/api/integrations/oauth/${item.slug}/start?returnTo=${encodeURIComponent('/dashboard/admin/social-analytics')}`} className="btn-primary btn-sm">
                          <Link2 size={14} />
                          {connectedProviderSlugs.has(item.slug) ? 'Add' : 'Connect'}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          )}
        </>
      )}
    </div>
  )
}
