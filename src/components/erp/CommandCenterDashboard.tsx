'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Boxes,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react'
import { HealthScoreWidget } from '@/components/erp/HealthScoreGauge'
import { useLocale } from '@/components/i18n/LocaleProvider'
import { tErp, formatErpMoney, formatErpNumber } from '@/components/erp/erpLocale'

type DashboardMetric = {
  label: string
  value: number | string
  color?: string
  format?: string
  tone?: string
}

type ActivityItem = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  createdAt: Date | string
}

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
        borderRadius: '8px',
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
          borderRadius: '8px',
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
  metrics?: DashboardMetric[]
  operations?: { lowStockItems: number; dueSoonReceivables: number; defaultCurrency: string }
  recentActivity?: ActivityItem[]
}) {
  const { locale, direction } = useLocale()
  const currency = props.operations?.defaultCurrency ?? 'USD'
  const [alertCounts, setAlertCounts] = useState<{ total: number; unresolved: number; critical: number } | null>(null)

  useEffect(() => {
    fetch('/api/v1/erp2/alerts')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setAlertCounts(json.data)
      })
      .catch(() => {})
  }, [])

  const formatMetric = (metric: DashboardMetric) => {
    if (metric.format === 'money' && typeof metric.value === 'number') {
      return formatErpMoney(metric.value, locale, currency)
    }
    if (typeof metric.value === 'number') return formatErpNumber(metric.value, locale)
    return metric.value
  }

  return (
    <div dir={direction}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{tErp(locale, 'commandCenter')}</h1>
        {alertCounts && alertCounts.unresolved > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 10px',
              borderRadius: '12px',
              background: alertCounts.critical > 0 ? '#fef2f2' : '#fffbeb',
              color: alertCounts.critical > 0 ? '#dc2626' : '#d97706',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Bell size={12} />
            {alertCounts.unresolved} alert{alertCounts.unresolved !== 1 ? 's' : ''}
          </div>
        )}
      </div>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>
        {tErp(locale, 'erpOverview')}
      </p>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <StatCard icon={<BookOpen size={20} />} label={tErp(locale, 'chartOfAccounts')} value={props.totalAccounts} color="#3b82f6" />
        <StatCard icon={<TrendingUp size={20} />} label={tErp(locale, 'journalEntries')} value={props.totalJournalEntries} color="#10b981" />
        <StatCard icon={<ShoppingCart size={20} />} label={tErp(locale, 'purchaseOrders')} value={props.totalPurchaseOrders} color="#f59e0b" />
        <StatCard icon={<Users size={20} />} label={tErp(locale, 'employees')} value={props.totalEmployees} color="#8b5cf6" />
      </div>

      {props.metrics && props.metrics.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '16px' }}>
          {props.metrics.map((metric) => {
            const color =
              metric.tone === 'critical'
                ? '#dc2626'
                : metric.tone === 'warning'
                  ? '#d97706'
                  : metric.tone === 'good'
                    ? '#16a34a'
                    : '#475569'
            return (
              <div key={metric.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {metric.label}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color, marginTop: '6px' }}>{formatMetric(metric)}</div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <HealthScoreWidget />
        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '12px' }}>{tErp(locale, 'quickActions')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: tErp(locale, 'newJournalEntryAction'), href: '/erp/general-ledger' },
              { label: tErp(locale, 'runAnomalyScanAction'), href: '/erp/alerts' },
              { label: tErp(locale, 'cashForecastAction'), href: '/erp/reports' },
              { label: tErp(locale, 'setupGuideAction'), href: '/erp/settings' },
            ].map((action) => (
              <Link
                key={action.href}
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
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#f8fafc'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#fff'
                }}
              >
                {action.label} {'->'}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '12px' }}>{tErp(locale, 'operationalWatchlist')}</div>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155' }}>
              <Boxes size={16} color={props.operations?.lowStockItems ? '#dc2626' : '#16a34a'} />
              {props.operations?.lowStockItems ?? 0} {tErp(locale, 'skusAtReorder')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155' }}>
              <ReceiptText size={16} color={props.operations?.dueSoonReceivables ? '#d97706' : '#16a34a'} />
              {props.operations?.dueSoonReceivables ?? 0} {tErp(locale, 'receivablesDue')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155' }}>
              <AlertTriangle size={16} color={alertCounts?.unresolved ? '#d97706' : '#16a34a'} />
              {alertCounts?.unresolved ?? 0} {tErp(locale, 'unresolvedAlerts')}
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '12px' }}>
            <WalletCards size={16} />
            {tErp(locale, 'recentErpActivity')}
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {(props.recentActivity ?? []).length === 0 && (
              <div style={{ fontSize: '13px', color: '#64748b' }}>{tErp(locale, 'noErpActivity')}</div>
            )}
            {(props.recentActivity ?? []).map((activity) => (
              <div key={activity.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#334155' }}>{activity.action.replaceAll('.', ' ')}</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{new Date(activity.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : locale === 'fr' ? 'fr-FR' : 'en-US')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
