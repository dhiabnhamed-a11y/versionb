'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BedDouble,
  Building2,
  CheckCircle2,
  Clock,
  HeartPulse,
  ShieldCheck,
  Siren,
  TrendingUp,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react'

type HealthcareStats = {
  departments: number
  assets: { total: number; operational: number; maintenance: number; critical: number; avgHealth: number }
  incidents: { total: number; open: number; critical: number; resolved: number }
  workOrders: { total: number; open: number; overdue: number; completed: number }
  compliance: { total: number; compliant: number; score: number }
  teams: number
  staff: number
  tasks: { total: number; done: number; inProgress: number; overdue: number }
}

function AnimatedValue({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (value === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value)
      return
    }
    let frame = 0
    let start = 0
    const tick = (time: number) => {
      start ||= time
      const p = Math.min((time - start) / 700, 1)
      setDisplay(Math.floor(value * p))
      if (p < 1) frame = requestAnimationFrame(tick)
      else setDisplay(value)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <span className="tabular-nums">{display}{suffix}</span>
}

function KpiCard({
  label,
  value,
  detail,
  tone,
  href,
  icon: Icon,
}: {
  label: string
  value: string | number
  detail?: string
  tone?: 'good' | 'warning' | 'critical' | 'neutral'
  href?: string
  icon?: React.ElementType
}) {
  const toneClass = tone === 'good' ? 'hc-stat-good' : tone === 'warning' ? 'hc-stat-warning' : tone === 'critical' ? 'hc-stat-critical' : ''
  const content = (
    <div className={`hc-stat-card ${toneClass}`} style={{ cursor: href ? 'pointer' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="hc-stat-label">{label}</div>
        {Icon && <Icon size={16} style={{ color: 'var(--text-light)', opacity: 0.6 }} />}
      </div>
      <div className="hc-stat-value">{typeof value === 'number' ? <AnimatedValue value={value} /> : value}</div>
      {detail && <div className="hc-stat-detail">{detail}</div>}
    </div>
  )
  if (href) return <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{content}</Link>
  return content
}

function QuickActionCard({
  label,
  description,
  href,
  icon: Icon,
  color,
}: {
  label: string
  description: string
  href: string
  icon: React.ElementType
  color: string
}) {
  return (
    <Link href={href} className="hc-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            flexShrink: 0,
            width: 40,
            height: 40,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${color}15`,
            color,
          }}
        >
          <Icon size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{description}</div>
        </div>
        <ArrowRight size={16} style={{ color: 'var(--text-light)', flexShrink: 0 }} />
      </div>
    </Link>
  )
}

export default function HealthcareOverview() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<HealthcareStats | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const response = await fetch('/api/analytics', { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to load')
      const data = await response.json()

      // Build healthcare stats from the analytics data
      setStats({
        departments: data.totalProjects || 0,
        assets: {
          total: 0,
          operational: 0,
          maintenance: 0,
          critical: 0,
          avgHealth: 0,
        },
        incidents: {
          total: 0,
          open: 0,
          critical: 0,
          resolved: 0,
        },
        workOrders: {
          total: 0,
          open: 0,
          overdue: 0,
          completed: 0,
        },
        compliance: {
          total: 0,
          compliant: 0,
          score: 0,
        },
        teams: 0,
        staff: data.totalEmployees || 0,
        tasks: {
          total: data.totalTasks || 0,
          done: data.doneTasks || 0,
          inProgress: data.inProgressTasks || 0,
          overdue: data.overdueTasks || 0,
        },
      })
    } catch {
      // Use zero-state
      setStats({
        departments: 0,
        assets: { total: 0, operational: 0, maintenance: 0, critical: 0, avgHealth: 0 },
        incidents: { total: 0, open: 0, critical: 0, resolved: 0 },
        workOrders: { total: 0, open: 0, overdue: 0, completed: 0 },
        compliance: { total: 0, compliant: 0, score: 0 },
        teams: 0,
        staff: 0,
        tasks: { total: 0, done: 0, inProgress: 0, overdue: 0 },
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const user = session?.user as { name?: string } | undefined
  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 17) return 'Good Afternoon'
    return 'Good Evening'
  })()

  const today = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date())

  const taskCompletion = stats?.tasks.total
    ? Math.round((stats.tasks.done / stats.tasks.total) * 100)
    : 0

  // Overall operational health
  const overallHealth = stats
    ? Math.round(
        Math.max(0, Math.min(100,
          (taskCompletion * 0.4) +
          ((stats.tasks.overdue === 0 ? 100 : Math.max(0, 100 - stats.tasks.overdue * 15)) * 0.3) +
          ((stats.staff > 0 ? 80 : 60) * 0.3)
        ))
      )
    : 0

  const healthTone = overallHealth >= 85 ? 'good' : overallHealth >= 60 ? 'warning' : 'critical'

  if (loading) {
    return (
      <div>
        <div className="hc-page-header">
          <div className="hc-page-header-copy">
            <div className="hc-page-sup">Operations Dashboard</div>
            <h1 className="hc-page-title">Loading...</h1>
          </div>
        </div>
        <div className="hc-stat-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="hc-stat-card">
              <div className="loading-shimmer" style={{ height: 12, width: 80, borderRadius: 6 }} />
              <div className="loading-shimmer" style={{ height: 28, width: 50, borderRadius: 6, marginTop: 8 }} />
              <div className="loading-shimmer" style={{ height: 10, width: 100, borderRadius: 6, marginTop: 6 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="hc-page-header">
        <div className="hc-page-header-copy">
          <div className="hc-page-sup">Operations Dashboard</div>
          <h1 className="hc-page-title">{greeting}, {user?.name?.split(' ')[0] || 'Doctor'}</h1>
          <p className="hc-page-desc">{today} · Hospital operations overview</p>
        </div>
        <div className="hc-page-actions">
          <Link
            href="/dashboard/admin/requests"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 10,
              background: '#0ea5e9',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'background 0.15s',
            }}
          >
            <Siren size={15} />
            Report Incident
          </Link>
        </div>
      </div>

      {/* Operational Health Score */}
      <div
        className="hc-card"
        style={{
          marginBottom: 20,
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: healthTone === 'good' ? 'rgba(5, 150, 105, 0.1)' : healthTone === 'warning' ? 'rgba(217, 119, 6, 0.1)' : 'rgba(220, 38, 38, 0.1)',
              color: healthTone === 'good' ? '#059669' : healthTone === 'warning' ? '#d97706' : '#dc2626',
              fontSize: 22,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {overallHealth}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Operational Health Score
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {healthTone === 'good' ? 'All systems operating normally' : healthTone === 'warning' ? 'Some areas need attention' : 'Critical issues detected'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className={`hc-badge ${healthTone === 'good' ? 'hc-badge-operational' : healthTone === 'warning' ? 'hc-badge-maintenance' : 'hc-badge-critical'}`}>
            {healthTone === 'good' ? 'Healthy' : healthTone === 'warning' ? 'Monitor' : 'Alert'}
          </span>
          <span className="hc-badge hc-badge-inspection" suppressHydrationWarning>
            <Clock size={11} style={{ marginRight: 3 }} />
            {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="hc-stat-grid" style={{ marginBottom: 20 }}>
        <KpiCard
          label="Work Orders"
          value={stats?.tasks.total || 0}
          detail={`${stats?.tasks.done || 0} completed · ${stats?.tasks.overdue || 0} overdue`}
          tone={stats?.tasks.overdue ? 'warning' : 'good'}
          href="/dashboard/admin/tasks"
          icon={Wrench}
        />
        <KpiCard
          label="Completion Rate"
          value={`${taskCompletion}%`}
          detail={`${stats?.tasks.done || 0} of ${stats?.tasks.total || 0} work orders`}
          tone={taskCompletion >= 80 ? 'good' : taskCompletion >= 50 ? 'warning' : 'critical'}
          icon={TrendingUp}
        />
        <KpiCard
          label="In Progress"
          value={stats?.tasks.inProgress || 0}
          detail="Active work orders"
          tone={stats?.tasks.inProgress ? 'warning' : 'neutral'}
          href="/dashboard/admin/tasks"
          icon={Activity}
        />
        <KpiCard
          label="Overdue Items"
          value={stats?.tasks.overdue || 0}
          detail={stats?.tasks.overdue ? 'Requires immediate attention' : 'No overdue items'}
          tone={stats?.tasks.overdue ? 'critical' : 'good'}
          href="/dashboard/admin/tasks"
          icon={AlertTriangle}
        />
        <KpiCard
          label="Staff Members"
          value={stats?.staff || 0}
          detail="Active team members"
          href="/dashboard/admin/employees"
          icon={Users}
        />
        <KpiCard
          label="Departments"
          value={stats?.departments || 0}
          detail="Operational units"
          href="/dashboard/admin/departments"
          icon={Building2}
        />
      </div>

      {/* Task/Work Order Breakdown */}
      {stats && stats.tasks.total > 0 && (
        <div className="hc-card" style={{ marginBottom: 20 }}>
          <div className="hc-card-header">
            <div>
              <div className="hc-card-title">Work Order Pipeline</div>
              <div className="hc-card-sub">{stats.tasks.total} total work orders</div>
            </div>
            <Activity size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="hc-card-body">
            <div style={{ display: 'flex', gap: 4, height: 28, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              {stats.tasks.done > 0 && (
                <div
                  style={{
                    flex: stats.tasks.done,
                    background: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'white',
                    borderRadius: '8px 0 0 8px',
                    minWidth: stats.tasks.done > 0 ? 32 : 0,
                  }}
                >
                  {stats.tasks.done}
                </div>
              )}
              {stats.tasks.inProgress > 0 && (
                <div
                  style={{
                    flex: stats.tasks.inProgress,
                    background: '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'white',
                    minWidth: stats.tasks.inProgress > 0 ? 32 : 0,
                  }}
                >
                  {stats.tasks.inProgress}
                </div>
              )}
              {(stats.tasks.total - stats.tasks.done - stats.tasks.inProgress) > 0 && (
                <div
                  style={{
                    flex: stats.tasks.total - stats.tasks.done - stats.tasks.inProgress,
                    background: 'var(--bg-elevated, #e2e8f0)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    borderRadius: '0 8px 8px 0',
                    minWidth: 32,
                  }}
                >
                  {stats.tasks.total - stats.tasks.done - stats.tasks.inProgress}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#059669' }} />
                Completed ({stats.tasks.done})
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#d97706' }} />
                In Progress ({stats.tasks.inProgress})
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--bg-elevated, #e2e8f0)' }} />
                Pending ({stats.tasks.total - stats.tasks.done - stats.tasks.inProgress})
              </div>
              {stats.tasks.overdue > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                  <AlertTriangle size={12} />
                  {stats.tasks.overdue} Overdue
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Quick Actions
        </div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          <QuickActionCard
            label="View Patients"
            description="Patient records and admissions"
            href="/dashboard/admin/patients"
            icon={UserRound}
            color="#0ea5e9"
          />
          <QuickActionCard
            label="Departments"
            description="Clinical units and operations"
            href="/dashboard/admin/departments"
            icon={Building2}
            color="#8b5cf6"
          />
          <QuickActionCard
            label="Asset Registry"
            description="Biomedical equipment lifecycle"
            href="/dashboard/admin/assets"
            icon={HeartPulse}
            color="#059669"
          />
          <QuickActionCard
            label="Maintenance"
            description="Work orders and SLA tracking"
            href="/dashboard/admin/maintenance"
            icon={Wrench}
            color="#d97706"
          />
          <QuickActionCard
            label="Shift Management"
            description="Staff scheduling and coverage"
            href="/dashboard/admin/shifts"
            icon={Clock}
            color="#0284c7"
          />
          <QuickActionCard
            label="Compliance & Audit"
            description="Regulatory controls and audit trail"
            href="/dashboard/admin/compliance"
            icon={ShieldCheck}
            color="#059669"
          />
          <QuickActionCard
            label="Emergency Center"
            description="Critical alerts and emergency ops"
            href="/dashboard/admin/emergency-center"
            icon={Siren}
            color="#dc2626"
          />
          <QuickActionCard
            label="Operational Reports"
            description="Analytics and KPI dashboards"
            href="/dashboard/admin/reports"
            icon={BarChart3}
            color="#6366f1"
          />
        </div>
      </div>
    </div>
  )
}
