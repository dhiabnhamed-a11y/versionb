'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Languages,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react'

import LanguageSwitcher from '@/components/i18n/LanguageSwitcher'
import { useLocale } from '@/components/i18n/LocaleProvider'
import PremiumDashboardDesignStudio from '@/components/dashboard/PremiumDashboardDesignStudio'
import { downloadBlobResponse, getResponseErrorMessage } from '@/lib/download-response'
import type { PublicWorkspaceRole, UserDashboardDesignSettings, WorkspaceThemeSettings } from '@/lib/settings'
import { applyWorkspaceTheme } from '@/lib/theme-client'

type TeamUser = {
  id: string
  name: string
  email: string
  role: PublicWorkspaceRole
  storedRole: string
  roleLabel: string
  isCurrentUser: boolean
  joinedAt: string
  updatedAt: string
}

type CurrentUser = {
  id: string
  role: 'OWNER' | 'MANAGER'
}

type TabId = 'design' | 'language' | 'appearance' | 'team' | 'export'

const TABS: { id: TabId; label: string; icon: typeof Palette }[] = [
  { id: 'design', label: 'My Design', icon: SlidersHorizontal },
  { id: 'language', label: 'Language', icon: Languages },
  { id: 'appearance', label: 'Workspace Appearance', icon: Palette },
  { id: 'team', label: 'Team Management', icon: Users },
  { id: 'export', label: 'Data & Export', icon: Database },
]

const ROLE_OPTIONS: { value: PublicWorkspaceRole; label: string }[] = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'WORKER', label: 'Worker' },
]

function getRoleBadgeClass(role: PublicWorkspaceRole) {
  if (role === 'OWNER') return 'badge-owner'
  if (role === 'MANAGER') return 'badge-manager'
  return 'badge-employee'
}

function getErrorMessage(value: unknown, fallback: string) {
  if (value && typeof value === 'object' && 'error' in value && typeof value.error === 'string') {
    return value.error
  }

  return fallback
}

function canChangeRole(currentUser: CurrentUser, target: TeamUser, nextRole: PublicWorkspaceRole) {
  if (target.isCurrentUser) return false
  if (target.role === nextRole) return false

  if (currentUser.role === 'OWNER') {
    return true
  }

  return (target.role === 'WORKER' && nextRole === 'MANAGER') || (target.role === 'MANAGER' && nextRole === 'WORKER')
}

const RETRYABLE_EXPORT_STATUSES = new Set([408, 429, 500, 502, 503, 504])

function getStatsExportAcceptHeader(format: 'json' | 'csv' | 'pdf') {
  if (format === 'pdf') return 'application/pdf'
  if (format === 'csv') return 'text/csv'
  return 'application/json'
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function fetchStatsExportWithRetry(format: 'json' | 'csv' | 'pdf') {
  const maxAttempts = 2
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 60000)

    try {
      const response = await fetch(`/api/export/stats?format=${format}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
        headers: {
          Accept: getStatsExportAcceptHeader(format),
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      })

      if (attempt < maxAttempts && RETRYABLE_EXPORT_STATUSES.has(response.status)) {
        await wait(450 * attempt)
        continue
      }

      return response
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts) break
      await wait(450 * attempt)
    } finally {
      window.clearTimeout(timeout)
    }
  }

  if (lastError instanceof DOMException && lastError.name === 'AbortError') {
    throw new Error('Statistics export timed out. Please try again.')
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to export statistics.')
}

export default function SettingsClient({
  initialAppearance,
  initialDesign,
  initialUsers,
  currentUser,
  canManageWorkspace,
}: {
  initialAppearance: WorkspaceThemeSettings
  initialDesign: UserDashboardDesignSettings
  initialUsers: TeamUser[]
  currentUser: CurrentUser | null
  canManageWorkspace: boolean
}) {
  const { t } = useLocale()
  const [activeTab, setActiveTab] = useState<TabId>('design')
  const [appearance, setAppearance] = useState(initialAppearance)
  const [design, setDesign] = useState(initialDesign)
  const [users, setUsers] = useState(initialUsers)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [savingAppearance, setSavingAppearance] = useState(false)
  const [changingUserId, setChangingUserId] = useState<string | null>(null)
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'pdf'>('pdf')
  const [exporting, setExporting] = useState(false)

  const availableTabs = useMemo(
    () => (canManageWorkspace ? TABS : TABS.filter((tab) => tab.id === 'design' || tab.id === 'language')),
    [canManageWorkspace]
  )

  function tabLabel(tab: { id: TabId; label: string }) {
    if (tab.id === 'language') return t('language.label')
    return tab.label
  }

  const counts = useMemo(
    () => ({
      owners: users.filter((user) => user.role === 'OWNER').length,
      managers: users.filter((user) => user.role === 'MANAGER').length,
      workers: users.filter((user) => user.role === 'WORKER').length,
    }),
    [users]
  )

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    window.setTimeout(() => {
      setFeedback((current) => (current?.message === message ? null : current))
    }, 4500)
  }

  async function saveAppearance() {
    setSavingAppearance(true)
    setFeedback(null)

    const response = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appearance),
    })

    const data = (await response.json().catch(() => ({}))) as { appearance?: WorkspaceThemeSettings; error?: string }
    setSavingAppearance(false)

    if (!response.ok || !data.appearance) {
      showFeedback('error', getErrorMessage(data, 'Failed to update appearance.'))
      return
    }

    setAppearance(data.appearance)
    applyWorkspaceTheme(data.appearance)
    showFeedback('success', 'Appearance settings saved.')
  }

  async function changeRole(target: TeamUser, nextRole: PublicWorkspaceRole) {
    if (!currentUser) return
    if (!canChangeRole(currentUser, target, nextRole)) {
      showFeedback('error', target.isCurrentUser ? 'No one can change their own role.' : 'That role change is not allowed.')
      return
    }

    const confirmed = window.confirm(`Change ${target.name}'s role from ${target.roleLabel} to ${nextRole === 'WORKER' ? 'Worker' : nextRole}?`)
    if (!confirmed) return

    setChangingUserId(target.id)
    setFeedback(null)

    const response = await fetch(`/api/users/${target.id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: nextRole }),
    })
    const data = (await response.json().catch(() => ({}))) as { user?: TeamUser; error?: string }
    setChangingUserId(null)

    if (!response.ok || !data.user) {
      showFeedback('error', getErrorMessage(data, 'Failed to update role.'))
      return
    }

    setUsers((current) =>
      current.map((user) =>
        user.id === target.id
          ? {
              ...user,
              role: data.user!.role,
              storedRole: data.user!.storedRole,
              roleLabel: data.user!.role === 'WORKER' ? 'Worker' : data.user!.role.charAt(0) + data.user!.role.slice(1).toLowerCase(),
            }
          : user
      )
    )
    showFeedback('success', `${target.name}'s role was updated.`)
  }

  async function exportStats() {
    const confirmed = window.confirm(`Download full workspace statistics as ${exportFormat.toUpperCase()}?`)
    if (!confirmed) return

    setExporting(true)
    setFeedback(null)

    try {
      const response = await fetchStatsExportWithRetry(exportFormat)
      const contentType = response.headers.get('content-type') ?? ''

      if (!response.ok) {
        showFeedback('error', await getResponseErrorMessage(response, 'Failed to export statistics.'))
        return
      }

      if (exportFormat === 'pdf' && !contentType.includes('application/pdf')) {
        showFeedback('error', await getResponseErrorMessage(response, 'Statistics PDF could not be downloaded.'))
        return
      }

      await downloadBlobResponse(response, 'taskit-stats', exportFormat)
      showFeedback('success', 'Statistics export started.')
    } catch (error) {
      showFeedback('error', error instanceof Error ? error.message : 'Failed to export statistics.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="dashboard-page" style={{ maxWidth: '1080px' }}>
      <div className="dashboard-header-row">
        <div>
          <h1 className="page-heading flex items-center gap-2.5">
            <ShieldCheck size={24} strokeWidth={1.85} style={{ color: 'var(--accent)' }} />
            {t('settings.title')}
          </h1>
          <p className="page-sub">{canManageWorkspace ? t('settings.subtitleAdmin') : t('settings.subtitleUser')}</p>
        </div>
      </div>

      {feedback && (
        <div
          className="mb-4 flex items-start gap-2 rounded-[var(--radius-sm)] border px-4 py-3 text-sm font-semibold"
          style={{
            borderColor: feedback.type === 'success' ? 'rgba(5,150,105,0.22)' : 'rgba(220,38,38,0.22)',
            background: feedback.type === 'success' ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
            color: feedback.type === 'success' ? '#047857' : '#dc2626',
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
          {feedback.message}
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] p-2 shadow-sm">
        {availableTabs.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-sm)] px-3.5 text-sm font-bold transition"
              style={{
                background: active ? 'var(--accent-subtle)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                border: active ? '1px solid var(--accent-ring)' : '1px solid transparent',
              }}
            >
              <Icon size={16} />
              {tabLabel(tab)}
            </button>
          )
        })}
      </div>

      {activeTab === 'language' && (
        <section className="card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">{t('settings.languageTitle')}</h2>
              <p className="panel-meta">{t('settings.languageDescription')}</p>
            </div>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
            <LanguageSwitcher />
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[var(--text-muted)]">
              {t('language.workflowHint')}
            </p>
          </div>
        </section>
      )}

      {activeTab === 'design' && (
        <PremiumDashboardDesignStudio initialDesign={design} onSaved={setDesign} />
      )}

      {activeTab === 'appearance' && canManageWorkspace && (
        <section className="card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Appearance</h2>
              <p className="panel-meta">Theme choices are stored for the workspace and loaded with the dashboard.</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { key: 'primaryColor', label: 'Primary color' },
                { key: 'backgroundColor', label: 'Background color' },
                { key: 'sidebarColor', label: 'Sidebar color' },
              ].map((field) => {
                const key = field.key as 'primaryColor' | 'backgroundColor' | 'sidebarColor'
                return (
                  <label key={field.key} className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">{field.label}</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={appearance[key]}
                        onChange={(event) => setAppearance((current) => ({ ...current, [key]: event.target.value }))}
                        className="h-11 w-14 shrink-0 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--border)] bg-transparent p-1"
                      />
                      <input
                        className="input font-mono text-sm"
                        value={appearance[key]}
                        onChange={(event) => setAppearance((current) => ({ ...current, [key]: event.target.value }))}
                        maxLength={7}
                        spellCheck={false}
                      />
                    </div>
                  </label>
                )
              })}

              <div>
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Mode</span>
                <div className="grid grid-cols-2 gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
                  {(['light', 'dark'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAppearance((current) => ({ ...current, themeMode: mode }))}
                      className="min-h-10 rounded-[var(--radius-sm)] px-3 text-sm font-bold capitalize transition"
                      style={{
                        background: appearance.themeMode === mode ? 'var(--bg-card)' : 'transparent',
                        color: appearance.themeMode === mode ? 'var(--accent)' : 'var(--text-muted)',
                        boxShadow: appearance.themeMode === mode ? 'var(--shadow-sm)' : 'none',
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="rounded-[var(--radius-md)] border border-[var(--border)] p-4"
              style={{ background: appearance.backgroundColor }}
            >
              <div className="mb-4 h-9 rounded-[var(--radius-sm)]" style={{ background: appearance.sidebarColor }} />
              <div className="grid gap-3">
                <div className="h-3 w-2/3 rounded-full" style={{ background: appearance.primaryColor }} />
                <div className="h-16 rounded-[var(--radius-sm)] border border-black/10 bg-white/85" />
                <div className="h-16 rounded-[var(--radius-sm)] border border-black/10 bg-white/70" />
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button type="button" className="btn-primary" onClick={saveAppearance} disabled={savingAppearance}>
              {savingAppearance ? 'Saving...' : 'Save appearance'}
            </button>
          </div>
        </section>
      )}

      {activeTab === 'team' && canManageWorkspace && currentUser && (
        <section className="grid gap-4">
          <div className="dashboard-stat-grid !mb-0">
            <div className="stat-card">
              <span className="stat-card-label">Owners</span>
              <div className="stat-card-value">{counts.owners}</div>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Managers</span>
              <div className="stat-card-value">{counts.managers}</div>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Workers</span>
              <div className="stat-card-value">{counts.workers}</div>
            </div>
          </div>

          <div className="card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Team Management</h2>
                <p className="panel-meta">Role changes are confirmed, checked on the server, and written to the admin action log.</p>
              </div>
            </div>

            <div className="desktop-table">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Current role</th>
                      <th>Change role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="font-semibold text-[var(--text-primary)]">{user.name}</div>
                          <div className="text-xs text-[var(--text-muted)]">{user.email}</div>
                        </td>
                        <td>
                          <span className={`badge ${getRoleBadgeClass(user.role)}`}>
                            {user.roleLabel}
                            {user.isCurrentUser ? ' (you)' : ''}
                          </span>
                        </td>
                        <td>
                          <select
                            className="input max-w-[180px]"
                            value={user.role}
                            disabled={user.isCurrentUser || changingUserId === user.id || (currentUser.role === 'MANAGER' && user.role === 'OWNER')}
                            onChange={(event) => changeRole(user, event.target.value as PublicWorkspaceRole)}
                          >
                            {ROLE_OPTIONS.filter((option) => currentUser.role === 'OWNER' || option.value !== 'OWNER').map((option) => (
                              <option key={option.value} value={option.value} disabled={!canChangeRole(currentUser, user, option.value) && option.value !== user.role}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mobile-table-list">
              {users.map((user) => (
                <article key={user.id} className="mobile-table-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{user.name}</div>
                      <div className="truncate text-xs text-[var(--text-muted)]">{user.email}</div>
                    </div>
                    <span className={`badge ${getRoleBadgeClass(user.role)}`}>
                      {user.roleLabel}
                      {user.isCurrentUser ? ' (you)' : ''}
                    </span>
                  </div>
                  <select
                    className="input mt-3"
                    value={user.role}
                    disabled={user.isCurrentUser || changingUserId === user.id || (currentUser.role === 'MANAGER' && user.role === 'OWNER')}
                    onChange={(event) => changeRole(user, event.target.value as PublicWorkspaceRole)}
                  >
                    {ROLE_OPTIONS.filter((option) => currentUser.role === 'OWNER' || option.value !== 'OWNER').map((option) => (
                      <option key={option.value} value={option.value} disabled={!canChangeRole(currentUser, user, option.value) && option.value !== user.role}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'export' && canManageWorkspace && (
        <section className="card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Data & Export</h2>
              <p className="panel-meta">Exports include projects, tasks, completion rates, team performance, and activity logs.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
              <div className="text-sm font-bold text-[var(--text-primary)]">Full dashboard statistics</div>
              <div className="mt-2 grid gap-2 text-sm text-[var(--text-muted)] sm:grid-cols-2">
                <span>Projects and task totals</span>
                <span>Completion rates</span>
                <span>Team performance</span>
                <span>Task and admin activity logs</span>
                <span>PDF charts, project counts, and money totals</span>
              </div>
            </div>

            <div className="grid gap-3">
              <label>
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Format</span>
                <select className="input" value={exportFormat} onChange={(event) => setExportFormat(event.target.value as 'json' | 'csv' | 'pdf')}>
                  <option value="pdf">PDF report</option>
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </label>
              <button type="button" className="btn-primary" onClick={exportStats} disabled={exporting}>
                <Download size={16} />
                {exporting ? 'Preparing...' : 'Download'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}


