import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isHealthcareCompanyType } from '@/lib/company-types'
import { HEALTHCARE_NAVIGATION } from '@/lib/healthcare-config'
import type { SessionUser } from '@/modules/shared/session'
import { prisma } from '@/lib/db'
import { Building2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DepartmentsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser
  if (!isHealthcareCompanyType(user.companyType)) redirect('/dashboard/admin')

  const departments = await prisma.enterpriseDepartment.findMany({
    where: { companyId: user.companyId! },
    include: {
      manager: { select: { id: true, name: true } },
      _count: {
        select: {
          assets: true,
          incidents: true,
          teams: true,
        },
      },
      teams: {
        select: {
          id: true,
          name: true,
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const deptTypes = HEALTHCARE_NAVIGATION.departmentTypes

  const getDeptCategory = (code: string) => {
    const match = deptTypes.find((d) => d.code === code)
    return match?.category || 'support'
  }

  const categoryColors: Record<string, { bg: string; text: string }> = {
    clinical: { bg: 'rgba(14, 165, 233, 0.1)', text: '#0ea5e9' },
    diagnostic: { bg: 'rgba(168, 85, 247, 0.1)', text: '#a855f7' },
    administrative: { bg: 'rgba(100, 116, 139, 0.1)', text: '#64748b' },
    support: { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e' },
  }

  const totalStaff = departments.reduce(
    (sum, d) => sum + d.teams.reduce((ts, t) => ts + t._count.members, 0),
    0
  )
  const totalAssets = departments.reduce((sum, d) => sum + d._count.assets, 0)
  const totalIncidents = departments.reduce((sum, d) => sum + d._count.incidents, 0)

  return (
    <div>
      <div className="hc-page-header">
        <div className="hc-page-header-copy">
          <div className="hc-page-sup">Department Management</div>
          <h1 className="hc-page-title">Clinical Departments</h1>
          <p className="hc-page-desc">
            Manage hospital departments, assigned staff, asset allocation, and operational status.
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="hc-stat-grid" style={{ marginBottom: 24 }}>
        <div className="hc-stat-card">
          <div className="hc-stat-label">Total Departments</div>
          <div className="hc-stat-value">{departments.length}</div>
          <div className="hc-stat-detail">Active operational units</div>
        </div>
        <div className="hc-stat-card">
          <div className="hc-stat-label">Total Staff</div>
          <div className="hc-stat-value">{totalStaff}</div>
          <div className="hc-stat-detail">Across all teams</div>
        </div>
        <div className="hc-stat-card">
          <div className="hc-stat-label">Tracked Assets</div>
          <div className="hc-stat-value">{totalAssets}</div>
          <div className="hc-stat-detail">Assigned to departments</div>
        </div>
        <div className="hc-stat-card hc-stat-warning">
          <div className="hc-stat-label">Open Incidents</div>
          <div className="hc-stat-value">{totalIncidents}</div>
          <div className="hc-stat-detail">Across all departments</div>
        </div>
      </div>

      {/* Department list */}
      <div className="hc-card">
        <div className="hc-card-header">
          <div>
            <div className="hc-card-title">All Departments</div>
            <div className="hc-card-sub">{departments.length} departments configured</div>
          </div>
          <Building2 size={20} style={{ color: 'var(--text-muted)' }} />
        </div>
        {departments.length === 0 ? (
          <div className="hc-card-body" style={{ textAlign: 'center', padding: '48px 20px' }}>
            <Building2 size={40} style={{ color: 'var(--text-light)', marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              No departments configured
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Departments are provisioned automatically during workspace setup, or created via the enterprise API.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Lead</th>
                  <th>Teams</th>
                  <th>Staff</th>
                  <th>Assets</th>
                  <th>Incidents</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => {
                  const category = getDeptCategory(dept.code)
                  const colors = categoryColors[category] || categoryColors.support
                  const staffCount = dept.teams.reduce((s, t) => s + t._count.members, 0)
                  return (
                    <tr key={dept.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{dept.name}</div>
                      </td>
                      <td>
                        <span className="hc-badge" style={{ background: colors.bg, color: colors.text }}>
                          {dept.code}
                        </span>
                      </td>
                      <td style={{ textTransform: 'capitalize', fontSize: 12, color: 'var(--text-muted)' }}>
                        {category}
                      </td>
                      <td>{dept.manager?.name || <span style={{ color: 'var(--text-light)' }}>Unassigned</span>}</td>
                      <td>{dept._count.teams}</td>
                      <td>{staffCount}</td>
                      <td>{dept._count.assets}</td>
                      <td>
                        {dept._count.incidents > 0 ? (
                          <span className="hc-badge hc-badge-critical">{dept._count.incidents}</span>
                        ) : (
                          <span style={{ color: 'var(--text-light)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className="hc-badge hc-badge-operational">Active</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
