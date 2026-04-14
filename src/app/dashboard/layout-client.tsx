'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AlertReceiver from '@/components/alerts/AlertReceiver'
import {
  LayoutDashboard, FolderKanban, CheckSquare, Users, Bell,
  ListTodo, BarChart3, Zap, LogOut, Wifi, Menu
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

  const user = session?.user as any
  const isEmployee = user?.role === 'EMPLOYEE'
  const links = isEmployee ? employeeLinks : adminLinks

  const roleLabel = user?.role === 'OWNER' ? 'Owner' : user?.role === 'MANAGER' ? 'Manager' : 'Employee'
  const badgeClass = user?.role === 'OWNER' ? 'badge-owner' : user?.role === 'MANAGER' ? 'badge-manager' : 'badge-employee'

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, backdropFilter: 'blur(2px)' }} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-box" style={{ width: '34px', height: '34px', background: 'var(--accent-gradient)' }}>
              <Zap size={17} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px', letterSpacing: '-0.02em' }} className="gradient-text">TaskForce</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500', letterSpacing: '0.03em', textTransform: 'uppercase' }}>Workforce OS</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 12px', marginBottom: '4px' }}>
            {isEmployee ? 'Workspace' : 'Management'}
          </div>
          {links.map(link => {
            const isActive = pathname === link.href
            const Icon = link.icon
            return (
              <Link key={link.href} href={link.href} className={`sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <Icon size={18} />
                <span>{link.label}</span>
                {link.label === 'Send Alert' && (
                  <span style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.12)', color: '#f87171', borderRadius: '4px', padding: '1px 6px', fontSize: '9px', fontWeight: '700', letterSpacing: '0.04em' }}>LIVE</span>
                )}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', marginBottom: '8px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: 'white', flexShrink: 0 }}>
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || '...'}</div>
              <span className={`badge ${badgeClass}`} style={{ fontSize: '9px', padding: '0px 6px' }}>{roleLabel}</span>
            </div>
          </div>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="btn-secondary" style={{ width: '100%', fontSize: '12px', padding: '7px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content" style={{ flex: 1 }}>
        <header style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
          <button onClick={() => setSidebarOpen(true)} className="mobile-menu-btn" style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'none' }}>
            <Menu size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wifi size={13} style={{ color: '#10b981' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Real-time</span>
          </div>
          <div suppressHydrationWarning style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </header>

        <main style={{ padding: '28px 24px' }}>
          {children}
        </main>
      </div>

      {user?.id && <AlertReceiver userId={user.id} />}
    </div>
  )
}
