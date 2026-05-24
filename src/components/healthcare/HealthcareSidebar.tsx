'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  UserRound,
  Users,
  CalendarDays,
  Building2,
  Activity,
  HeartPulse,
  Wrench,
  ClipboardList,
  CheckSquare,
  Clock,
  ShieldCheck,
  Siren,
  BarChart3,
  CreditCard,
  Database,
  Search,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Settings,
  Plus,
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { useLocale } from '@/components/i18n/LocaleProvider'
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher'
import NotificationDropdown from '@/components/dashboard/NotificationDropdown'
import CommandPalette from '@/components/dashboard/CommandPalette'
import { HEALTHCARE_NAVIGATION } from '@/lib/healthcare-config'

type HealthcareSidebarProps = {
  children: React.ReactNode
  initialLocale: string
  brandName?: string
  brandLogo?: string
}

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  UserRound,
  Users,
  CalendarDays,
  Building2,
  Activity,
  HeartPulse,
  Wrench,
  ClipboardList,
  CheckSquare,
  Clock,
  ShieldCheck,
  Siren,
  BarChart3,
  CreditCard,
  Database,
}

type NavSection = {
  key: string
  label: string
  items: (typeof HEALTHCARE_NAVIGATION.mainNav)[number][]
}

function buildNavSections(): NavSection[] {
  const sectionOrder = ['operations', 'management', 'workforce', 'governance']
  const sections: NavSection[] = []

  for (const key of sectionOrder) {
    const label = HEALTHCARE_NAVIGATION.sections[key] || key
    const items = HEALTHCARE_NAVIGATION.mainNav.filter((item) => item.section === key)
    if (items.length > 0) {
      sections.push({ key, label, items })
    }
  }

  return sections
}

export default function HealthcareSidebar({ children }: HealthcareSidebarProps) {
  const { t, direction, locale } = useLocale()
  const { data: session } = useSession()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)

  const user = session?.user as { id?: string; name?: string; role?: string; companyType?: string | null }
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const isEmployee = user?.role === 'EMPLOYEE'
  const canManageWorkspace = user?.role === 'OWNER' || user?.role === 'MANAGER'
  const canOpenSettings = !isSuperAdmin

  const navSections = buildNavSections()

  const roleLabel = isSuperAdmin
    ? t('role.superAdmin')
    : user?.role === 'OWNER'
      ? t('role.owner')
      : user?.role === 'MANAGER'
        ? t('role.manager')
        : t('role.employee')
  const badgeClass = isSuperAdmin
    ? 'badge-owner'
    : user?.role === 'OWNER'
      ? 'badge-owner'
      : user?.role === 'MANAGER'
        ? 'badge-manager'
        : 'badge-employee'

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        setSidebarCollapsed((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div
      className={`hc-app-shell ${sidebarCollapsed ? 'hc-sidebar-collapsed' : ''}`}
      dir={direction}
    >
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        canManageWorkspace={canManageWorkspace}
        isEmployee={isEmployee}
        isSuperAdmin={isSuperAdmin}
        hasSocialStats={false}
      />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label={t('nav.closeMenu')}
          className="hc-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`hc-sidebar ${sidebarOpen ? 'hc-sidebar-open' : ''} ${sidebarCollapsed ? 'hc-sidebar-mini' : ''}`}>
        {/* Brand */}
        <div className="hc-sidebar-brand">
          <div className="hc-brand-row">
            <div className="hc-brand-icon">
              <HeartPulse size={22} />
            </div>
            <div className="hc-brand-copy">
              <div className="hc-brand-name">Healthcare</div>
              <div className="hc-brand-sub">Hospital Operations</div>
            </div>
          </div>
          <button
            type="button"
            className="hc-collapse-btn"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Search */}
        <div className="hc-sidebar-search">
          <button
            type="button"
            className="hc-search-trigger"
            onClick={() => setCommandOpen(true)}
            aria-label={t('nav.commandPalette')}
          >
            <Search size={16} />
            <span className="hc-search-label">Search patients, assets…</span>
            <kbd className="hc-kbd">⌘K</kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="hc-sidebar-nav">
          {navSections.map((section) => (
            <div key={section.key} className="hc-nav-section">
              <div className="hc-nav-section-label">{section.label}</div>
              {section.items.map((item) => {
                const isActive =
                  item.href === '/dashboard/admin'
                    ? pathname === '/dashboard/admin'
                    : pathname.startsWith(item.href)
                const Icon = ICON_MAP[item.icon] || LayoutDashboard
                const isEmergency = item.id === 'emergency-center'
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`hc-nav-item ${isActive ? 'hc-nav-active' : ''} ${isEmergency ? 'hc-nav-emergency' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                    title={item.description}
                  >
                    <Icon size={18} strokeWidth={2} />
                    <span className="hc-nav-label">{item.label}</span>
                    {isEmergency && (
                      <span className="hc-live-badge">
                        <span className="hc-live-dot" />
                        LIVE
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="hc-sidebar-footer">
          <div className="hc-user-card">
            <div className="hc-user-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="hc-user-info">
              <div className="hc-user-name">{user?.name || '...'}</div>
              <span className={`badge ${badgeClass} !px-2 !py-0 !text-[9px]`}>{roleLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="hc-signout-btn"
          >
            <LogOut size={14} />
            <span className="hc-nav-label">{t('action.signOut')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="hc-main">
        {/* Header */}
        <header className="hc-header">
          <div className="hc-header-left">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="hc-mobile-menu"
              aria-label={t('nav.openMenu')}
            >
              <Menu size={20} />
            </button>
            <div className="hc-header-title">
              <div className="hc-header-sup">Hospital Operations</div>
              <div className="hc-header-main">Clinical Command Center</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="hc-header-search"
            aria-label={t('nav.commandPalette')}
          >
            <Search size={16} />
            <span className="hc-header-search-text">{t('nav.searchPlaceholder')}</span>
            <kbd className="command-kbd">Cmd K</kbd>
          </button>

          <div className="hc-header-right">
            {!isSuperAdmin && !isEmployee && (
              <Link href="/dashboard/admin/requests" className="hc-new-btn">
                <Plus size={15} />
                New Request
              </Link>
            )}
            {!isSuperAdmin && <LanguageSwitcher compact />}
            {canOpenSettings && (
              <Link
                href="/dashboard/settings"
                className="hc-settings-btn"
                aria-label={t('nav.settings')}
              >
                <Settings size={15} />
                <span className="hc-hide-mobile">{t('nav.settings')}</span>
              </Link>
            )}
            {!isSuperAdmin && (
              <NotificationDropdown alertsHref="/dashboard/admin/emergency-center" />
            )}
            <div className="hc-status-pill">
              <span className="hc-status-dot hc-status-operational" />
              <Radio size={13} className="hc-status-icon" />
              <span>Systems Operational</span>
            </div>
            <div className="hc-date-pill" suppressHydrationWarning>
              {new Date().toLocaleDateString(
                locale === 'fr' ? 'fr-FR' : locale === 'ar' ? 'ar' : 'en-US',
                { weekday: 'short', month: 'short', day: 'numeric' }
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="hc-body" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}