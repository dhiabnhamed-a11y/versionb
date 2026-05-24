'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  PieChart,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  LayoutDashboard,
  ArrowRight,
  DollarSign,
  Wallet,
  CreditCard,
} from 'lucide-react'

interface KpiData {
  value: number
  currency?: string
  label: string
  change?: string
}

interface ModuleLink {
  title: string
  href: string
  icon: React.ReactNode
  description: string
}

const MODULES: ModuleLink[] = [
  { title: 'General Ledger', href: '/dashboard/admin/erp/general-ledger', icon: <BookOpen size={20} />, description: 'Chart of accounts, journal entries, and trial balance' },
  { title: 'Accounts Receivable', href: '/dashboard/admin/erp/accounts-receivable', icon: <TrendingUp size={20} />, description: 'Customer invoices, payments, and aging' },
  { title: 'Accounts Payable', href: '/dashboard/admin/erp/accounts-payable', icon: <TrendingDown size={20} />, description: 'Vendor bills, payments, and payable aging' },
  { title: 'Budgets & Forecasting', href: '/dashboard/admin/erp/budgets', icon: <PieChart size={20} />, description: 'Budget planning, forecasts, and variance analysis' },
  { title: 'Procurement', href: '/dashboard/admin/erp/procurement', icon: <ShoppingCart size={20} />, description: 'Purchase orders and vendor management' },
  { title: 'Inventory & Assets', href: '/dashboard/admin/erp/inventory', icon: <Package size={20} />, description: 'Asset tracking and inventory management' },
  { title: 'HR & Payroll', href: '/dashboard/admin/erp/hr', icon: <Users size={20} />, description: 'Employee profiles, payroll, and compensation' },
  { title: 'Financial Reports', href: '/dashboard/admin/erp/reports', icon: <BarChart3 size={20} />, description: 'P&L, balance sheet, and cash flow statements' },
]

const KPI_ENDPOINTS = [
  { key: 'cashPosition', url: '/api/v1/erp/dashboard/cash-position', icon: <Wallet size={20} />, label: 'Cash Position', color: '#10b981' },
  { key: 'arOutstanding', url: '/api/v1/erp/ar/summary', icon: <TrendingUp size={20} />, label: 'AR Outstanding', color: '#3b82f6' },
  { key: 'apOutstanding', url: '/api/v1/erp/ap/summary', icon: <TrendingDown size={20} />, label: 'AP Outstanding', color: '#f59e0b' },
  { key: 'revenue', url: '/api/v1/erp/reports/revenue-summary', icon: <DollarSign size={20} />, label: 'Revenue This Month', color: '#22c55e' },
  { key: 'budgets', url: '/api/v1/erp/budgets/summary', icon: <PieChart size={20} />, label: 'Active Budgets', color: '#a855f7' },
  { key: 'payroll', url: '/api/v1/erp/hr/payroll/next', icon: <CreditCard size={20} />, label: 'Payroll Next Run', color: '#ec4899' },
]

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

function KpiCard({ label, value, currency, icon, color, change }: KpiData & { icon: React.ReactNode; color: string }) {
  return (
    <div
      style={{
        background: 'var(--card-bg, #0f172a)',
        border: '1px solid var(--border, #1e293b)',
        borderRadius: '14px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
        <span style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          {icon}
        </span>
      </div>
      <div>
        <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary, #f1f5f9)' }}>
          {formatCurrency(value, currency)}
        </span>
        {change && (
          <span style={{ fontSize: '12px', color: change.startsWith('+') ? '#22c55e' : '#ef4444', marginLeft: '8px' }}>
            {change}
          </span>
        )}
      </div>
    </div>
  )
}

function ModuleCard({ title, href, icon, description }: ModuleLink) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: 'var(--card-bg, #0f172a)',
          border: '1px solid var(--border, #1e293b)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          transition: 'border-color 0.15s, background 0.15s',
          cursor: 'pointer',
        }}
        onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent, #3b82f6)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--accent, #3b82f6) 6%, var(--card-bg, #0f172a))' }}
        onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border, #1e293b)'; e.currentTarget.style.background = 'var(--card-bg, #0f172a)' }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(59,130,246,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent, #3b82f6)',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #f1f5f9)' }}>{title}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>{description}</div>
        </div>
        <ArrowRight size={14} style={{ color: 'var(--text-muted, #64748b)', flexShrink: 0 }} />
      </div>
    </Link>
  )
}

export default function ErpCommandCenterPage() {
  const { data: session } = useSession()
  const [kpis, setKpis] = useState<Record<string, KpiData>>({})

  useEffect(() => {
    async function fetchKpis() {
      const results: Record<string, KpiData> = {}
      for (const kpi of KPI_ENDPOINTS) {
        try {
          const res = await fetch(kpi.url, { cache: 'no-store' })
          if (res.ok) {
            const data = await res.json()
            results[kpi.key] = { value: data.value ?? 0, currency: data.currency ?? 'USD', label: data.label ?? kpi.label, change: data.change }
          } else {
            results[kpi.key] = { value: 0, label: kpi.label }
          }
        } catch {
          results[kpi.key] = { value: 0, label: kpi.label }
        }
      }
      setKpis(results)
    }
    void fetchKpis()
  }, [])

  return (
    <div style={{ maxWidth: '1080px' }}>
      <div className="dashboard-header-row">
        <div>
          <h1 className="page-heading flex items-center gap-2.5">
            <LayoutDashboard size={24} strokeWidth={1.85} style={{ color: 'var(--accent)' }} /> ERP Command Center
          </h1>
          <p className="page-sub">Your business at a glance</p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '12px',
          marginBottom: '32px',
        }}
      >
        {KPI_ENDPOINTS.map((kpi) => (
          <KpiCard
            key={kpi.key}
            label={kpis[kpi.key]?.label ?? kpi.label}
            value={kpis[kpi.key]?.value ?? 0}
            currency={kpis[kpi.key]?.currency}
            icon={kpi.icon}
            color={kpi.color}
            change={kpis[kpi.key]?.change}
          />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #f1f5f9)', margin: 0 }}>ERP Modules</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
        {MODULES.map((mod) => (
          <ModuleCard key={mod.href} {...mod} />
        ))}
      </div>
    </div>
  )
}
