'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AlertReceiver from '@/components/alerts/AlertReceiver'
import Image from 'next/image'
import logo from '@/app/logo.png'
import { isRealtimeAlertsEnabled } from '@/lib/socket-client'
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Bell,
  ListTodo,
  BarChart3,
  LogOut,
  Radio,
  Menu,
} from 'lucide-react'

const adminLinks = [
  { href: '/dashboard/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/admin/projects', label: 'Projects', icon: FolderKanban },
  { href: '/dashboard/admin/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/dashboard/admin/employees', label: 'Team', icon: Users },
  { href: '/dashboard/admin/alerts', label: 'Send Alert', icon: Bell },
]

const employeeLinks = [
  { href: '/dashboard/employee', label: 'My Tasks', icon: ListTodo },
  { href: '/dashboard/employee/alerts', label: 'Alerts', icon: Bell },
  { href: '/dashboard/employee/progress', label: 'Progress', icon: BarChart3 },
]

export default function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const user = session?.user as { id?: string; name?: string; role?: string }
  const isEmployee = user?.role === 'EMPLOYEE'
  const links = isEmployee ? employeeLinks : adminLinks
  const realtimeEnabled = isRealtimeAlertsEnabled()

  const roleLabel = user?.role === 'OWNER' ? 'Owner' : user?.role === 'MANAGER' ? 'Manager' : 'Employee'
  const badgeClass = user?.role === 'OWNER' ? 'badge-owner' : user?.role === 'MANAGER' ? 'badge-manager' : 'badge-employee'

  return (
    <div className="flex min-h-screen min-h-dvh">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="border-b px-4 py-5" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div className="flex items-center gap-3">
            <div
              className="icon-box flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
              style={{ background: 'var(--accent-gradient)', boxShadow: '0 8px 28px rgba(13, 148, 136, 0.35)' }}
            >
              <Image src={logo} alt="TASKIT logo" width={22} height={22} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg font-semibold tracking-tight text-slate-100">TASKIT</div>
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: '#64748b' }}
              >
                Operations studio
              </div>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
          <div
            className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: '#475569' }}
          >
            {isEmployee ? 'Your workspace' : 'Command center'}
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
                <Icon size={18} />
                <span>{link.label}</span>
                {link.label === 'Send Alert' && (
                  <span
                    className="ml-auto rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide"
                    style={{
                      background: 'rgba(239, 68, 68, 0.18)',
                      color: '#fca5a5',
                    }}
                  >
                    LIVE
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="border-t px-3 py-4" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div
            className="mb-3 flex items-center gap-3 rounded-xl px-2 py-2"
            style={{ background: 'var(--sidebar-surface)' }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-xs font-bold text-white"
              style={{ background: 'var(--accent-gradient)' }}
            >
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold" style={{ color: '#e2e8f0' }}>
                {user?.name || '…'}
              </div>
              <span className={`badge ${badgeClass} mt-1 !px-2 !py-0 !text-[9px]`}>{roleLabel}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="btn-secondary w-full !border-white/10 !bg-white/5 !text-slate-300 hover:!border-teal-400/40 hover:!bg-teal-500/10 hover:!text-teal-200"
            style={{ fontSize: '12px', padding: '8px 12px' }}
          >
            <span className="flex items-center justify-center gap-2">
              <LogOut size={14} /> Sign out
            </span>
          </button>
        </div>
      </aside>

      <div className="main-content flex min-h-screen min-h-dvh flex-1 flex-col">
        <header className="dash-header sticky top-0 z-30 flex h-[52px] items-center justify-between px-5 md:px-8">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="mobile-menu-btn -ml-1 flex items-center justify-center rounded-lg p-2"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            <Menu size={20} className="text-[var(--text-primary)]" />
          </button>
          <div className="flex items-center gap-2">
            <span
              className={`flex h-2 w-2 rounded-full ${realtimeEnabled ? 'animate-pulse' : ''}`}
              style={{
                background: realtimeEnabled ? 'var(--accent-bright)' : 'var(--text-muted)',
                boxShadow: realtimeEnabled ? '0 0 10px var(--accent-bright)' : 'none',
              }}
            />
            <Radio size={14} style={{ color: realtimeEnabled ? 'var(--accent)' : 'var(--text-muted)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              {realtimeEnabled ? 'Real-time channel active' : 'Real-time alerts unavailable on this deployment'}
            </span>
          </div>
          <div suppressHydrationWarning className="text-xs font-medium tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </header>

        <main className="flex-1 px-5 py-8 md:px-8 md:py-10">{children}</main>
      </div>

      {user?.id && realtimeEnabled && <AlertReceiver userId={user.id} />}
    </div>
  )
}
