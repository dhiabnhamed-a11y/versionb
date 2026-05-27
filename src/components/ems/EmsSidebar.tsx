'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Satellite, Radio, AlertTriangle, Truck, ShieldCheck, Building2, Users,
  BarChart3, Workflow, FileText, Settings, Siren, LayoutDashboard, ChevronLeft,
  Activity,
} from 'lucide-react'

const navItems = [
  { id: 'command-center', label: 'Command Center', href: '/dashboard/admin/ems', icon: Satellite },
  { id: 'dispatch', label: 'Dispatch', href: '/dashboard/admin/ems/dispatch', icon: Radio },
  { id: 'incidents', label: 'Incidents', href: '/dashboard/admin/ems/incidents', icon: AlertTriangle },
  { id: 'fleet', label: 'Fleet', href: '/dashboard/admin/ems/fleet', icon: Truck },
  { id: 'units', label: 'Units', href: '/dashboard/admin/ems/units', icon: ShieldCheck },
  { id: 'hospitals', label: 'Hospitals', href: '/dashboard/admin/ems/hospitals', icon: Building2 },
  { id: 'crews', label: 'Crews', href: '/dashboard/admin/ems/crews', icon: Users },
  { id: 'analytics', label: 'Analytics', href: '/dashboard/admin/ems/analytics', icon: BarChart3 },
  { id: 'automation', label: 'Automation', href: '/dashboard/admin/ems/automation', icon: Workflow },
  { id: 'protocols', label: 'Protocols', href: '/dashboard/admin/ems/protocols', icon: FileText },
  { id: 'settings', label: 'Settings', href: '/dashboard/admin/ems/settings', icon: Settings },
]

const statusBarItems = [
  { label: 'Units Available', value: '—', color: '#22c55e' },
  { label: 'Active Incidents', value: '—', color: '#ef4444' },
  { label: 'Hospitals', value: '—', color: '#3b82f6' },
]

export default function EmsSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)
  const [statusData, setStatusData] = React.useState(statusBarItems)

  React.useEffect(() => {
    fetch('/api/ems/metrics', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => {
        if (data?.data) {
          setStatusData([
            { label: 'Units Available', value: String(data.data.unitsAvailable ?? '—'), color: '#22c55e' },
            { label: 'Active Incidents', value: String(data.data.activeIncidents ?? '—'), color: '#ef4444' },
            { label: 'Hospitals', value: String(data.data.hospitalsOnline ?? '—'), color: '#3b82f6' },
          ])
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0f', color: '#e2e8f0' }}>
      <aside style={{
        width: collapsed ? 60 : 260,
        minWidth: collapsed ? 60 : 260,
        background: 'linear-gradient(180deg, #0f0f1a 0%, #0a0a14 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s ease, min-width 0.2s ease',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: collapsed ? '12px 0' : '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 12,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          {!collapsed && (
            <>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'linear-gradient(135deg, #dc2626, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Activity size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.02em' }}>EMS OS</div>
                <div style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Operations Center
                </div>
              </div>
            </>
          )}
          {collapsed && (
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #dc2626, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Activity size={16} color="#fff" />
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '8px 0', overflow: 'auto' }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link key={item.id} href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: collapsed ? '10px 0' : '10px 20px',
                  margin: '1px 8px', borderRadius: 6,
                  background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                  color: isActive ? '#60a5fa' : '#94a3b8',
                  textDecoration: 'none', fontSize: 13, fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s', justifyContent: collapsed ? 'center' : 'flex-start',
                  borderLeft: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                }}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        <div style={{
          padding: collapsed ? '8px 0' : '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-end',
              padding: '6px', background: 'transparent', border: 'none',
              color: '#64748b', cursor: 'pointer', borderRadius: 4,
            }}
          >
            <ChevronLeft size={14} style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          </button>
          {!collapsed && statusData.map((item) => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
              <span>{item.label}</span>
              <span style={{ color: item.color, fontWeight: 600 }}>{item.value}</span>
            </div>
          ))}
        </div>
      </aside>
      <main style={{ flex: 1, overflow: 'auto', background: '#0d0d18' }}>
        {children}
      </main>
    </div>
  )
}
