import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isHealthcareCompanyType } from '@/lib/company-types'
import type { SessionUser } from '@/modules/shared/session'
import { prisma } from '@/lib/db'
import {
  BarChart3,
  TrendingUp,
  Activity,
  Users,
  HeartPulse,
  Building2,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

function pct(value: number, total: number) {
  if (total === 0) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

export default async function ReportsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  if (!isHealthcareCompanyType(user.companyType)) redirect('/dashboard/admin')

  const companyId = user.companyId!

  // Gather all operational data in parallel
  const [
    departments,
    assets,
    incidents,
    workOrders,
    controls,
    teams,
    auditCount,
  ] = await Promise.all([
    prisma.enterpriseDepartment.findMany({
      where: { companyId },
      include: { _count: { select: { assets: true, incidents: true, teams: true } } },
    }),
    prisma.enterpriseAsset.findMany({
      where: { companyId },
      select: { status: true, healthScore: true, riskScore: true },
    }),
    prisma.enterpriseIncident.findMany({
      where: { companyId },
      select: { status: true, priority: true, createdAt: true },
    }),
    prisma.enterpriseMaintenanceWorkOrder.findMany({
      where: { companyId },
      select: { status: true, priority: true, type: true, dueAt: true },
    }),
    prisma.enterpriseComplianceControl.findMany({
      where: { companyId },
      select: { status: true },
    }),
    prisma.enterpriseTeam.findMany({
      where: { companyId },
      include: { _count: { select: { members: true } } },
    }),
    prisma.enterpriseAuditEvent.count({ where: { companyId } }),
  ])

  // Asset metrics
  const totalAssets = assets.length
  const operationalAssets = assets.filter((a) => a.status === 'OPERATIONAL').length
  const maintenanceAssets = assets.filter((a) => a.status === 'MAINTENANCE').length
  const criticalAssets = assets.filter((a) => a.riskScore > 70).length
  const avgHealth = totalAssets > 0 ? Math.round(assets.reduce((s, a) => s + a.healthScore, 0) / totalAssets) : 0
  const assetUptime = totalAssets > 0 ? Math.round((operationalAssets / totalAssets) * 100) : 0

  // Incident metrics
  const totalIncidents = incidents.length
  const openIncidents = incidents.filter((i) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(i.status)).length
  const criticalIncidents = incidents.filter((i) => i.priority === 'CRITICAL' && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(i.status)).length
  const resolvedIncidents = incidents.filter((i) => ['RESOLVED', 'CLOSED'].includes(i.status)).length
  const resolutionRate = totalIncidents > 0 ? Math.round((resolvedIncidents / totalIncidents) * 100) : 0

  // Maintenance metrics
  const totalWorkOrders = workOrders.length
  const openWorkOrders = workOrders.filter((w) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(w.status)).length
  const overdueWorkOrders = workOrders.filter((w) => w.dueAt && new Date(w.dueAt) < new Date() && !['COMPLETED', 'VERIFIED', 'CLOSED'].includes(w.status)).length
  const completedWorkOrders = workOrders.filter((w) => ['COMPLETED', 'VERIFIED', 'CLOSED'].includes(w.status)).length
  const preventiveWO = workOrders.filter((w) => w.type === 'PREVENTIVE').length
  const correctiveWO = workOrders.filter((w) => w.type === 'CORRECTIVE').length
  const maintenanceCompliance = totalWorkOrders > 0 ? Math.round((completedWorkOrders / totalWorkOrders) * 100) : 0

  // Compliance metrics
  const totalControls = controls.length
  const compliantControls = controls.filter((c) => c.status === 'COMPLIANT').length
  const complianceScore = totalControls > 0 ? Math.round((compliantControls / totalControls) * 100) : 0

  // Workforce metrics
  const totalTeams = teams.length
  const totalStaff = teams.reduce((s, t) => s + t._count.members, 0)

  // Overall health score
  const overallHealth = Math.round(
    (assetUptime * 0.3) +
    (resolutionRate * 0.2) +
    (maintenanceCompliance * 0.2) +
    (complianceScore * 0.3)
  )

  function healthTone(score: number) {
    if (score >= 90) return { class: 'hc-stat-good', label: 'Excellent' }
    if (score >= 75) return { class: 'hc-stat-warning', label: 'Good' }
    if (score >= 50) return { class: 'hc-stat-warning', label: 'Needs Attention' }
    return { class: 'hc-stat-critical', label: 'Critical' }
  }

  const health = healthTone(overallHealth)

  return (
    <div>
      <div className="hc-page-header">
        <div className="hc-page-header-copy">
          <div className="hc-page-sup">Analytics & Intelligence</div>
          <h1 className="hc-page-title">Operational Reports</h1>
          <p className="hc-page-desc">
            Hospital-wide KPI dashboard aggregating assets, incidents, maintenance, compliance, and workforce metrics.
          </p>
        </div>
      </div>

      {/* Overall Health Score */}
      <div className="hc-stat-grid" style={{ marginBottom: 24 }}>
        <div className={`hc-stat-card ${health.class}`}>
          <div className="hc-stat-label">Overall Operational Health</div>
          <div className="hc-stat-value">{overallHealth}%</div>
          <div className="hc-stat-detail">{health.label}</div>
        </div>
        <div className={`hc-stat-card ${assetUptime >= 95 ? 'hc-stat-good' : assetUptime >= 80 ? 'hc-stat-warning' : 'hc-stat-critical'}`}>
          <div className="hc-stat-label">Asset Uptime</div>
          <div className="hc-stat-value">{assetUptime}%</div>
          <div className="hc-stat-detail">{operationalAssets} of {totalAssets} operational</div>
        </div>
        <div className={`hc-stat-card ${maintenanceCompliance >= 95 ? 'hc-stat-good' : maintenanceCompliance >= 80 ? 'hc-stat-warning' : 'hc-stat-critical'}`}>
          <div className="hc-stat-label">Maintenance Compliance</div>
          <div className="hc-stat-value">{maintenanceCompliance}%</div>
          <div className="hc-stat-detail">{completedWorkOrders} of {totalWorkOrders} completed</div>
        </div>
        <div className={`hc-stat-card ${complianceScore >= 95 ? 'hc-stat-good' : complianceScore >= 80 ? 'hc-stat-warning' : 'hc-stat-critical'}`}>
          <div className="hc-stat-label">Compliance Score</div>
          <div className="hc-stat-value">{complianceScore}%</div>
          <div className="hc-stat-detail">{compliantControls} of {totalControls} compliant</div>
        </div>
        <div className={`hc-stat-card ${resolutionRate >= 80 ? 'hc-stat-good' : resolutionRate >= 60 ? 'hc-stat-warning' : 'hc-stat-critical'}`}>
          <div className="hc-stat-label">Incident Resolution</div>
          <div className="hc-stat-value">{resolutionRate}%</div>
          <div className="hc-stat-detail">{resolvedIncidents} of {totalIncidents} resolved</div>
        </div>
      </div>

      {/* Report Sections */}
      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>

        {/* Assets Report */}
        <div className="hc-card">
          <div className="hc-card-header">
            <div>
              <div className="hc-card-title">Asset Intelligence</div>
              <div className="hc-card-sub">{totalAssets} assets tracked</div>
            </div>
            <HeartPulse size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="hc-list">
            <div className="hc-list-item">
              <div className="hc-list-icon hc-list-icon-green"><CheckCircle2 size={16} /></div>
              <div className="hc-list-content">
                <div className="hc-list-title">Operational Assets</div>
                <div className="hc-list-sub">{operationalAssets} assets in service</div>
              </div>
              <span className="hc-badge hc-badge-operational">{pct(operationalAssets, totalAssets)}</span>
            </div>
            <div className="hc-list-item">
              <div className="hc-list-icon hc-list-icon-amber"><Wrench size={16} /></div>
              <div className="hc-list-content">
                <div className="hc-list-title">Under Maintenance</div>
                <div className="hc-list-sub">{maintenanceAssets} assets being serviced</div>
              </div>
              <span className="hc-badge hc-badge-maintenance">{pct(maintenanceAssets, totalAssets)}</span>
            </div>
            <div className="hc-list-item">
              <div className="hc-list-icon hc-list-icon-red"><AlertTriangle size={16} /></div>
              <div className="hc-list-content">
                <div className="hc-list-title">High Risk Assets</div>
                <div className="hc-list-sub">Risk score above 70%</div>
              </div>
              <span className="hc-badge hc-badge-critical">{criticalAssets}</span>
            </div>
            <div className="hc-list-item">
              <div className="hc-list-icon hc-list-icon-blue"><Activity size={16} /></div>
              <div className="hc-list-content">
                <div className="hc-list-title">Average Health Score</div>
                <div className="hc-list-sub">Fleet-wide equipment health</div>
              </div>
              <span className={`hc-badge ${avgHealth >= 80 ? 'hc-badge-operational' : avgHealth >= 50 ? 'hc-badge-maintenance' : 'hc-badge-critical'}`}>
                {avgHealth}%
              </span>
            </div>
          </div>
        </div>

        {/* Incident Report */}
        <div className="hc-card">
          <div className="hc-card-header">
            <div>
              <div className="hc-card-title">Incident Analysis</div>
              <div className="hc-card-sub">{totalIncidents} total incidents</div>
            </div>
            <AlertTriangle size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="hc-list">
            <div className="hc-list-item">
              <div className="hc-list-icon hc-list-icon-amber"><Clock size={16} /></div>
              <div className="hc-list-content">
                <div className="hc-list-title">Open Incidents</div>
                <div className="hc-list-sub">Awaiting resolution</div>
              </div>
              <span className={`hc-badge ${openIncidents > 0 ? 'hc-badge-maintenance' : 'hc-badge-operational'}`}>
                {openIncidents}
              </span>
            </div>
            <div className="hc-list-item">
              <div className="hc-list-icon hc-list-icon-red"><AlertTriangle size={16} /></div>
              <div className="hc-list-content">
                <div className="hc-list-title">Critical (Active)</div>
                <div className="hc-list-sub">Requires immediate response</div>
              </div>
              <span className={`hc-badge ${criticalIncidents > 0 ? 'hc-badge-critical' : 'hc-badge-operational'}`}>
                {criticalIncidents}
              </span>
            </div>
            <div className="hc-list-item">
              <div className="hc-list-icon hc-list-icon-green"><CheckCircle2 size={16} /></div>
              <div className="hc-list-content">
                <div className="hc-list-title">Resolved Incidents</div>
                <div className="hc-list-sub">Successfully closed</div>
              </div>
              <span className="hc-badge hc-badge-operational">{resolvedIncidents}</span>
            </div>
            <div className="hc-list-item">
              <div className="hc-list-icon hc-list-icon-blue"><TrendingUp size={16} /></div>
              <div className="hc-list-content">
                <div className="hc-list-title">Resolution Rate</div>
                <div className="hc-list-sub">Closed vs total incidents</div>
              </div>
              <span className={`hc-badge ${resolutionRate >= 80 ? 'hc-badge-operational' : resolutionRate >= 60 ? 'hc-badge-maintenance' : 'hc-badge-critical'}`}>
                {resolutionRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Maintenance Report */}
        <div className="hc-card">
          <div className="hc-card-header">
            <div>
              <div className="hc-card-title">Maintenance Overview</div>
              <div className="hc-card-sub">{totalWorkOrders} work orders</div>
            </div>
            <Wrench size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="hc-list">
            <div className="hc-list-item">
              <div className="hc-list-icon hc-list-icon-amber"><Clock size={16} /></div>
              <div className="hc-list-content">
                <div className="hc-list-title">Active Work Orders</div>
                <div className="hc-list-sub">Open, assigned, or in progress</div>
              </div>
              <span className={`hc-badge ${openWorkOrders > 0 ? 'hc-badge-maintenance' : 'hc-badge-operational'}`}>
                {openWorkOrders}
              </span>
            </div>
            <div className="hc-list-item">
              <div className="hc-list-icon hc-list-icon-red"><AlertTriangle size={16} /></div>
              <div className="hc-list-content">
                <div className="hc-list-title">Overdue</div>
                <div className="hc-list-sub">Past SLA due date</div>
              </div>
              <span className={`hc-badge ${overdueWorkOrders > 0 ? 'hc-badge-critical' : 'hc-badge-operational'}`}>
                {overdueWorkOrders}
              </span>
            </div>
            <div className="hc-list-item">
              <div className="hc-list-icon hc-list-icon-blue"><Wrench size={16} /></div>
              <div className="hc-list-content">
                <div className="hc-list-title">Preventive vs Corrective</div>
                <div className="hc-list-sub">Work order type distribution</div>
              </div>
              <span className="hc-badge hc-badge-inspection">{preventiveWO}P / {correctiveWO}C</span>
            </div>
            <div className="hc-list-item">
              <div className="hc-list-icon hc-list-icon-green"><CheckCircle2 size={16} /></div>
              <div className="hc-list-content">
                <div className="hc-list-title">Completed</div>
                <div className="hc-list-sub">Verified and closed</div>
              </div>
              <span className="hc-badge hc-badge-operational">{completedWorkOrders}</span>
            </div>
          </div>
        </div>

        {/* Workforce & Governance */}
        <div className="hc-card">
          <div className="hc-card-header">
            <div>
              <div className="hc-card-title">Workforce & Governance</div>
              <div className="hc-card-sub">Organizational overview</div>
            </div>
            <Users size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="hc-list">
            <div className="hc-list-item">
              <div className="hc-list-icon hc-list-icon-blue"><Building2 size={16} /></div>
              <div className="hc-list-content">
                <div className="hc-list-title">Departments</div>
                <div className="hc-list-sub">Configured operational units</div>
              </div>
              <span className="hc-badge hc-badge-inspection">{departments.length}</span>
            </div>
            <div className="hc-list-item">
              <div className="hc-list-icon hc-list-icon-green"><Users size={16} /></div>
              <div className="hc-list-content">
                <div className="hc-list-title">Teams</div>
                <div className="hc-list-sub">{totalStaff} staff members across teams</div>
              </div>
              <span className="hc-badge hc-badge-operational">{totalTeams}</span>
            </div>
            <div className="hc-list-item">
              <div className="hc-list-icon hc-list-icon-green"><ShieldCheck size={16} /></div>
              <div className="hc-list-content">
                <div className="hc-list-title">Compliance Controls</div>
                <div className="hc-list-sub">{compliantControls} of {totalControls} passing</div>
              </div>
              <span className={`hc-badge ${complianceScore >= 95 ? 'hc-badge-operational' : complianceScore >= 80 ? 'hc-badge-maintenance' : 'hc-badge-critical'}`}>
                {complianceScore}%
              </span>
            </div>
            <div className="hc-list-item">
              <div className="hc-list-icon hc-list-icon-blue"><BarChart3 size={16} /></div>
              <div className="hc-list-content">
                <div className="hc-list-title">Audit Events</div>
                <div className="hc-list-sub">Total recorded operational events</div>
              </div>
              <span className="hc-badge hc-badge-inspection">{auditCount}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
