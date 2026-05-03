'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { getCompanyTypeCopy, normalizeCompanyType } from '@/lib/company-types'
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  FolderKanban,
  Plus,
  Sparkles,
  UploadCloud,
  Users,
  Zap,
} from 'lucide-react'

interface Stats {
  totalTasks: number
  doneTasks: number
  inProgressTasks: number
  overdueTasks: number
  totalEmployees: number
  roomCount: number
  submissionCount: number
  companyType?: string
  performance: { name: string; done: number; total: number; score: number }[]
}

function AnimatedCounter({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let start = 0
    const step = Math.max(1, value / (duration / 16))
    const timer = setInterval(() => {
      start += step
      if (start >= value) {
        setDisplay(value)
        clearInterval(timer)
      } else {
        setDisplay(Math.floor(start))
      }
    }, 16)

    return () => clearInterval(timer)
  }, [value, duration])

  return <span className="tabular-nums">{display}</span>
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
  const isAgency = companyType === 'DIGITAL_AGENCY'
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
                },
              ]
            : []),
        {
          label: companyCopy.taskPluralLabel,
          value: stats.totalTasks,
          icon: ClipboardList,
          color: '#0f766e',
          bg: 'rgba(15,118,110,0.1)',
          help: 'Total work items',
        },
        {
          label: 'Completed',
          value: stats.doneTasks,
          icon: CheckCircle2,
          color: '#059669',
          bg: 'rgba(5,150,105,0.09)',
          help: 'Finished work',
        },
        {
          label: 'In progress',
          value: stats.inProgressTasks,
          icon: Zap,
          color: '#d97706',
          bg: 'rgba(217,119,6,0.1)',
          help: 'Currently active',
        },
        {
          label: 'Overdue',
          value: stats.overdueTasks,
          icon: AlertTriangle,
          color: '#dc2626',
          bg: 'rgba(220,38,38,0.08)',
          help: 'Needs attention',
        },
        {
          label: 'Team',
          value: stats.totalEmployees,
          icon: Users,
          color: '#0e7490',
          bg: 'rgba(14,116,144,0.09)',
          help: 'Employees',
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

  return (
    <div className="dashboard-page" style={{ maxWidth: '1180px' }}>
      <section
        className="card"
        style={{
          marginBottom: '18px',
          padding: '24px',
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(239,248,249,0.94)), radial-gradient(circle at 100% 0%, rgba(36,200,248,0.14), transparent 34%)',
        }}
      >
        <div className="dashboard-header-row" style={{ marginBottom: 0, alignItems: 'center' }}>
          <div style={{ maxWidth: '680px' }}>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
              <Sparkles size={13} />
              {companyCopy.workspaceLabel}
            </div>
            <h1 className="page-heading" style={{ fontSize: 'clamp(1.9rem, 4vw, 2.7rem)' }}>
              <span suppressHydrationWarning>{greeting}</span>, <span className="gradient-text">{user?.name?.split(' ')[0] || 'there'}</span>
            </h1>
            <p className="page-sub" style={{ maxWidth: '620px', fontSize: '0.98rem' }}>
              {workspaceMessage}
            </p>
          </div>

          <div className="dashboard-header-actions">
            <Link href="/dashboard/admin/projects" className="btn-secondary">
              <FolderKanban size={16} />
              {companyCopy.projectPluralLabel}
            </Link>
            <Link href="/dashboard/admin/tasks" className="btn-primary">
              <Plus size={16} />
              New {companyCopy.taskLabel}
            </Link>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="dashboard-stat-grid">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="stat-card">
              <div style={{ width: '42px', height: '42px', background: 'var(--bg-elevated)', borderRadius: '10px', marginBottom: '16px' }} />
              <div style={{ width: '38%', height: '22px', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '10px' }} />
              <div style={{ width: '64%', height: '10px', background: 'var(--bg-elevated)', borderRadius: '999px' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="dashboard-stat-grid">
          {statCards.map((card, index) => {
            const Icon = card.icon
            return (
              <article key={card.label} className="stat-card animate-fade-in" style={{ animationDelay: `${index * 45}ms` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="icon-box" style={{ width: '42px', height: '42px', background: card.bg }}>
                    <Icon size={20} style={{ color: card.color }} />
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--text-muted)]">{card.help}</span>
                </div>
                <div style={{ marginTop: '18px', fontSize: '2rem', fontWeight: 850, color: card.color, lineHeight: 1 }}>
                  <AnimatedCounter value={card.value} />
                </div>
                <div style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 800 }}>{card.label}</div>
              </article>
            )
          })}
        </div>
      )}

      <div className="dashboard-two-col">
        <section className="card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">Team performance</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Employees ranked by completed work.</p>
            </div>
            <span className="rounded-full bg-[var(--bg-elevated)] px-3 py-1 text-[11px] font-bold text-[var(--text-muted)]">
              Completion rate
            </span>
          </div>

          {!stats?.performance?.length ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-10 text-center">
              <Users size={30} style={{ opacity: 0.34, margin: '0 auto 10px', color: 'var(--text-muted)' }} />
              <p className="text-sm font-semibold text-[var(--text-primary)]">No team members yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--text-muted)]">
                Invite employees to start seeing workload, progress, and completion trends here.
              </p>
              <Link href="/dashboard/admin/employees" className="btn-secondary mt-4">
                Manage team
                <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <div className="dashboard-card-stack">
              {stats.performance
                .sort((a, b) => b.score - a.score)
                .map((employee, index) => (
                  <div key={employee.name} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="icon-box h-8 w-8 text-xs font-bold text-white" style={{ background: 'var(--accent-gradient)' }}>
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-[var(--text-primary)]">{employee.name}</div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {employee.done}/{employee.total} completed
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-black" style={{ color: employee.score >= 80 ? '#059669' : employee.score >= 50 ? '#d97706' : '#dc2626' }}>
                        {employee.score}%
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${employee.score}%`,
                          background:
                            employee.score >= 80
                              ? 'linear-gradient(90deg, #059669, #34d399)'
                              : employee.score >= 50
                                ? 'linear-gradient(90deg, #d97706, #fbbf24)'
                                : 'linear-gradient(90deg, #dc2626, #f87171)',
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="mb-5">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              {isAgency ? 'Brief breakdown' : 'Task breakdown'}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">A quick read on what is finished, active, or late.</p>
          </div>

          <div className="mb-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-[var(--text-primary)]">Overall completion</span>
              <span className="text-2xl font-black text-[var(--accent)]">{completionRate}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${completionRate}%` }} />
            </div>
          </div>

          {stats && stats.totalTasks > 0 ? (
            <div className="grid gap-4">
              {[
                { label: 'Completed', value: stats.doneTasks, color: '#059669', icon: CheckCircle2 },
                { label: 'In progress', value: stats.inProgressTasks, color: '#d97706', icon: Zap },
                { label: 'Overdue', value: stats.overdueTasks, color: '#dc2626', icon: AlertTriangle },
              ].map((item) => {
                const Icon = item.icon
                const pct = stats.totalTasks ? Math.round((item.value / stats.totalTasks) * 100) : 0
                return (
                  <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)]">
                        <Icon size={15} style={{ color: item.color }} />
                        {item.label}
                      </span>
                      <span className="text-sm font-black" style={{ color: item.color }}>
                        {item.value} <span className="font-semibold text-[var(--text-muted)]">({pct}%)</span>
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
              <p className="mx-auto mt-1 max-w-xs text-sm text-[var(--text-muted)]">
                Create a {companyCopy.projectLabel.toLowerCase()} first, then divide it into clear {companyCopy.taskPluralLabel.toLowerCase()}.
              </p>
            </div>
          )}

          <div className="dashboard-action-grid" style={{ marginTop: '20px' }}>
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

      {isAgency && (
        <section className="card mt-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="icon-box h-11 w-11" style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>
                <BriefcaseBusiness size={20} />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">Agency setup</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                  Start by creating client categories, then add campaigns under each category and split every campaign into briefs.
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
