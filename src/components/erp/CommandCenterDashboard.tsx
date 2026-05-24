'use client'

import { useEffect, useState } from 'react'
import { BookOpen, TrendingUp, ShoppingCart, Users, Bell } from 'lucide-react'
import { HealthScoreWidget } from '@/components/erp/HealthScoreGauge'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flex: 1,
        minWidth: '180px',
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '10px',
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{value.toLocaleString()}</div>
        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  )
}

export function CommandCenterDashboard(props: {
  totalAccounts: number
  totalJournalEntries: number
  totalPurchaseOrders: number
  totalEmployees: number
}) {
  const [alertCounts, setAlertCounts] = useState<{ total: number; unresolved: number; critical: number } | null>(null)

  useEffect(() => {
    fetch('/api/v1/erp2/alerts')
      .then(r => r.json())
      .then(json => { if (json.success) setAlertCounts(json.data) })
      .catch(() => {})
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Command Center</h1>
        {alertCounts && alertCounts.unresolved > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '2px 10px', borderRadius: '12px',
            background: alertCounts.critical > 0 ? '#fef2f2' : '#fffbeb',
            color: alertCounts.critical > 0 ? '#dc2626' : '#d97706',
            fontSize: '12px', fontWeight: 600,
          }}>
            <Bell size={12} />
            {alertCounts.unresolved} alert{alertCounts.unresolved !== 1 ? 's' : ''}
          </div>
        )}
      </div>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>ERP overview — key metrics at a glance</p>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <StatCard icon={<BookOpen size={20} />} label="Chart of Accounts" value={props.totalAccounts} color="#3b82f6" />
        <StatCard icon={<TrendingUp size={20} />} label="Journal Entries" value={props.totalJournalEntries} color="#10b981" />
        <StatCard icon={<ShoppingCart size={20} />} label="Purchase Orders" value={props.totalPurchaseOrders} color="#f59e0b" />
        <StatCard icon={<Users size={20} />} label="Employees" value={props.totalEmployees} color="#8b5cf6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <HealthScoreWidget />
        <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '12px' }}>Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'New Journal Entry', href: '/erp/general-ledger' },
              { label: 'Run Anomaly Scan', href: '/erp/alerts' },
              { label: 'Cash Forecast', href: '/erp/reports' },
              { label: 'Setup Guide', href: '/erp/settings' },
            ].map((action, i) => (
              <a
                key={i}
                href={action.href}
                style={{
                  display: 'block',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  textDecoration: 'none',
                  fontSize: '13px',
                  color: '#334155',
                  fontWeight: 500,
                  transition: 'background 0.1s',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc' }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#fff' }}
              >
                {action.label} →
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
