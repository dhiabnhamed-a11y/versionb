import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isHealthcareCompanyType } from '@/lib/company-types'
import type { SessionUser } from '@/modules/shared/session'
import { healthcareService } from '@/modules/healthcare/healthcare.service'
import { UserRound } from 'lucide-react'

export const dynamic = 'force-dynamic'

function statusBadge(status: string) {
  const m: Record<string, string> = {
    registered: 'hc-badge-inspection',
    admitted: 'hc-badge-maintenance',
    'in-treatment': 'hc-badge-critical',
    discharged: 'hc-badge-operational',
    transferred: 'hc-badge-offline',
  }
  return m[status] || 'hc-badge-offline'
}

export default async function PatientsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  if (!isHealthcareCompanyType(user.companyType)) redirect('/dashboard/admin')

  let patients: Awaited<ReturnType<typeof healthcareService.getPatientSummaries>> = []
  try {
    patients = await healthcareService.getPatientSummaries(user.companyId || '', 100)
  } catch {
    // table may not exist yet in this environment
  }
  const admitted = patients.filter((p) => p.status === 'admitted').length
  const inTreatment = patients.filter((p) => p.status === 'in-treatment').length
  const discharged = patients.filter((p) => p.status === 'discharged').length

  return (
    <div>
      <div className="hc-page-header">
        <div className="hc-page-header-copy">
          <div className="hc-page-sup">Patient Management</div>
          <h1 className="hc-page-title">Patients</h1>
          <p className="hc-page-desc">Patient records, admissions, care coordination, and discharge tracking.</p>
        </div>
      </div>

      <div className="hc-stat-grid" style={{ marginBottom: 24 }}>
        <div className="hc-stat-card"><div className="hc-stat-label">Total Patients</div><div className="hc-stat-value">{patients.length}</div><div className="hc-stat-detail">Connected records</div></div>
        <div className="hc-stat-card hc-stat-warning"><div className="hc-stat-label">Admitted</div><div className="hc-stat-value">{admitted}</div></div>
        <div className="hc-stat-card hc-stat-critical"><div className="hc-stat-label">In Treatment</div><div className="hc-stat-value">{inTreatment}</div></div>
        <div className="hc-stat-card hc-stat-good"><div className="hc-stat-label">Discharged</div><div className="hc-stat-value">{discharged}</div></div>
      </div>

      <div className="hc-card">
        <div className="hc-card-header">
          <div><div className="hc-card-title">Patient Records</div><div className="hc-card-sub">{patients.length} patients</div></div>
          <UserRound size={20} style={{ color: 'var(--text-muted)' }} />
        </div>
        {patients.length === 0 ? (
          <div className="hc-card-body" style={{ textAlign: 'center', padding: '48px 20px' }}>
            <UserRound size={40} style={{ color: 'var(--text-light)', marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              No patient registry connected
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Patient records will appear here when a patient data source is connected to this workspace.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="hc-table">
              <thead><tr><th>Patient ID</th><th>Name</th><th>Age</th><th>Gender</th><th>Department</th><th>Physician</th><th>Status</th><th>Admitted</th></tr></thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.patientNumber}</td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{p.age}</td>
                    <td>{p.gender}</td>
                    <td>{p.department || '-'}</td>
                    <td>{p.primaryPhysician || '-'}</td>
                    <td><span className={`hc-badge ${statusBadge(p.status)}`} style={{ textTransform: 'capitalize' }}>{p.status.replace('-', ' ')}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.admissionDate ? p.admissionDate.toLocaleDateString() : '-'}</td>
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
