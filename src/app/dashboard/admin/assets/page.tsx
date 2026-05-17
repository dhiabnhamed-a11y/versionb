import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isHealthcareCompanyType, normalizeCompanyType } from '@/lib/company-types'
import type { SessionUser } from '@/modules/shared/session'
import { prisma } from '@/lib/db'
import { HeartPulse, Wrench, AlertTriangle, CheckCircle2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

function healthColor(score: number) {
  if (score >= 80) return 'hc-progress-good'
  if (score >= 50) return 'hc-progress-warning'
  return 'hc-progress-critical'
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    OPERATIONAL: 'hc-badge-operational',
    MAINTENANCE: 'hc-badge-maintenance',
    OUT_OF_SERVICE: 'hc-badge-critical',
    CALIBRATION: 'hc-badge-inspection',
    DECOMMISSIONED: 'hc-badge-retired',
  }
  return map[status] || 'hc-badge-offline'
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    OPERATIONAL: 'Operational',
    MAINTENANCE: 'Maintenance',
    OUT_OF_SERVICE: 'Offline',
    CALIBRATION: 'Inspection',
    DECOMMISSIONED: 'Retired',
  }
  return map[status] || status
}

export default async function AssetsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser
  if (!isHealthcareCompanyType(user.companyType)) redirect('/dashboard/admin')

  const assets = await prisma.enterpriseAsset.findMany({
    where: { companyId: user.companyId! },
    include: {
      category: true,
      department: { select: { name: true, code: true } },
      assignedUser: { select: { name: true } },
    },
    orderBy: { healthScore: 'asc' },
    take: 100,
  })

  const totalAssets = assets.length
  const operational = assets.filter((a) => a.operationalStatus === 'OPERATIONAL').length
  const inMaintenance = assets.filter((a) => a.operationalStatus === 'MAINTENANCE').length
  const critical = assets.filter((a) => a.riskScore > 70).length
  const avgHealth = totalAssets > 0 ? Math.round(assets.reduce((s, a) => s + a.healthScore, 0) / totalAssets) : 0

  return (
    <div>
      <div className="hc-page-header">
        <div className="hc-page-header-copy">
          <div className="hc-page-sup">Asset Intelligence</div>
          <h1 className="hc-page-title">Biomedical Assets</h1>
          <p className="hc-page-desc">
            Equipment lifecycle, health scores, maintenance schedules, and risk tracking.
          </p>
        </div>
      </div>

      <div className="hc-stat-grid" style={{ marginBottom: 24 }}>
        <div className="hc-stat-card">
          <div className="hc-stat-label">Total Assets</div>
          <div className="hc-stat-value">{totalAssets}</div>
          <div className="hc-stat-detail">Tracked equipment</div>
        </div>
        <div className="hc-stat-card hc-stat-good">
          <div className="hc-stat-label">Operational</div>
          <div className="hc-stat-value">{operational}</div>
          <div className="hc-stat-detail">In service</div>
        </div>
        <div className="hc-stat-card hc-stat-warning">
          <div className="hc-stat-label">In Maintenance</div>
          <div className="hc-stat-value">{inMaintenance}</div>
          <div className="hc-stat-detail">Under repair or service</div>
        </div>
        <div className={`hc-stat-card ${critical > 0 ? 'hc-stat-critical' : ''}`}>
          <div className="hc-stat-label">High Risk</div>
          <div className="hc-stat-value">{critical}</div>
          <div className="hc-stat-detail">Risk score &gt; 70%</div>
        </div>
        <div className={`hc-stat-card ${avgHealth < 80 ? 'hc-stat-warning' : 'hc-stat-good'}`}>
          <div className="hc-stat-label">Avg Health Score</div>
          <div className="hc-stat-value">{avgHealth}%</div>
          <div className="hc-stat-detail">Across all assets</div>
        </div>
      </div>

      <div className="hc-card">
        <div className="hc-card-header">
          <div>
            <div className="hc-card-title">Asset Registry</div>
            <div className="hc-card-sub">{totalAssets} assets tracked</div>
          </div>
          <HeartPulse size={20} style={{ color: 'var(--text-muted)' }} />
        </div>
        {assets.length === 0 ? (
          <div className="hc-card-body" style={{ textAlign: 'center', padding: '48px 20px' }}>
            <HeartPulse size={40} style={{ color: 'var(--text-light)', marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              No assets registered
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Create assets through the enterprise asset API to populate lifecycle tracking.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Tag</th>
                  <th>Category</th>
                  <th>Department</th>
                  <th>Health</th>
                  <th>Risk</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Next Maintenance</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td style={{ fontWeight: 600 }}>{asset.name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{asset.assetTag}</td>
                    <td style={{ fontSize: 12 }}>{asset.category.name}</td>
                    <td>{asset.department?.name || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className={`hc-progress-bar ${healthColor(asset.healthScore)}`} style={{ width: 60 }}>
                          <div className="hc-progress-fill" style={{ width: `${asset.healthScore}%` }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {asset.healthScore}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`hc-badge ${asset.riskScore > 70 ? 'hc-badge-critical' : asset.riskScore > 40 ? 'hc-badge-maintenance' : 'hc-badge-operational'}`}
                      >
                        {asset.riskScore}%
                      </span>
                    </td>
                    <td>
                      <span className={`hc-badge ${statusBadge(asset.operationalStatus)}`}>{statusLabel(asset.operationalStatus)}</span>
                    </td>
                    <td>{asset.assignedUser?.name || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {asset.nextMaintenanceAt
                        ? new Date(asset.nextMaintenanceAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : '—'}
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
