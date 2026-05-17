import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isEnterpriseOperationsCompanyType } from '@/lib/company-types'
import { getEnterpriseOperationsDashboard } from '@/modules/enterprise/enterprise.service'
import type { SessionUser } from '@/modules/shared/session'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Factory,
  HeartPulse,
  LayoutGrid,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

function pct(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`
}

function formatDate(value?: Date | string | null) {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  detail: string
  tone?: 'neutral' | 'good' | 'watch' | 'risk'
}) {
  return (
    <article className={`taskit-card taskit-tone-${tone}`}>
      <div className="taskit-row-main">
        <span className="taskit-label">{label}</span>
        <span className="taskit-display tabular-nums" style={{ fontSize: 30 }}>
          {value}
        </span>
        <span className="taskit-body">{detail}</span>
      </div>
    </article>
  )
}

export default async function EnterpriseOperationsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser
  if (!isEnterpriseOperationsCompanyType(user.companyType)) {
    return (
      <div className="dashboard-page">
        <section className="taskit-card">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">Enterprise operations</span>
              <h1 className="taskit-heading">This workspace is using the standard TASKIT mode.</h1>
            </div>
          </div>
          <p className="taskit-body">
            Create a Healthcare, Clinic / Hospital, Enterprise Operations, or Corporate IT Operations workspace during signup to provision
            departments, assets, incidents, SLAs, maintenance, compliance, and audit workflows.
          </p>
        </section>
      </div>
    )
  }

  const data = await getEnterpriseOperationsDashboard(user)
  const topAssets = data.assets.slice(0, 6)
  const activeIncidents = data.incidents.filter((incident) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(incident.status)).slice(0, 8)
  const maintenanceTimeline = data.maintenance.slice(0, 8)

  return (
    <div className="dashboard-page taskit-overview">
      <section className="taskit-overview-header">
        <div className="taskit-overview-header-copy">
          <span className="taskit-label">Enterprise command center</span>
          <h1 className="taskit-display">Healthcare and enterprise operations</h1>
          <p className="taskit-body">
            Department queues, asset health, incident response, maintenance due dates, compliance evidence, and audit history are operating
            from one tenant-isolated workspace.
          </p>
        </div>
        <div className="taskit-overview-header-actions">
          <Link href="/dashboard/admin/requests" className="taskit-secondary-action">
            <ClipboardCheck size={20} />
            Service requests
          </Link>
          <Link href="/dashboard/admin/assets" className="taskit-secondary-action">
            <Factory size={20} />
            Assets
          </Link>
          <Link href="/dashboard/admin/maintenance" className="taskit-secondary-action">
            <Wrench size={20} />
            Maintenance
          </Link>
          <Link href="/dashboard/admin/compliance" className="taskit-secondary-action">
            <ShieldCheck size={20} />
            Compliance
          </Link>
        </div>
      </section>

      <section className="compact-stat-grid">
        <StatCard label="Asset health" value={pct(data.metrics.assetHealthAverage)} detail="Average health score across tracked assets" tone="good" />
        <StatCard label="SLA compliance" value={pct(data.metrics.slaCompliance)} detail="Open incident resolution performance" tone={data.metrics.breachedIncidents ? 'risk' : 'good'} />
        <StatCard label="Open incidents" value={data.metrics.openIncidents} detail="Active operational tickets and escalations" tone={data.metrics.openIncidents ? 'watch' : 'good'} />
        <StatCard label="High-risk assets" value={data.metrics.highRiskAssets} detail="Assets needing inspection or replacement planning" tone={data.metrics.highRiskAssets ? 'risk' : 'good'} />
        <StatCard label="Overdue maintenance" value={data.metrics.overdueMaintenance} detail="Work orders past due" tone={data.metrics.overdueMaintenance ? 'risk' : 'good'} />
        <StatCard label="Compliance reviews" value={data.metrics.complianceDue} detail="Controls due within 30 days" tone={data.metrics.complianceDue ? 'watch' : 'good'} />
      </section>

      <section className="taskit-detail-grid">
        <article className="taskit-card">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">Operations Copilot</span>
              <h2 className="taskit-heading">Risk and action signals</h2>
            </div>
            <HeartPulse size={20} aria-hidden />
          </div>
          {!data.copilotSignals.length ? (
            <div className="taskit-empty-state">
              <ShieldCheck size={20} />
              <p className="taskit-heading">No active operational risk signals</p>
              <p className="taskit-body">The copilot will surface SLA, maintenance, asset, and compliance risk as live records change.</p>
            </div>
          ) : (
            <div className="taskit-activity-list">
              {data.copilotSignals.map((signal) => (
                <div key={signal.id} className="taskit-activity-row">
                  <AlertTriangle size={20} aria-hidden />
                  <div className="taskit-row-main">
                    <span className="taskit-label">
                      {signal.copilot} / {signal.severity}
                    </span>
                    <span className="taskit-heading">{signal.title}</span>
                    <span className="taskit-body">{signal.recommendation}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="taskit-card">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">Department map</span>
              <h2 className="taskit-heading">SLA owners and workloads</h2>
            </div>
            <LayoutGrid size={20} aria-hidden />
          </div>
          <div className="compact-stat-grid">
            {data.departments.slice(0, 8).map((department) => (
              <div key={department.id} className="compact-stat">
                <span className="taskit-label">{department.code}</span>
                <span className="taskit-heading">{department.name}</span>
                <span className="taskit-body">
                  {department._count.assets} assets / {department._count.incidents} incidents
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="taskit-detail-grid">
        <article className="taskit-card">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">Incident center</span>
              <h2 className="taskit-heading">Priority queue</h2>
            </div>
            <Activity size={20} aria-hidden />
          </div>
          <div className="taskit-activity-list">
            {activeIncidents.length ? (
              activeIncidents.map((incident) => (
                <div key={incident.id} className="taskit-activity-row">
                  <span className="taskit-tone-badge taskit-tone-watch">{incident.priority}</span>
                  <div className="taskit-row-main">
                    <span className="taskit-label">
                      {incident.incidentNumber} / {incident.status}
                    </span>
                    <span className="taskit-heading">{incident.title}</span>
                    <span className="taskit-body">
                      {incident.assignedTeam?.name ?? 'Unassigned queue'} / due {formatDate(incident.resolutionDueAt)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="taskit-empty-state">
                <ClipboardCheck size={20} />
                <p className="taskit-body">No active incidents are waiting in the queue.</p>
              </div>
            )}
          </div>
        </article>

        <article className="taskit-card">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">Maintenance calendar</span>
              <h2 className="taskit-heading">Upcoming and overdue work</h2>
            </div>
            <CalendarDays size={20} aria-hidden />
          </div>
          <div className="taskit-activity-list">
            {maintenanceTimeline.length ? (
              maintenanceTimeline.map((workOrder) => (
                <div key={workOrder.id} className="taskit-activity-row">
                  <Wrench size={20} aria-hidden />
                  <div className="taskit-row-main">
                    <span className="taskit-label">
                      {workOrder.workOrderNumber} / {workOrder.priority}
                    </span>
                    <span className="taskit-heading">{workOrder.asset?.name ?? workOrder.type}</span>
                    <span className="taskit-body">
                      {workOrder.status} / due {formatDate(workOrder.dueAt)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="taskit-empty-state">
                <Wrench size={20} />
                <p className="taskit-body">No maintenance work orders have been scheduled yet.</p>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="taskit-card">
        <div className="taskit-card-header">
          <div className="taskit-row-main">
            <span className="taskit-label">Asset registry</span>
            <h2 className="taskit-heading">Lifecycle, assignment, and risk table</h2>
          </div>
          <Factory size={20} aria-hidden />
        </div>
        <div className="taskit-activity-list">
          {topAssets.length ? (
            topAssets.map((asset) => (
              <div key={asset.id} className="taskit-activity-row">
                <BarChart3 size={20} aria-hidden />
                <div className="taskit-row-main">
                  <span className="taskit-label">
                    {asset.assetTag} / {asset.category.name}
                  </span>
                  <span className="taskit-heading">{asset.name}</span>
                  <span className="taskit-body">
                    {asset.department?.name ?? 'No department'} / health {asset.healthScore}% / risk {asset.riskScore}%
                  </span>
                </div>
                <ArrowRight size={20} aria-hidden />
              </div>
            ))
          ) : (
            <div className="taskit-empty-state">
              <Factory size={20} />
              <p className="taskit-heading">Asset categories are ready</p>
              <p className="taskit-body">Create assets through the enterprise asset API to populate lifecycle, maintenance, and incident history.</p>
            </div>
          )}
        </div>
      </section>

      <section className="taskit-detail-grid">
        <article className="taskit-card">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">Team workload</span>
              <h2 className="taskit-heading">Queue ownership</h2>
            </div>
            <Users size={20} aria-hidden />
          </div>
          <div className="compact-stat-grid">
            {data.teams.slice(0, 6).map((team) => (
              <div key={team.id} className="compact-stat">
                <span className="taskit-label">{team.department.name}</span>
                <span className="taskit-heading">{team.name}</span>
                <span className="taskit-body">
                  {team._count.assignedIncidents} incidents / {team.members.length} members
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="taskit-card">
          <div className="taskit-card-header">
            <div className="taskit-row-main">
              <span className="taskit-label">Audit and governance</span>
              <h2 className="taskit-heading">Immutable enterprise events</h2>
            </div>
            <ShieldCheck size={20} aria-hidden />
          </div>
          <div className="taskit-activity-list">
            {data.auditEvents.map((event) => (
              <div key={event.id} className="taskit-activity-row">
                <ShieldCheck size={20} aria-hidden />
                <div className="taskit-row-main">
                  <span className="taskit-label">{event.actor?.name ?? 'System'}</span>
                  <span className="taskit-heading">{event.action}</span>
                  <span className="taskit-body">{formatDate(event.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}
