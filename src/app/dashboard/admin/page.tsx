'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { getCompanyTypeCopy, normalizeCompanyType } from '@/lib/company-types'
import { ClipboardList, CheckCircle2, CheckSquare, Zap, AlertTriangle, Users, Bell, Building2, BriefcaseBusiness } from 'lucide-react'

interface Stats {
  totalTasks: number; doneTasks: number; inProgressTasks: number
  overdueTasks: number; totalEmployees: number
  roomCount: number
  submissionCount: number
  companyType?: string
  performance: { name: string; done: number; total: number; score: number }[]
}

function AnimatedCounter({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const step = value / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= value) { setDisplay(value); clearInterval(timer) }
      else setDisplay(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [value, duration])
  return <>{display}</>
}

export default function AdminDashboard() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadStats = async () => {
      const data = (await fetch('/api/analytics').then((response) => response.json())) as Stats
      if (!active) return
      setStats(data)
      setLoading(false)
    }

    void loadStats()

    return () => {
      active = false
    }
  }, [])

  const user = session?.user as { name?: string; companyType?: string | null }
  const companyType = normalizeCompanyType(stats?.companyType ?? user?.companyType)
  const companyCopy = getCompanyTypeCopy(companyType)

  const statCards = stats
    ? [
        ...(companyType === 'INDUSTRY'
          ? [{ label: companyCopy.groupPluralLabel, value: stats.roomCount, icon: Building2, color: '#2142ff', bg: 'rgba(33,66,255,0.09)' }]
          : companyType === 'DIGITAL_AGENCY'
            ? [
                {
                  label: 'Uploaded deliverables',
                  value: stats.submissionCount,
                  icon: BriefcaseBusiness,
                  color: '#7c3aed',
                  bg: 'rgba(124,58,237,0.08)',
                },
              ]
            : []),
        { label: 'Total Tasks', value: stats.totalTasks, icon: ClipboardList, color: '#0f766e', bg: 'rgba(15,118,110,0.1)' },
        { label: 'Completed', value: stats.doneTasks, icon: CheckCircle2, color: '#059669', bg: 'rgba(5,150,105,0.09)' },
        { label: 'In Progress', value: stats.inProgressTasks, icon: Zap, color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
        { label: 'Overdue', value: stats.overdueTasks, icon: AlertTriangle, color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
        { label: 'Team Members', value: stats.totalEmployees, icon: Users, color: '#0e7490', bg: 'rgba(14,116,144,0.09)' },
      ]
    : []

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="dashboard-page" style={{ maxWidth: '1100px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 className="page-heading">
          <span suppressHydrationWarning>{greeting}</span>,{' '}
          <span className="gradient-text">{user?.name?.split(' ')[0]}</span>
        </h1>
        <p className="page-sub">
          {companyType === 'INDUSTRY'
            ? "Here's momentum across your rooms, projects, and tasks today."
            : companyType === 'DIGITAL_AGENCY'
              ? "Here's how briefs, execution, and uploaded deliverables are moving today."
              : "Here's momentum across your workspace today."}
        </p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="dashboard-stat-grid">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="stat-card" style={{ height: '110px' }}>
              <div style={{ width: '36px', height: '36px', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '12px' }} />
              <div style={{ width: '50%', height: '10px', background: 'var(--bg-elevated)', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="dashboard-stat-grid">
          {statCards.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={s.label} className="stat-card animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="icon-box" style={{ width: '36px', height: '36px', background: s.bg, marginBottom: '14px' }}>
                  <Icon size={18} style={{ color: s.color }} />
                </div>
                <div style={{ fontSize: '28px', fontWeight: '800', color: s.color, lineHeight: 1, marginBottom: '4px', letterSpacing: '-0.02em' }}>
                  <AnimatedCounter value={s.value} />
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '500' }}>{s.label}</div>
              </div>
            )
          })}
        </div>
      )}

      <div className="dashboard-two-col">
        {/* Employee Performance */}
          <div className="card">
            <div className="mb-[18px] flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold tracking-tight">Team performance</h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>By completion rate</span>
            </div>
          {!stats?.performance?.length ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
              <Users size={28} style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />
              <p style={{ fontSize: '13px' }}>No team members yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats.performance.sort((a, b) => b.score - a.score).map((emp, i) => (
                <div key={emp.name} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: 'white' }}>
                        {i + 1}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>{emp.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{emp.done}/{emp.total}</span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: emp.score >= 80 ? '#10b981' : emp.score >= 50 ? '#f59e0b' : '#ef4444' }}>{emp.score}%</span>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${emp.score}%`, background: emp.score >= 80 ? 'linear-gradient(90deg, #10b981, #34d399)' : emp.score >= 50 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #ef4444, #f87171)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Task breakdown + Quick actions */}
        {stats && (
          <div className="card">
            <h2 className="font-display mb-[18px] text-base font-semibold tracking-tight">
              {companyType === 'DIGITAL_AGENCY' ? 'Brief breakdown' : 'Task breakdown'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { label: 'Completed', value: stats.doneTasks, total: stats.totalTasks, color: '#059669' },
                { label: 'In Progress', value: stats.inProgressTasks, total: stats.totalTasks, color: '#0f766e' },
                { label: 'Overdue', value: stats.overdueTasks, total: stats.totalTasks, color: '#dc2626' },
              ].map(item => {
                const pct = stats.totalTasks ? Math.round((item.value / stats.totalTasks) * 100) : 0
                return (
                  <div key={item.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{item.label}</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: item.color }}>{item.value} <span style={{ color: 'var(--text-muted)', fontWeight: '400', fontSize: '11px' }}>({pct}%)</span></span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: item.color }} /></div>
                  </div>
                )
              })}
              {stats.totalTasks === 0 && (
                <p style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>No tasks yet</p>
              )}
            </div>

            <div className="dashboard-action-grid" style={{ marginTop: '20px' }}>
              <a href="/dashboard/admin/tasks" className="btn-secondary" style={{ textAlign: 'center', textDecoration: 'none', fontSize: '12px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <CheckSquare size={14} /> View {companyCopy.taskPluralLabel}
              </a>
              <a href="/dashboard/admin/alerts" className="btn-primary" style={{ textAlign: 'center', textDecoration: 'none', fontSize: '12px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Bell size={14} /> Send Alert
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
