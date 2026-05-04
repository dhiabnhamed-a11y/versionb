'use client'

import { useState, useSyncExternalStore } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import AlertReceiver from '@/components/alerts/AlertReceiver'
import NotificationDropdown from '@/components/dashboard/NotificationDropdown'
import PushNotificationBootstrap from '@/components/pwa/PushNotificationBootstrap'
import { getCompanyTypeCopy, normalizeCompanyType } from '@/lib/company-types'
import { isRealtimeAlertsEnabled } from '@/lib/socket-client'
import logo from '@/app/logo.png'
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Bell,
  ListTodo,
  BarChart3,
  CalendarDays,
  LogOut,
  Radio,
  Menu,
  ShieldCheck,
  Search,
  Plus,
} from 'lucide-react'

export default function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const realtimeEnabled = useSyncExternalStore(
    () => () => undefined,
    () => isRealtimeAlertsEnabled(),
    () => false
  )

  const user = session?.user as { id?: string; name?: string; role?: string; companyType?: string | null }
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const isEmployee = user?.role === 'EMPLOYEE'
  const companyType = normalizeCompanyType(user?.companyType)
  const companyCopy = getCompanyTypeCopy(companyType)
  const links = isSuperAdmin
    ? [{ href: '/dashboard/super-admin', label: 'Company approvals', icon: ShieldCheck }]
    : isEmployee
    ? [
        {
          href: '/dashboard/employee',
          label: companyType === 'DIGITAL_AGENCY' ? 'My briefs' : 'My tasks',
          icon: ListTodo,
        },
        { href: '/dashboard/employee/alerts', label: 'Alerts', icon: Bell },
        { href: '/dashboard/employee/progress', label: 'Progress', icon: BarChart3 },
      ]
    : [
        { href: '/dashboard/admin', label: 'Overview', icon: LayoutDashboard },
        {
          href: '/dashboard/admin/projects',
          label:
            companyType === 'INDUSTRY'
              ? `${companyCopy.groupPluralLabel} & ${companyCopy.projectPluralLabel}`
              : companyCopy.projectPluralLabel,
          icon: FolderKanban,
        },
        { href: '/dashboard/admin/tasks', label: companyCopy.taskPluralLabel, icon: CheckSquare },
        { href: '/dashboard/admin/calendar', label: 'Calendar', icon: CalendarDays },
        { href: '/dashboard/admin/employees', label: 'Team', icon: Users },
        { href: '/dashboard/admin/alerts', label: 'Send Alert', icon: Bell },
      ]
  const workspaceNavLabel = isSuperAdmin
    ? 'Approval center'
    :
    companyType === 'INDUSTRY' ? 'Operations grid' : companyType === 'DIGITAL_AGENCY' ? 'Studio board' : 'Command center'

  const roleLabel = isSuperAdmin ? 'Super Admin' : user?.role === 'OWNER' ? 'Owner' : user?.role === 'MANAGER' ? 'Manager' : 'Employee'
  const badgeClass = isSuperAdmin ? 'badge-owner' : user?.role === 'OWNER' ? 'badge-owner' : user?.role === 'MANAGER' ? 'badge-manager' : 'badge-employee'
  const workspaceLabel = isSuperAdmin ? 'Super Admin Console' : companyCopy.workspaceLabel

  return (
    <div className="flex min-h-screen min-h-dvh">
      {!isSuperAdmin && <PushNotificationBootstrap userId={user?.id} />}

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="border-b px-4 py-4" style={{ borderColor: 'var(--sidebar-border)' }}>
            <div className="flex items-center gap-3">
              <div
                className="icon-box flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border transition-transform duration-200 hover:scale-105"
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <Image src={logo} alt="TASKIT logo" width={30} height={30} className="h-7 w-7 object-contain" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold text-[var(--text-primary)]">TASKIT</div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                  {workspaceLabel}
                </div>
              </div>
            </div>
          </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-light)' }}>
            {isEmployee ? 'Your workspace' : workspaceNavLabel}
          </div>
          {links.map((link) => {
            const isActive = pathname === link.href
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                <span>{link.label}</span>
                {link.label === 'Send Alert' && (
                  <span
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide"
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#fca5a5',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    LIVE
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="border-t px-3 py-4" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div className="mb-3 flex items-center gap-3 rounded-xl px-2 py-2.5" style={{ background: 'var(--sidebar-surface)', border: '1px solid var(--sidebar-border)' }}>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-xs font-bold text-white"
              style={{ 
                background: 'var(--accent)',
              }}
            >
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {user?.name || '...'}
              </div>
              <span className={`badge ${badgeClass} mt-1 !px-2 !py-0 !text-[9px]`}>{roleLabel}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="btn-secondary w-full transition-all duration-200"
            style={{ fontSize: '12px', padding: '8px 12px' }}
          >
            <span className="flex items-center justify-center gap-2">
              <LogOut size={14} /> Sign out
            </span>
          </button>
        </div>
      </aside>

      <div className="main-content flex min-h-screen min-h-dvh flex-1 flex-col">
        <header className="dashboard-shell-header dash-header sticky top-0 z-30 flex items-center justify-between px-5 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="mobile-menu-btn -ml-1 flex items-center justify-center rounded-lg p-2"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
              <Menu size={20} className="text-[var(--text-primary)]" />
            </button>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {workspaceLabel}
              </div>
              <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                {isEmployee ? 'My workspace' : workspaceNavLabel}
              </div>
            </div>
          </div>

          <label className="mx-4 hidden h-11 min-w-0 flex-1 max-w-xl items-center gap-3 rounded-2xl bg-white/80 px-4 text-[14px] text-[var(--text-muted)] shadow-sm ring-1 ring-[var(--border)] backdrop-blur transition focus-within:ring-2 focus-within:ring-[var(--accent)] lg:flex">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search briefs, deliverables, comments..."
              className="min-w-0 flex-1 border-0 bg-transparent text-[14px] font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </label>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {!isSuperAdmin && !isEmployee && (
              <Link href="/dashboard/admin/tasks" className="hidden h-10 items-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)] active:scale-[.98] sm:inline-flex">
                <Plus size={15} />
                New brief
              </Link>
            )}
            {!isSuperAdmin && (
              <NotificationDropdown alertsHref={isEmployee ? '/dashboard/employee/alerts' : '/dashboard/admin/alerts'} />
            )}
            <div
              className="hidden items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:flex"
              style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.76)', color: 'var(--text-muted)' }}
            >
              <span
                className="flex h-2 w-2 rounded-full"
                style={{
                  background: 'var(--accent)',
                  boxShadow: 'none',
                }}
              />
              <Radio size={13} style={{ color: 'var(--accent)' }} />
              <span>{isSuperAdmin ? 'Approval system active' : 'Workspace ready'}</span>
            </div>
            <div
              suppressHydrationWarning
              className="rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums"
              style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.76)', color: 'var(--text-muted)' }}
            >
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </header>

        <main id="main-content" className="dashboard-shell-body flex-1 px-5 py-8 md:px-9 md:py-11 xl:px-10" tabIndex={-1}>
          {children}
        </main>
      </div>

      {user?.id && realtimeEnabled && !isSuperAdmin && <AlertReceiver userId={user.id} />}
    </div>
  )
}
