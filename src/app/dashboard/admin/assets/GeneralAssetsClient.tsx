'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  HardHat,
  Loader2,
  Search,
  ShieldCheck,
  Truck,
  Wrench,
  XCircle,
} from 'lucide-react'

type AssetCategory = { id: string; name: string; assetType: string }
type AssetDepartment = { id: string; name: string }
type AssetUser = { id: string; name: string }

type AssetRecord = {
  id: string
  name: string
  assetTag: string
  serialNumber: string | null
  location: string | null
  vendor: string | null
  healthScore: number
  riskScore: number
  lifecycleState: string
  operationalStatus: string
  lastMaintenanceAt: string | null
  nextMaintenanceAt: string | null
  purchaseDate: string | null
  purchaseCost: string | null
  warrantyExpiresAt: string | null
  category: AssetCategory
  department: AssetDepartment | null
  assignedUser: AssetUser | null
}

export default function GeneralAssetsClient({
  initialAssets,
  categories,
  departments,
}: {
  initialAssets: AssetRecord[]
  categories: AssetCategory[]
  departments: AssetDepartment[]
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim()
    return initialAssets.filter((a) => {
      if (query && !a.name.toLowerCase().includes(query) && !a.assetTag.toLowerCase().includes(query) && !(a.serialNumber?.toLowerCase() ?? '').includes(query) && !(a.location?.toLowerCase() ?? '').includes(query)) {
        return false
      }
      if (statusFilter !== 'ALL' && a.operationalStatus !== statusFilter) return false
      if (categoryFilter !== 'ALL' && a.category.id !== categoryFilter) return false
      return true
    })
  }, [initialAssets, search, statusFilter, categoryFilter])

  const totalAssets = initialAssets.length
  const operational = initialAssets.filter((a) => a.operationalStatus === 'OPERATIONAL').length
  const inMaintenance = initialAssets.filter((a) => a.operationalStatus === 'MAINTENANCE').length
  const critical = initialAssets.filter((a) => a.riskScore > 70).length
  const avgHealth = totalAssets > 0 ? Math.round(initialAssets.reduce((s, a) => s + a.healthScore, 0) / totalAssets) : 0

  function healthColor(score: number) {
    if (score >= 80) return 'from-emerald-500 to-emerald-400'
    if (score >= 50) return 'from-amber-500 to-amber-400'
    return 'from-red-500 to-red-400'
  }

  function statusClass(status: string) {
    switch (status) {
      case 'OPERATIONAL': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'MAINTENANCE': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'OUT_OF_SERVICE': return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'DECOMMISSIONED': return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
      case 'CALIBRATION': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    }
  }

  function lifecycleBadge(state: string) {
    switch (state) {
      case 'IN_SERVICE': return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400"><CheckCircle2 size={11} />In Service</span>
      case 'UNDER_REPAIR': return <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-400"><Wrench size={11} />Repair</span>
      case 'RETIRED': return <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/20 bg-slate-500/10 px-2 py-0.5 text-[11px] font-bold text-slate-400"><XCircle size={11} />Retired</span>
      default: return <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/20 bg-slate-500/10 px-2 py-0.5 text-[11px] font-bold text-slate-400">{state}</span>
    }
  }

  const statusOptions = ['ALL', 'OPERATIONAL', 'MAINTENANCE', 'OUT_OF_SERVICE', 'CALIBRATION', 'DECOMMISSIONED']

  return (
    <div>
      <div className="mb-6 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          <Truck size={14} />
          Asset Automation
        </div>
        <h1 className="page-heading">Enterprise Assets</h1>
        <p className="page-sub">Lifecycle tracking, health monitoring, maintenance scheduling, and risk analysis across all registered assets.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="card flex flex-col gap-1 p-4">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Total</span>
          <span className="text-2xl font-bold text-[var(--text-primary)]">{totalAssets}</span>
          <span className="text-[12px] text-[var(--text-secondary)]">Registered assets</span>
        </div>
        <div className="card flex flex-col gap-1 p-4">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-400">
            <CheckCircle2 size={13} />
            Operational
          </span>
          <span className="text-2xl font-bold text-[var(--text-primary)]">{operational}</span>
          <span className="text-[12px] text-[var(--text-secondary)]">In service</span>
        </div>
        <div className="card flex flex-col gap-1 p-4">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-400">
            <Wrench size={13} />
            Maintenance
          </span>
          <span className="text-2xl font-bold text-[var(--text-primary)]">{inMaintenance}</span>
          <span className="text-[12px] text-[var(--text-secondary)]">Under repair</span>
        </div>
        <div className="card flex flex-col gap-1 p-4">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-red-400">
            <AlertTriangle size={13} />
            High Risk
          </span>
          <span className="text-2xl font-bold text-[var(--text-primary)]">{critical}</span>
          <span className="text-[12px] text-[var(--text-secondary)]">Risk score &gt; 70%</span>
        </div>
        <div className="card flex flex-col gap-1 p-4">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            <ShieldCheck size={13} />
            Avg Health
          </span>
          <span className="text-2xl font-bold text-[var(--text-primary)]">{avgHealth}%</span>
          <span className="text-[12px] text-[var(--text-secondary)]">Across all assets</span>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={18} className="text-[var(--text-muted)]" />
            <span className="text-sm font-bold text-[var(--text-primary)]">Asset Registry</span>
            <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-[11px] font-bold text-[var(--text-muted)]">{filtered.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative flex items-center">
              <Search size={14} className="pointer-events-none absolute left-2.5 text-[var(--text-muted)]" />
              <input
                className="h-9 w-48 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] pl-8 pr-3 text-[13px] text-[var(--text-primary)] outline-none ring-0 transition focus:border-[var(--accent)]"
                placeholder="Search assets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 text-[13px] text-[var(--text-primary)] outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </select>
            <select
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 text-[13px] text-[var(--text-primary)] outline-none"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <HardHat size={40} className="text-[var(--text-muted)]" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">No assets found</span>
            <span className="text-[13px] text-[var(--text-secondary)]">Adjust your search or filters to see results.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="pb-3 pr-4">Asset</th>
                  <th className="pb-3 pr-4">Tag</th>
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 pr-4">Dept</th>
                  <th className="pb-3 pr-4">Health</th>
                  <th className="pb-3 pr-4">Risk</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Lifecycle</th>
                  <th className="pb-3 pr-4">Next Maint</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((asset) => (
                  <tr key={asset.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card)]/50">
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-[var(--text-primary)]">{asset.name}</div>
                      {asset.location && <div className="text-[11px] text-[var(--text-muted)]">{asset.location}</div>}
                    </td>
                    <td className="py-3 pr-4">
                      <code className="rounded bg-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--text-muted)]">{asset.assetTag}</code>
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">{asset.category.name}</td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">{asset.department?.name ?? <span className="text-[var(--text-muted)]">&mdash;</span>}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--border)]">
                          <div className={`h-full rounded-full bg-gradient-to-r ${healthColor(asset.healthScore)}`} style={{ width: `${asset.healthScore}%` }} />
                        </div>
                        <span className="tabular-nums text-[12px] font-bold text-[var(--text-primary)]">{asset.healthScore}%</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`tabular-nums text-[12px] font-bold ${asset.riskScore > 70 ? 'text-red-400' : asset.riskScore > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {asset.riskScore}%
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusClass(asset.operationalStatus)}`}>
                        {asset.operationalStatus === 'OUT_OF_SERVICE' ? 'Offline' : asset.operationalStatus.charAt(0) + asset.operationalStatus.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="py-3 pr-4">{lifecycleBadge(asset.lifecycleState)}</td>
                    <td className="py-3 pr-4 text-[12px] text-[var(--text-muted)]">
                      {asset.nextMaintenanceAt
                        ? new Date(asset.nextMaintenanceAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : <span className="text-[var(--text-muted)]">&mdash;</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
