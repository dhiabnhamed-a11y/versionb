import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isHealthcareCompanyType } from '@/lib/company-types'
import type { SessionUser } from '@/modules/shared/session'
import { prisma } from '@/lib/db'
import { ClipboardList, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

function priorityBadge(p: string) {
  const m: Record<string, string> = { CRITICAL: 'hc-badge-critical', HIGH: 'hc-badge-maintenance', MEDIUM: 'hc-badge-inspection', LOW: 'hc-badge-operational' }
  return m[p] || 'hc-badge-offline'
}

function formatDate(v?: Date | string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function RequestsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  if (!isHealthcareCompanyType(user.companyType)) redirect('/dashboard/admin')

  const incidents = await prisma.enterpriseIncident.findMany({
    where: { companyId: user.companyId! },
    include: {
      assignedTeam: { select: { name: true } },
      department: { select: { name: true } },
      reportedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const total = incidents.length
  const open = incidents.filter((i) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(i.status)).length
  const critical = incidents.filter((i) => i.priority === 'CRITICAL' && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(i.status)).length
  const resolved = incidents.filter((i) => ['RESOLVED', 'CLOSED'].includes(i.status)).length

  return (
    <div>
      <div className="hc-page-header">
        <div className="hc-page-header-copy">
          <div className="hc-page-sup">Incident Management</div>
          <h1 className="hc-page-title">Requests &amp; Incidents</h1>
          <p className="hc-page-desc">Equipment issues, room requests, sanitation, patient transport, and emergency incidents.</p>
        </div>
      </div>

      <div className="hc-stat-grid" style={{ marginBottom: 24 }}>
        <div className="hc-stat-card"><div className="hc-stat-label">Total Requests</div><div className="hc-stat-value">{total}</div></div>
        <div className={`hc-stat-card ${open > 0 ? 'hc-stat-warning' : ''}`}><div className="hc-stat-label">Open</div><div className="hc-stat-value">{open}</div></div>
        <div className={`hc-stat-card ${critical > 0 ? 'hc-stat-critical' : ''}`}><div className="hc-stat-label">Critical</div><div className="hc-stat-value">{critical}</div></div>
        <div className="hc-stat-card hc-stat-good"><div className="hc-stat-label">Resolved</div><div className="hc-stat-value">{resolved}</div></div>
      </div>

      <div className="hc-card">
        <div className="hc-card-header">
          <div><div className="hc-card-title">All Requests</div><div className="hc-card-sub">{total} incident records</div></div>
          <ClipboardList size={20} style={{ color: 'var(--text-muted)' }} />
        </div>
        {incidents.length === 0 ? (
          <div className="hc-card-body" style={{ textAlign: 'center', padding: '48px 20px' }}>
            <ClipboardList size={40} style={{ color: 'var(--text-light)', marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>No incidents reported</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Requests and incidents will appear here as they are submitted.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="hc-table">
              <thead><tr><th>ID</th><th>Title</th><th>Priority</th><th>Department</th><th>Reporter</th><th>Assigned Team</th><th>Status</th><th>Reported</th></tr></thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{inc.incidentNumber}</td>
                    <td style={{ fontWeight: 600 }}>{inc.title}</td>
                    <td><span className={`hc-badge ${priorityBadge(inc.priority)}`}>{inc.priority}</span></td>
                    <td>{inc.department?.name || '—'}</td>
                    <td>{inc.reportedBy?.name || '—'}</td>
                    <td>{inc.assignedTeam?.name || <span style={{ color: 'var(--text-light)' }}>Unassigned</span>}</td>
                    <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{inc.status.toLowerCase().replace(/_/g, ' ')}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(inc.createdAt)}</td>
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
