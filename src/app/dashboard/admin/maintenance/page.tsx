import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import type { SessionUser } from '@/modules/shared/session'
import { prisma } from '@/lib/db'
import { Wrench } from 'lucide-react'

export const dynamic = 'force-dynamic'

function priorityBadge(priority: string) {
  const map: Record<string, string> = {
    CRITICAL: 'hc-badge-critical',
    HIGH: 'hc-badge-maintenance',
    MEDIUM: 'hc-badge-inspection',
    LOW: 'hc-badge-operational',
  }
  return map[priority] || 'hc-badge-offline'
}

function formatDate(value?: Date | string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function MaintenancePage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser

  const workOrders = await prisma.enterpriseMaintenanceWorkOrder.findMany({
    where: { companyId: user.companyId! },
    include: {
      asset: { select: { name: true, assetTag: true } },
      assignedTeam: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const total = workOrders.length
  const open = workOrders.filter((w) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(w.status)).length
  const overdue = workOrders.filter((w) => w.dueAt && new Date(w.dueAt) < new Date() && !['COMPLETED', 'VERIFIED', 'CLOSED'].includes(w.status)).length
  const completed = workOrders.filter((w) => ['COMPLETED', 'VERIFIED', 'CLOSED'].includes(w.status)).length
  const preventive = workOrders.filter((w) => w.type === 'PREVENTIVE').length
  const corrective = workOrders.filter((w) => w.type === 'CORRECTIVE').length

  return (
    <div>
      <div className="hc-page-header">
        <div className="hc-page-header-copy">
          <div className="hc-page-sup">Facility Operations</div>
          <h1 className="hc-page-title">Maintenance Management</h1>
          <p className="hc-page-desc">
            Preventive, corrective, and emergency maintenance work orders with SLA tracking.
          </p>
        </div>
      </div>

      <div className="hc-stat-grid" style={{ marginBottom: 24 }}>
        <div className="hc-stat-card">
          <div className="hc-stat-label">Total Work Orders</div>
          <div className="hc-stat-value">{total}</div>
        </div>
        <div className={`hc-stat-card ${open > 0 ? 'hc-stat-warning' : ''}`}>
          <div className="hc-stat-label">Open</div>
          <div className="hc-stat-value">{open}</div>
          <div className="hc-stat-detail">Active work orders</div>
        </div>
        <div className={`hc-stat-card ${overdue > 0 ? 'hc-stat-critical' : ''}`}>
          <div className="hc-stat-label">Overdue</div>
          <div className="hc-stat-value">{overdue}</div>
          <div className="hc-stat-detail">Past due date</div>
        </div>
        <div className="hc-stat-card hc-stat-good">
          <div className="hc-stat-label">Completed</div>
          <div className="hc-stat-value">{completed}</div>
        </div>
        <div className="hc-stat-card">
          <div className="hc-stat-label">Preventive</div>
          <div className="hc-stat-value">{preventive}</div>
        </div>
        <div className="hc-stat-card">
          <div className="hc-stat-label">Corrective</div>
          <div className="hc-stat-value">{corrective}</div>
        </div>
      </div>

      <div className="hc-card">
        <div className="hc-card-header">
          <div>
            <div className="hc-card-title">Work Orders</div>
            <div className="hc-card-sub">{total} maintenance records</div>
          </div>
          <Wrench size={20} style={{ color: 'var(--text-muted)' }} />
        </div>
        {workOrders.length === 0 ? (
          <div className="hc-card-body" style={{ textAlign: 'center', padding: '48px 20px' }}>
            <Wrench size={40} style={{ color: 'var(--text-light)', marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              No maintenance work orders
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Work orders will appear here when maintenance is scheduled or incidents require repair.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Work Order</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Asset</th>
                  <th>Assigned Team</th>
                  <th>Status</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo) => (
                  <tr key={wo.id}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{wo.workOrderNumber}</td>
                    <td>
                      <span className="hc-badge hc-badge-inspection" style={{ textTransform: 'capitalize' }}>
                        {wo.type.toLowerCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`hc-badge ${priorityBadge(wo.priority)}`}>{wo.priority}</span>
                    </td>
                    <td>{wo.asset?.name || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                    <td>{wo.assignedTeam?.name || <span style={{ color: 'var(--text-light)' }}>Unassigned</span>}</td>
                    <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{wo.status.toLowerCase().replace(/_/g, ' ')}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {wo.dueAt && new Date(wo.dueAt) < new Date() && !['COMPLETED', 'VERIFIED', 'CLOSED'].includes(wo.status) ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>{formatDate(wo.dueAt)} (overdue)</span>
                      ) : (
                        formatDate(wo.dueAt)
                      )}
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
