'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Building2,
  UserCog,
  HeartPulse,
  Package,
  Wrench,
  FileText,
  Shield,
  ShoppingCart,
  ShieldCheck,
  Siren,
  BarChart3,
  Bot,
  Search,
  Bell,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Settings,
  Plus,
} from 'lucide-react'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { useLocale } from '@/components/i18n/LocaleProvider'
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher'
import NotificationDropdown from '@/components/dashboard/NotificationDropdown'
import logo from '@/app/logo.png'
import { HEALTHCARE_NAVIGATION } from '@/lib/healthcare-config'

type HealthcareSidebarProps = {
  children: React.ReactNode
  initialLocale: string
  brandName?: string
  brandLogo?: string
}

const ICON_MAP = {
  LayoutDashboard,
  Users,
  CalendarDays,
  Building2,
  UserCog,
  HeartPulse,
  Package,
  Wrench,
  FileText,
  Shield,
  ShoppingCart,
  ShieldCheck,
  Siren,
  BarChart3,
  Bot,
}

export default function HealthcareSidebar({ children, initialLocale }: HealthcareSidebarProps) {
  const { t, direction, locale } = useLocale()
  const { data: session } = useSession()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const user = session?.user as { id?: string; name?: string; role?: string; companyType?: string | null }
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const isEmployee = user?.role === 'EMPLOYEE'
  const canManageWorkspace = user?.role === 'OWNER' || user?.role === 'MANAGER'

  // Healthcare-specific navigation
  const healthcareNavItems = HEALTHCARE_NAVIGATION.mainNav.map((item) => ({
    href: item.href,
    label: item.label,
    icon: ICON_MAP[item.icon as keyof typeof ICON_MAP] || LayoutDashboard,
    description: item.description,
    badge: item.id === 'emergency-center' ? { type: 'live', color: '#dc2626' } : undefined,
  }))

  const roleLabel = isSuperAdmin ? t('role.superAdmin') : user?.role === 'OWNER' ? t('role.owner') : user?.role === 'MANAGER' ? t('role.manager') : t('role.employee')
  const badgeClass = isSuperAdmin ? 'badge-owner' : user?.role === 'OWNER' ? 'badge-owner' : user?.role === 'MANAGER' ? 'badge-manager' : 'badge-employee'

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
      className={`healthcare-dashboard-app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      dir={direction}
    >
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label={t('nav.closeMenu')}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`healthcare-sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Brand */}
        <div className="healthcare-sidebar-brand">
          <div className="flex items-center gap-3">
            <div className="healthcare-brand-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[var(--accent)] bg-[var(--accent)]/10 transition-transform duration-200 hover:scale-105">
              <HeartPulse size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-bold text-[var(--text-primary)]">
                TASKIT Healthcare
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Hospital Operations
              </div>
            </div>
          </div>
          <button
            type="button"
            className="h-8 w-8 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Search */}
        <div className="healthcare-sidebar-search">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Search size={16} />
            <span className="flex-1 text-left">Search patients, assets, orders...</span>
            <kbd className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="healthcare-sidebar-nav">
          <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-light)]">
            Clinical Operations
          </div>
          {healthcareNavItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`healthcare-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
                title={item.description}
              >
                <Icon size={20} strokeWidth={2} />
                <span className="healthcare-nav-label">{item.label}</span>
                {item.badge && (
                  <span
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide"
                    style={{
                      background: `${item.badge.color}15`,
                      color: item.badge.color,
                      border: `1px solid ${item.badge.color}30`,
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: item.badge.color }} />
                    LIVE
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="healthcare-sidebar-footer">
          <div className="healthcare-user-card">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-xs font-bold text-white"
              style={{ background: 'var(--accent)' }}
            >
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                {user?.name || '...'}
              </div>
              <span className={`badge ${badgeClass} mt-1 !px-2 !py-0 !text-[9px]`}>{roleLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="healthcare-signout-btn"
          >
            <LogOut size={14} />
            <span>{t('action.signOut')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="healthcare-main-content">
        {/* Header */}
        <header className="healthcare-header">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="mobile-menu-btn -ml-1 flex items-center justify-center rounded-lg p-2"
              aria-label={t('nav.openMenu')}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
              <Menu size={20} className="text-[var(--text-primary)]" />
            </button>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Hospital Operations
              </div>
              <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                Clinical Command Center
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {!isSuperAdmin && !isEmployee && (
              <Link
                href="/dashboard/admin/patients"
                className="hidden h-10 items-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)] active:scale-[.98] sm:inline-flex"
              >
                <Plus size={15} />
                New Patient
              </Link>
            )}
            {!isSuperAdmin && <LanguageSwitcher compact />}
            {canManageWorkspace && (
              <Link
                href="/dashboard/settings"
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-3 text-[13px] font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-[.98] md:px-3.5"
                aria-label={t('nav.settings')}
              >
                <Settings size={15} />
                <span className="hidden md:inline">{t('nav.settings')}</span>
              </Link>
            )}
            {!isSuperAdmin && (
              <NotificationDropdown alertsHref="/dashboard/admin/emergency-center" />
            )}
            <div
              className="hidden items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:flex"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)' }}
            >
              <span
                className="flex h-2 w-2 rounded-full"
                style={{
                  background: '#22c55e',
                  boxShadow: '0 0 8px rgba(34, 197, 94, 0.3)',
                }}
              />
              <Radio size={13} style={{ color: '#22c55e' }} />
              <span>Systems Operational</span>
            </div>
            <div
              suppressHydrationWarning
              className="rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)' }}
            >
              {new Date().toLocaleDateString(locale === 'fr' ? 'fr-FR' : locale === 'ar' ? 'ar' : 'en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="healthcare-main-body">
          {children}
        </main>
      </div>
    </div>
  )
}