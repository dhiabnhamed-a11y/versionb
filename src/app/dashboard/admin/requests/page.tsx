import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isHealthcareCompanyType } from '@/lib/company-types'
import type { SessionUser } from '@/modules/shared/session'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { ClipboardList } from 'lucide-react'
import IncidentsTableClient from '@/components/healthcare/IncidentsTableClient'

export const dynamic = 'force-dynamic'

export default async function RequestsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  if (!isHealthcareCompanyType(user.companyType)) redirect('/dashboard/admin')

  type IncidentWithRelations = Prisma.EnterpriseIncidentGetPayload<{
    include: {
      assignedTeam: { select: { name: true } }
      department: { select: { name: true } }
      reportedBy: { select: { name: true } }
    }
  }>
  let incidents: IncidentWithRelations[] = []
  try {
    incidents = await prisma.enterpriseIncident.findMany({
      where: { companyId: user.companyId! },
      include: {
        assignedTeam: { select: { name: true } },
        department: { select: { name: true } },
        reportedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  } catch {
    // table may not exist yet in this environment
  }

  const total = incidents.length
  const open = incidents.filter((i) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(i.status)).length
  const critical = incidents.filter((i) => ['P1', 'CRITICAL'].includes(i.priority) && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(i.status)).length
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
          <Suspense fallback={<p className="hc-card-body">Loading incidents…</p>}>
            <IncidentsTableClient
              incidents={incidents.map((inc) => ({
                id: inc.id,
                incidentNumber: inc.incidentNumber,
                title: inc.title,
                description: inc.description,
                priority: inc.priority,
                status: inc.status,
                createdAt: inc.createdAt.toISOString(),
                department: inc.department,
                reportedBy: inc.reportedBy,
                assignedTeam: inc.assignedTeam,
              }))}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}
