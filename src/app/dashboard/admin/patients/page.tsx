import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isHealthcareCompanyType } from '@/lib/company-types'
import type { SessionUser } from '@/modules/shared/session'
import { UserRound } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Patient management with demo data — in production this reads from patients table
const PATIENTS = [
  { id: 'P-1001', name: 'Ahmed Al-Mansoori', age: 45, gender: 'Male', department: 'Emergency', status: 'admitted', physician: 'Dr. Hassan', admitted: '2026-05-15' },
  { id: 'P-1002', name: 'Fatima Al-Thani', age: 32, gender: 'Female', department: 'Maternity', status: 'in-treatment', physician: 'Dr. Al-Sulaiti', admitted: '2026-05-14' },
  { id: 'P-1003', name: 'Omar Nasser', age: 67, gender: 'Male', department: 'ICU', status: 'admitted', physician: 'Dr. Ibrahim', admitted: '2026-05-13' },
  { id: 'P-1004', name: 'Mariam Al-Kuwari', age: 28, gender: 'Female', department: 'Radiology', status: 'registered', physician: 'Dr. Ahmed', admitted: null },
  { id: 'P-1005', name: 'Khalid Al-Dosari', age: 55, gender: 'Male', department: 'Cardiology', status: 'in-treatment', physician: 'Dr. Fatima', admitted: '2026-05-16' },
  { id: 'P-1006', name: 'Noura Al-Hajri', age: 41, gender: 'Female', department: 'Surgery', status: 'discharged', physician: 'Dr. Hassan', admitted: '2026-05-10' },
  { id: 'P-1007', name: 'Saeed Al-Mohannadi', age: 73, gender: 'Male', department: 'Neurology', status: 'admitted', physician: 'Dr. Omar', admitted: '2026-05-12' },
  { id: 'P-1008', name: 'Aisha Al-Naimi', age: 36, gender: 'Female', department: 'Laboratory', status: 'registered', physician: 'Dr. Mariam', admitted: null },
]

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

  const admitted = PATIENTS.filter((p) => p.status === 'admitted').length
  const inTreatment = PATIENTS.filter((p) => p.status === 'in-treatment').length
  const discharged = PATIENTS.filter((p) => p.status === 'discharged').length

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
        <div className="hc-stat-card"><div className="hc-stat-label">Total Patients</div><div className="hc-stat-value">{PATIENTS.length}</div><div className="hc-stat-detail">Active records</div></div>
        <div className="hc-stat-card hc-stat-warning"><div className="hc-stat-label">Admitted</div><div className="hc-stat-value">{admitted}</div></div>
        <div className="hc-stat-card hc-stat-critical"><div className="hc-stat-label">In Treatment</div><div className="hc-stat-value">{inTreatment}</div></div>
        <div className="hc-stat-card hc-stat-good"><div className="hc-stat-label">Discharged</div><div className="hc-stat-value">{discharged}</div></div>
      </div>

      <div className="hc-card">
        <div className="hc-card-header">
          <div><div className="hc-card-title">Patient Records</div><div className="hc-card-sub">{PATIENTS.length} patients</div></div>
          <UserRound size={20} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="hc-table">
            <thead><tr><th>Patient ID</th><th>Name</th><th>Age</th><th>Gender</th><th>Department</th><th>Physician</th><th>Status</th><th>Admitted</th></tr></thead>
            <tbody>
              {PATIENTS.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.id}</td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.age}</td>
                  <td>{p.gender}</td>
                  <td>{p.department}</td>
                  <td>{p.physician}</td>
                  <td><span className={`hc-badge ${statusBadge(p.status)}`} style={{ textTransform: 'capitalize' }}>{p.status.replace('-', ' ')}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.admitted || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
