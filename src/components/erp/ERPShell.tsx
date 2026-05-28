'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher'
import { useLocale } from '@/components/i18n/LocaleProvider'
import {
  LayoutDashboard,
  BarChart3,
  BookOpen,
  TrendingUp,
  TrendingDown,
  PieChart,
  ShoppingCart,
  Package,
  Users,
  CalendarDays,
  Settings,
  ShieldCheck,
  Bell,
  UserCircle,
  LogOut,
  Building2,
  CreditCard,
} from 'lucide-react'

type NavSection = { titleKey: string; items: { labelKey: string; href: string; icon: React.ReactNode }[] }

const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: 'erp.nav.headerOverview',
    items: [
      { labelKey: 'erp.nav.commandCenter', href: '/erp', icon: <LayoutDashboard size={16} /> },
      { labelKey: 'erp.nav.alerts', href: '/erp/alerts', icon: <Bell size={16} /> },
      { labelKey: 'erp.nav.reports', href: '/erp/reports', icon: <BarChart3 size={16} /> },
    ],
  },
  {
    titleKey: 'erp.nav.headerFinance',
    items: [
      { labelKey: 'erp.nav.generalLedger', href: '/erp/general-ledger', icon: <BookOpen size={16} /> },
      { labelKey: 'erp.nav.accountsReceivable', href: '/erp/accounts-receivable', icon: <TrendingUp size={16} /> },
      { labelKey: 'erp.nav.accountsPayable', href: '/erp/accounts-payable', icon: <TrendingDown size={16} /> },
      { labelKey: 'erp.nav.budgets', href: '/erp/budgets', icon: <PieChart size={16} /> },
    ],
  },
  {
    titleKey: 'erp.nav.headerOperations',
    items: [
      { labelKey: 'erp.nav.procurement', href: '/erp/procurement', icon: <ShoppingCart size={16} /> },
      { labelKey: 'erp.nav.inventory', href: '/erp/inventory', icon: <Package size={16} /> },
    ],
  },
  {
    titleKey: 'erp.nav.headerPeople',
    items: [
      { labelKey: 'erp.nav.hr', href: '/erp/hr', icon: <Users size={16} /> },
      { labelKey: 'erp.nav.leaveManagement', href: '/erp/hr/leave', icon: <CalendarDays size={16} /> },
    ],
  },
  {
    titleKey: 'erp.nav.headerSettings',
    items: [
      { labelKey: 'erp.nav.erpSettings', href: '/erp/settings', icon: <Settings size={16} /> },
      { labelKey: 'erp.nav.rolesPermissions', href: '/erp/settings/roles', icon: <ShieldCheck size={16} /> },
    ],
  },
]

function Sidebar() {
  const pathname = usePathname()
  const { direction, t } = useLocale()

  return (
    <nav
      dir={direction}
      style={{
        width: '240px',
        minWidth: '240px',
        height: '100vh',
        background: '#0F1B2D',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Building2 size={20} color="#3b82f6" />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>{t('erp.nav.erpTitle')}</div>
            <span style={{ fontSize: '9px', fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(59,130,246,0.12)', padding: '1px 6px', borderRadius: '3px' }}>
              {t('erp.nav.enterprise')}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.titleKey} style={{ marginBottom: '8px' }}>
            <div style={{ padding: '8px 16px 4px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
{t(section.titleKey as any)}
            </div>
            {section.items.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/erp' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '7px 16px',
                    margin: '1px 8px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#f1f5f9' : '#64748b',
                    background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                    transition: 'background 0.12s, color 0.12s',
                  }}
                  onMouseOver={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94a3b8' } }}
                  onMouseOut={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b' } }}
                >
                  <span style={{ width: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
                  {t(item.labelKey as any)}
                </Link>
              )
            })}
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'grid', gap: '6px' }}>
        <Link
          href="/erp/profile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '12px',
            color: '#64748b',
            fontWeight: 500,
            transition: 'background 0.12s, color 0.12s',
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94a3b8' }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b' }}
        >
          <UserCircle size={14} />
          {t('nav.profile')}
        </Link>
        <Link
          href="/billing"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '12px',
            color: '#64748b',
            fontWeight: 500,
            transition: 'background 0.12s, color 0.12s',
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94a3b8' }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b' }}
        >
          <CreditCard size={14} />
          {t('nav.subscription')}
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '6px',
            border: 'none',
            background: 'transparent',
            fontSize: '12px',
            color: '#64748b',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.12s, color 0.12s',
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94a3b8' }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b' }}
        >
          <LogOut size={14} />
          {t('action.signOut')}
        </button>
      </div>
    </nav>
  )
}

function TopBar() {
  const { data: session } = useSession()
  const { direction, t } = useLocale()
  const user = session?.user as { name?: string; email?: string } | undefined

  return (
    <header
      dir={direction}
      style={{
        height: '64px',
        borderBottom: '1px solid #e2e8f0',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ fontSize: '13px', color: '#64748b' }}>
        <span style={{ color: '#0f172a', fontWeight: 600 }}>{t('erp.nav.erpTitle')}</span> / <span id="erp-page-title">{t('erp.nav.commandCenter')}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <LanguageSwitcher compact />
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', position: 'relative', padding: '4px' }}>
          <Bell size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 700 }}>
            {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b' }}>{user?.name ?? t('common.search')}</span>
        </div>
      </div>
    </header>
  )
}

export function ERPShell({ children }: { children: React.ReactNode }) {
  const { direction } = useLocale()

  return (
    <div dir={direction} style={{ display: 'flex', height: '100vh', background: '#f8fafc' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar />
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
