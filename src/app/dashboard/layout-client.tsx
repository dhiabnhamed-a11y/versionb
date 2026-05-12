'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import AlertReceiver from '@/components/alerts/AlertReceiver'
import AiOperationsAssistant from '@/components/dashboard/AiOperationsAssistant'
import CommandPalette from '@/components/dashboard/CommandPalette'
import NotificationDropdown from '@/components/dashboard/NotificationDropdown'
import WorkspaceThemeProvider from '@/components/dashboard/WorkspaceThemeProvider'
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher'
import { LocaleProvider, useLocale } from '@/components/i18n/LocaleProvider'
import PushNotificationBootstrap from '@/components/pwa/PushNotificationBootstrap'
import { getCompanyTypeCopy, normalizeCompanyType } from '@/lib/company-types'
import { normalizeDashboardDesignConfig } from '@/lib/dashboard-design'
import { isRealtimeAlertsEnabled } from '@/lib/socket-client'
import type { UserDashboardDesignSettings, WorkspaceThemeSettings } from '@/lib/settings'
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
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Search,
  Plus,
  Settings,
  ReceiptText,
  Building2,
} from 'lucide-react'

type DashboardLayoutClientProps = {
  children: React.ReactNode
  initialThemeSettings: WorkspaceThemeSettings
  initialUserDesign: UserDashboardDesignSettings
  initialLocale: string
}

export default function DashboardLayoutClient(props: DashboardLayoutClientProps) {
  return (
    <LocaleProvider initialLocale={props.initialLocale}>
      <DashboardLayoutChrome {...props} />
    </LocaleProvider>
  )
}

function DashboardLayoutChrome({
  children,
  initialThemeSettings,
  initialUserDesign,
}: DashboardLayoutClientProps) {
  const { t, direction } = useLocale()
  const { data: session } = useSession()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [userDesign, setUserDesign] = useState(initialUserDesign)
  const realtimeEnabled = useSyncExternalStore(
    () => () => undefined,
    () => isRealtimeAlertsEnabled(),
    () => false
  )

  const user = session?.user as { id?: string; name?: string; role?: string; companyType?: string | null }
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const isEmployee = user?.role === 'EMPLOYEE'
  const canManageWorkspace = user?.role === 'OWNER' || user?.role === 'MANAGER'
  const canOpenSettings = !isSuperAdmin
  const companyType = normalizeCompanyType(user?.companyType)
  const companyCopy = getCompanyTypeCopy(companyType)
  useEffect(() => {
    function handleUserDesign(event: Event) {
      const nextDesign = (event as CustomEvent<UserDashboardDesignSettings>).detail
      if (nextDesign) setUserDesign(nextDesign)
    }

    window.addEventListener('taskit:user-dashboard-design', handleUserDesign)
    return () => window.removeEventListener('taskit:user-dashboard-design', handleUserDesign)
  }, [])

  const dashboardDesignConfig = normalizeDashboardDesignConfig(userDesign.designJson)
  const brandName = dashboardDesignConfig.brand.name || 'TASKIT'
  const brandLogo = dashboardDesignConfig.brand.logoDataUrl || logo
  const hasCustomLogo = Boolean(dashboardDesignConfig.brand.logoDataUrl)
  const links = isSuperAdmin
    ? [{ href: '/dashboard/super-admin', label: t('nav.companyApprovals'), icon: ShieldCheck }]
    : isEmployee
    ? [
        {
          href: '/dashboard/employee',
          label: companyType === 'DIGITAL_AGENCY' ? t('nav.myBriefs') : t('nav.myTasks'),
          icon: ListTodo,
        },
        { href: '/dashboard/employee/alerts', label: t('nav.alerts'), icon: Bell },
        { href: '/dashboard/employee/progress', label: t('nav.progress'), icon: BarChart3 },
      ]
    : [
        { href: '/dashboard/admin', label: t('nav.overview'), icon: LayoutDashboard },
        { href: '/dashboard/admin/clients', label: t('nav.clients'), icon: Building2 },
        {
          href: '/dashboard/admin/projects',
          label:
            companyType === 'INDUSTRY'
              ? `${companyCopy.groupPluralLabel} & ${companyCopy.projectPluralLabel}`
              : companyType === 'DIGITAL_AGENCY'
                ? t('nav.campaigns')
                : t('nav.projects'),
          icon: FolderKanban,
        },
        { href: '/dashboard/admin/tasks', label: companyType === 'DIGITAL_AGENCY' ? t('nav.briefs') : t('nav.tasks'), icon: CheckSquare },
        { href: '/dashboard/admin/invoices', label: t('nav.invoices'), icon: ReceiptText },
        { href: '/dashboard/admin/calendar', label: t('nav.calendar'), icon: CalendarDays },
        { href: '/dashboard/admin/employees', label: t('nav.team'), icon: Users },
        { href: '/dashboard/admin/alerts', label: t('nav.sendAlert'), icon: Bell },
      ]
  const workspaceNavLabel = isSuperAdmin
    ? t('nav.approvalCenter')
    :
    companyType === 'INDUSTRY' ? t('nav.operationsGrid') : companyType === 'DIGITAL_AGENCY' ? t('nav.studioBoard') : t('nav.commandCenter')

  const roleLabel = isSuperAdmin ? t('role.superAdmin') : user?.role === 'OWNER' ? t('role.owner') : user?.role === 'MANAGER' ? t('role.manager') : t('role.employee')
  const badgeClass = isSuperAdmin ? 'badge-owner' : user?.role === 'OWNER' ? 'badge-owner' : user?.role === 'MANAGER' ? 'badge-manager' : 'badge-employee'
  const workspaceLabel = isSuperAdmin ? t('nav.superAdminConsole') : companyCopy.workspaceLabel
  return (
    <div
      className={`dashboard-app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      data-user-design={userDesign.enabled && userDesign.compiledCss ? 'active' : undefined}
      dir={direction}
    >
      {userDesign.enabled && userDesign.compiledCss && (
        <style id="taskit-user-dashboard-design" dangerouslySetInnerHTML={{ __html: userDesign.compiledCss }} />
      )}
      <WorkspaceThemeProvider settings={initialThemeSettings} userDesign={userDesign} />
      {!isSuperAdmin && <PushNotificationBootstrap userId={user?.id} />}
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        canManageWorkspace={canManageWorkspace}
        isEmployee={isEmployee}
        isSuperAdmin={isSuperAdmin}
      />

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

        <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-brand-wrap">
            <div className="flex items-center gap-3">
              <div
                className="sidebar-brand-mark icon-box flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border transition-transform duration-200 hover:scale-105"
                style={{ borderRadius: dashboardDesignConfig.brand.logoRadius }}
              >
                <Image
                  src={brandLogo}
                  alt={`${brandName} logo`}
                  width={dashboardDesignConfig.brand.logoSize}
                  height={dashboardDesignConfig.brand.logoSize}
                  unoptimized={hasCustomLogo}
                  className="object-contain"
                  style={{
                    width: dashboardDesignConfig.brand.logoSize,
                    height: dashboardDesignConfig.brand.logoSize,
                  }}
                />
              </div>
              <div className="sidebar-brand-copy min-w-0">
                <div className="truncate text-base font-bold text-[var(--text-primary)]">{brandName}</div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                  {workspaceLabel}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={() => setSidebarCollapsed((current) => !current)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="sidebar-command-trigger"
            aria-label="Open command palette"
            title="Command palette"
          >
            <Search size={15} />
            <span className="sidebar-link-label">{t('nav.commandSearch')}</span>
            <kbd className="sidebar-kbd">K</kbd>
          </button>
          <div className="sidebar-section-label mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-light)' }}>
            {isEmployee ? t('nav.yourWorkspace') : workspaceNavLabel}
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
                <span className="sidebar-link-label">{link.label}</span>
                {link.label === 'Send Alert' && (
                  <span
                    className="sidebar-live-badge ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide"
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

        <div className="sidebar-footer px-3 py-4">
          <div className="sidebar-user-card mb-3 flex items-center gap-3 rounded-xl px-2 py-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-xs font-bold text-white"
              style={{ 
                background: 'var(--accent)',
              }}
            >
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="sidebar-user-copy min-w-0 flex-1">
              <div className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {user?.name || '...'}
              </div>
              <span className={`badge ${badgeClass} mt-1 !px-2 !py-0 !text-[9px]`}>{roleLabel}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="sidebar-signout btn-secondary w-full transition-all duration-200"
            style={{ fontSize: '12px', padding: '8px 12px' }}
          >
            <span className="flex items-center justify-center gap-2">
              <LogOut size={14} /> <span className="sidebar-link-label">{t('action.signOut')}</span>
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
                {isEmployee ? t('nav.myWorkspace') : workspaceNavLabel}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="command-trigger mx-4 hidden h-11 min-w-0 flex-1 max-w-xl items-center gap-3 rounded-2xl px-4 text-left text-[14px] text-[var(--text-muted)] shadow-sm ring-1 ring-[var(--border)] backdrop-blur transition lg:flex"
            aria-label="Open command palette"
          >
            <Search size={16} />
            <span className="min-w-0 flex-1 truncate font-medium">{t('nav.searchPlaceholder')}</span>
            <kbd className="command-kbd">Cmd K</kbd>
          </button>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {!isSuperAdmin && !isEmployee && (
              <Link href="/dashboard/admin/tasks" className="hidden h-10 items-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)] active:scale-[.98] sm:inline-flex">
                <Plus size={15} />
                {t('action.newBrief')}
              </Link>
            )}
            {!isSuperAdmin && <LanguageSwitcher compact />}
            {canOpenSettings && (
              <Link
                href="/dashboard/settings"
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-3 text-[13px] font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-[.98] md:px-3.5"
                aria-label="Settings"
              >
                <Settings size={15} />
                <span className="hidden md:inline">{t('nav.settings')}</span>
              </Link>
            )}
            {!isSuperAdmin && (
              <NotificationDropdown alertsHref={isEmployee ? '/dashboard/employee/alerts' : '/dashboard/admin/alerts'} />
            )}
            <div
              className="hidden items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:flex"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)' }}
            >
              <span
                className="flex h-2 w-2 rounded-full"
                style={{
                  background: 'var(--accent)',
                  boxShadow: 'none',
                }}
              />
              <Radio size={13} style={{ color: 'var(--accent)' }} />
              <span>{isSuperAdmin ? t('nav.approvalSystemActive') : t('nav.workspaceReady')}</span>
            </div>
            <div
              suppressHydrationWarning
              className="rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)' }}
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
      <AiOperationsAssistant disabled={isSuperAdmin} />
    </div>
  )
}
