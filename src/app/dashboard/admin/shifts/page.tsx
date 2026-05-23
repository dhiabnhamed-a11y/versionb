import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isHealthcareCompanyType } from '@/lib/company-types'
import type { SessionUser } from '@/modules/shared/session'
import { healthcareService } from '@/modules/healthcare/healthcare.service'
import { Clock, Phone, AlertCircle, Users } from 'lucide-react'
import ShiftsManager from '@/components/healthcare/ShiftsManager'

export const dynamic = 'force-dynamic'

export default async function ShiftsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  if (!isHealthcareCompanyType(user.companyType)) redirect('/dashboard/admin')

  const shiftsFromDb = await healthcareService.getStaffShiftSummaries(user.companyId || '')

  const SHIFTS = shiftsFromDb.map((s) => ({
    id: s.id,
    name: s.staffName || s.id,
    department: s.department || s.role || 'General',
    time: `${new Date(s.shiftStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(s.shiftEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    startsAt: s.shiftStart.toISOString(),
    endsAt: s.shiftEnd.toISOString(),
    type: s.status === 'on-call' ? 'oncall' : new Date(s.shiftStart).getHours() >= 18 ? 'night' : 'day',
    staffCount: 1,
    coverage: 100,
  }))

  const ON_CALL_STAFF = shiftsFromDb
    .filter((s) => s.status === 'on-call')
    .map((s) => ({
      name: s.staffName || s.id,
      role: s.role || s.department || 'On-Call',
      dept: s.department || '',
      phone: '',
      since: new Date(s.shiftStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }))

  const totalStaff = SHIFTS.reduce((s, sh) => s + (sh.staffCount || 0), 0)
  const gaps = SHIFTS.filter((s) => (s.coverage ?? 100) < 100)

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
        <div className="hc-card">
          <div className="hc-card-header">
            <div><div className="hc-card-title">Current Shifts</div><div className="hc-card-sub">Today&apos;s shift schedule</div></div>
            <Clock size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="hc-list">
            <ShiftsManager initialShifts={SHIFTS} initialOnCall={ON_CALL_STAFF} />
          </div>
        </div>

        <div className="hc-card">
          <div className="hc-card-header">
            <div><div className="hc-card-title">On-Call Staff</div><div className="hc-card-sub">Available for emergency response</div></div>
            <Phone size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="hc-list">
            {ON_CALL_STAFF.length === 0 && (
              <div className="hc-card-body" style={{ padding: '18px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                No on-call staff scheduled.
              </div>
            )}
            {ON_CALL_STAFF.map((staff, idx) => (
              <div key={idx} className="hc-list-item">
                <div className="hc-list-icon hc-list-icon-amber"><Users size={16} /></div>
                <div className="hc-list-content">
                  <div className="hc-list-title">{staff.name}</div>
                  <div className="hc-list-sub">{staff.role} - {staff.dept} - Since {staff.since}</div>
                </div>
                <span className="hc-badge hc-badge-operational">On Call</span>
              </div>
            ))}
          </div>

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
