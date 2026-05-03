'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { getCompanyTypeCopy, normalizeCompanyType } from '@/lib/company-types'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

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
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 800 }}>{card.label}</div>
                  <GrowthBadge value={card.growth} />
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <section className="card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">Activity over time</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Created and completed work across the last 7 days.</p>
            </div>
            <span className="rounded-full bg-[var(--bg-elevated)] px-3 py-1 text-[11px] font-bold text-[var(--text-muted)]">
              This week vs last week
            </span>
          </div>
          {!stats?.activitySeries?.some((item) => item.created || item.completed) ? (
            <EmptyChartState label="No activity trend yet" />
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.activitySeries} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(100,116,139,0.18)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      boxShadow: 'var(--shadow-card)',
                    }}
                  />
                  <Line type="monotone" dataKey="created" stroke="#0369a1" strokeWidth={3} dot={{ r: 3 }} name="Created" />
                  <Line type="monotone" dataKey="completed" stroke="#059669" strokeWidth={3} dot={{ r: 3 }} name="Completed" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card">
          <div className="mb-5">
            <h2 className="font-display text-lg font-semibold tracking-tight">Roles distribution</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Workspace access composition.</p>
          </div>
          {!stats?.rolesDistribution?.some((item) => item.value) ? (
            <EmptyChartState label="No role data yet" />
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.rolesDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
                  >
                    {stats.rolesDistribution.map((entry, index) => (
                      <Cell key={entry.name} fill={['#0369a1', '#7c3aed', '#d97706', '#059669'][index % 4]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      boxShadow: 'var(--shadow-card)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="card">
          <div className="mb-5">
            <h2 className="font-display text-lg font-semibold tracking-tight">Status mix</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">A stage-level breakdown of all work.</p>
          </div>
          {!stats?.taskStageBreakdown?.some((item) => item.value) ? (
            <EmptyChartState label="No task data yet" />
          ) : (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.taskStageBreakdown} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(100,116,139,0.18)" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      boxShadow: 'var(--shadow-card)',
                    }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} name="Tasks">
                    {stats.taskStageBreakdown.map((entry) => (
                      <Cell key={entry.stage} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">Activity timeline</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Recent task and project movement, newest first.</p>
            </div>
            <Link href="/dashboard/admin/tasks" className="btn-secondary btn-sm">
              View tasks
              <ArrowRight size={14} />
            </Link>
          </div>

          {!stats?.recentActivity?.length ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-10 text-center text-sm font-semibold text-[var(--text-muted)]">
              No activity logged yet
            </div>
          ) : (
            <div className="dashboard-card-stack">
              {stats.recentActivity.map((activity) => (
                <div key={activity.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-3">
                  <div className="flex items-start gap-3">
                    <div className="icon-box h-9 w-9 text-xs font-black text-white" style={{ background: 'var(--accent-gradient)' }}>
                      {activity.user.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-[var(--text-primary)]">{activity.user.name}</span>
                        <span className="text-xs font-semibold text-[var(--text-muted)]">{activity.action}</span>
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        {activity.task.project.title} / {activity.task.title}
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
