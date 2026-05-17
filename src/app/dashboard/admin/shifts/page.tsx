import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isHealthcareCompanyType } from '@/lib/company-types'
import type { SessionUser } from '@/modules/shared/session'
import { Clock, Sun, Moon, Phone, AlertCircle, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Shift management with demo data — in production this reads from a shifts table
const SHIFTS = [
  { id: '1', name: 'Morning Shift A', department: 'Emergency', time: '06:00 – 14:00', type: 'day', staffCount: 12, coverage: 100 },
  { id: '2', name: 'Morning Shift B', department: 'ICU', time: '06:00 – 14:00', type: 'day', staffCount: 8, coverage: 100 },
  { id: '3', name: 'Afternoon Shift A', department: 'Emergency', time: '14:00 – 22:00', type: 'day', staffCount: 10, coverage: 83 },
  { id: '4', name: 'Afternoon Shift B', department: 'Radiology', time: '14:00 – 22:00', type: 'day', staffCount: 4, coverage: 100 },
  { id: '5', name: 'Night Shift A', department: 'Emergency', time: '22:00 – 06:00', type: 'night', staffCount: 8, coverage: 100 },
  { id: '6', name: 'Night Shift B', department: 'ICU', time: '22:00 – 06:00', type: 'night', staffCount: 6, coverage: 75 },
  { id: '7', name: 'On-Call Surgery', department: 'Surgery', time: '22:00 – 06:00', type: 'oncall', staffCount: 3, coverage: 100 },
  { id: '8', name: 'On-Call Cardiology', department: 'Cardiology', time: '22:00 – 06:00', type: 'oncall', staffCount: 2, coverage: 100 },
]

const ON_CALL_STAFF = [
  { name: 'Dr. Ahmed Hassan', role: 'Surgeon', dept: 'Surgery', phone: '+974 5xxx xxxx', since: '22:00' },
  { name: 'Dr. Fatima Al-Thani', role: 'Cardiologist', dept: 'Cardiology', phone: '+974 5xxx xxxx', since: '22:00' },
  { name: 'Dr. Omar Nasser', role: 'Anesthesiologist', dept: 'Surgery', phone: '+974 5xxx xxxx', since: '22:00' },
]

export default async function ShiftsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  if (!isHealthcareCompanyType(user.companyType)) redirect('/dashboard/admin')

  const totalStaff = SHIFTS.reduce((s, sh) => s + sh.staffCount, 0)
  const gaps = SHIFTS.filter((s) => s.coverage < 100)

  return (
    <div>
      <div className="hc-page-header">
        <div className="hc-page-header-copy">
          <div className="hc-page-sup">Workforce Operations</div>
          <h1 className="hc-page-title">Shift Management</h1>
          <p className="hc-page-desc">Day, night, and on-call shift scheduling with coverage monitoring.</p>
        </div>
      </div>

      <div className="hc-stat-grid" style={{ marginBottom: 24 }}>
        <div className="hc-stat-card"><div className="hc-stat-label">Active Shifts</div><div className="hc-stat-value">{SHIFTS.length}</div></div>
        <div className="hc-stat-card"><div className="hc-stat-label">Total Staff On Shift</div><div className="hc-stat-value">{totalStaff}</div></div>
        <div className="hc-stat-card"><div className="hc-stat-label">On-Call Staff</div><div className="hc-stat-value">{ON_CALL_STAFF.length}</div></div>
        <div className={`hc-stat-card ${gaps.length > 0 ? 'hc-stat-warning' : 'hc-stat-good'}`}>
          <div className="hc-stat-label">Coverage Gaps</div><div className="hc-stat-value">{gaps.length}</div>
          <div className="hc-stat-detail">{gaps.length > 0 ? 'Shifts below 100% coverage' : 'Full coverage'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
        {/* Shift Schedule */}
        <div className="hc-card">
          <div className="hc-card-header">
            <div><div className="hc-card-title">Current Shifts</div><div className="hc-card-sub">Today&apos;s shift schedule</div></div>
            <Clock size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="hc-list">
            {SHIFTS.map((shift) => (
              <div key={shift.id} className="hc-list-item">
                <div className={`hc-list-icon ${shift.type === 'night' ? 'hc-list-icon-blue' : shift.type === 'oncall' ? 'hc-list-icon-amber' : 'hc-list-icon-green'}`}>
                  {shift.type === 'night' ? <Moon size={16} /> : shift.type === 'oncall' ? <Phone size={16} /> : <Sun size={16} />}
                </div>
                <div className="hc-list-content">
                  <div className="hc-list-title">{shift.name}</div>
                  <div className="hc-list-sub">{shift.department} · {shift.time} · {shift.staffCount} staff</div>
                </div>
                <div>
                  {shift.coverage < 100 ? (
                    <span className="hc-badge hc-badge-maintenance">{shift.coverage}%</span>
                  ) : (
                    <span className="hc-badge hc-badge-operational">Full</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* On-Call Staff */}
        <div className="hc-card">
          <div className="hc-card-header">
            <div><div className="hc-card-title">On-Call Staff</div><div className="hc-card-sub">Available for emergency response</div></div>
            <Phone size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="hc-list">
            {ON_CALL_STAFF.map((staff, idx) => (
              <div key={idx} className="hc-list-item">
                <div className="hc-list-icon hc-list-icon-amber"><Users size={16} /></div>
                <div className="hc-list-content">
                  <div className="hc-list-title">{staff.name}</div>
                  <div className="hc-list-sub">{staff.role} · {staff.dept} · Since {staff.since}</div>
                </div>
                <span className="hc-badge hc-badge-operational">On Call</span>
              </div>
            ))}
          </div>

          {/* Coverage gaps alert */}
          {gaps.length > 0 && (
            <div className="hc-card-body" style={{ borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' }}>
                <AlertCircle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Coverage Alert</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {gaps.map((g) => g.name).join(', ')} {gaps.length === 1 ? 'has' : 'have'} staffing below 100%.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
