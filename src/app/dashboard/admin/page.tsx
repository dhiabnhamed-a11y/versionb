'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { ClipboardList, CheckCircle2, CheckSquare, Zap, AlertTriangle, Users, ArrowRight, Bell } from 'lucide-react'

interface Stats {
  totalTasks: number; doneTasks: number; inProgressTasks: number
  overdueTasks: number; totalEmployees: number
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
    fetch('/api/analytics').then(r => r.json()).then(d => { setStats(d); setLoading(false) })
  }, [])

  const user = session?.user as any

  const statCards = stats ? [
    { label: 'Total Tasks', value: stats.totalTasks, icon: ClipboardList, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
    { label: 'Completed', value: stats.doneTasks, icon: CheckCircle2, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
    { label: 'In Progress', value: stats.inProgressTasks, icon: Zap, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
    { label: 'Overdue', value: stats.overdueTasks, icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
    { label: 'Team Members', value: stats.totalEmployees, icon: Users, color: '#06b6d4', bg: 'rgba(6,182,212,0.08)' },
  ] : []

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px', letterSpacing: '-0.02em' }}>
          <span suppressHydrationWarning>{greeting}</span>, <span className="gradient-text">{user?.name?.split(' ')[0]}</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Here&apos;s what&apos;s happening across your workspace today.</p>
      </div>

      {/* Stats */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '28px' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="stat-card" style={{ height: '110px' }}>
              <div style={{ width: '36px', height: '36px', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '12px' }} />
              <div style={{ width: '50%', height: '10px', background: 'var(--bg-elevated)', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '28px' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Employee Performance */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '-0.01em' }}>Team Performance</h2>
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
            <h2 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '18px', letterSpacing: '-0.01em' }}>Task Breakdown</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { label: 'Completed', value: stats.doneTasks, total: stats.totalTasks, color: '#10b981' },
                { label: 'In Progress', value: stats.inProgressTasks, total: stats.totalTasks, color: '#3b82f6' },
                { label: 'Overdue', value: stats.overdueTasks, total: stats.totalTasks, color: '#ef4444' },
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

            <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <a href="/dashboard/admin/tasks" className="btn-secondary" style={{ textAlign: 'center', textDecoration: 'none', fontSize: '12px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <CheckSquare size={14} /> View Tasks
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
