import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isHealthcareCompanyType } from '@/lib/company-types'
import type { SessionUser } from '@/modules/shared/session'
import { prisma } from '@/lib/db'
import { ShieldCheck, FileText, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

function formatDate(v?: Date | string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function CompliancePage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  if (!isHealthcareCompanyType(user.companyType)) redirect('/dashboard/admin')

  const [controls, auditEvents] = await Promise.all([
    prisma.enterpriseComplianceControl.findMany({
      where: { companyId: user.companyId! },
      orderBy: { nextReviewDate: 'asc' },
    }),
    prisma.enterpriseAuditEvent.findMany({
      where: { companyId: user.companyId! },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ])

  const total = controls.length
  const compliant = controls.filter((c) => c.status === 'COMPLIANT').length
  const nonCompliant = controls.filter((c) => c.status === 'NON_COMPLIANT').length
  const pending = controls.filter((c) => c.status === 'PENDING_REVIEW').length
  const dueIn30 = controls.filter((c) => {
    if (!c.nextReviewDate) return false
    const days = (new Date(c.nextReviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return days <= 30 && days >= 0
  }).length
  const score = total > 0 ? Math.round((compliant / total) * 100) : 0

  return (
    <div>
      <div className="hc-page-header">
        <div className="hc-page-header-copy">
          <div className="hc-page-sup">Governance</div>
          <h1 className="hc-page-title">Compliance &amp; Audit</h1>
          <p className="hc-page-desc">Regulatory compliance controls, audit history, and approval tracking.</p>
        </div>
      </div>

      <div className="hc-stat-grid" style={{ marginBottom: 24 }}>
        <div className={`hc-stat-card ${score >= 95 ? 'hc-stat-good' : score >= 80 ? 'hc-stat-warning' : 'hc-stat-critical'}`}>
          <div className="hc-stat-label">Compliance Score</div><div className="hc-stat-value">{score}%</div>
          <div className="hc-stat-detail">{compliant} of {total} controls compliant</div>
        </div>
        <div className="hc-stat-card"><div className="hc-stat-label">Total Controls</div><div className="hc-stat-value">{total}</div></div>
        <div className={`hc-stat-card ${nonCompliant > 0 ? 'hc-stat-critical' : ''}`}><div className="hc-stat-label">Non-Compliant</div><div className="hc-stat-value">{nonCompliant}</div></div>
        <div className={`hc-stat-card ${pending > 0 ? 'hc-stat-warning' : ''}`}><div className="hc-stat-label">Pending Review</div><div className="hc-stat-value">{pending}</div></div>
        <div className={`hc-stat-card ${dueIn30 > 0 ? 'hc-stat-warning' : ''}`}><div className="hc-stat-label">Due in 30 Days</div><div className="hc-stat-value">{dueIn30}</div></div>
      </div>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
        {/* Compliance controls */}
        <div className="hc-card">
          <div className="hc-card-header">
            <div><div className="hc-card-title">Compliance Controls</div><div className="hc-card-sub">{total} controls tracked</div></div>
            <ShieldCheck size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
          {controls.length === 0 ? (
            <div className="hc-card-body" style={{ textAlign: 'center', padding: '48px 20px' }}>
              <ShieldCheck size={40} style={{ color: 'var(--text-light)', marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>No compliance controls</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Controls are provisioned during workspace setup.</div>
            </div>
          ) : (
            <div className="hc-list">
              {controls.slice(0, 20).map((ctrl) => (
                <div key={ctrl.id} className="hc-list-item">
                  <div className={`hc-list-icon ${ctrl.status === 'COMPLIANT' ? 'hc-list-icon-green' : ctrl.status === 'NON_COMPLIANT' ? 'hc-list-icon-red' : 'hc-list-icon-amber'}`}>
                    {ctrl.status === 'COMPLIANT' ? <CheckCircle2 size={16} /> : ctrl.status === 'NON_COMPLIANT' ? <AlertTriangle size={16} /> : <Clock size={16} />}
                  </div>
                  <div className="hc-list-content">
                    <div className="hc-list-title">{ctrl.name}</div>
                    <div className="hc-list-sub">{ctrl.framework} · Next review: {formatDate(ctrl.nextReviewDate)}</div>
                  </div>
                  <span className={`hc-badge ${ctrl.status === 'COMPLIANT' ? 'hc-badge-operational' : ctrl.status === 'NON_COMPLIANT' ? 'hc-badge-critical' : 'hc-badge-maintenance'}`}>
                    {ctrl.status === 'COMPLIANT' ? 'Compliant' : ctrl.status === 'NON_COMPLIANT' ? 'Non-Compliant' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit log */}
        <div className="hc-card">
          <div className="hc-card-header">
            <div><div className="hc-card-title">Audit Trail</div><div className="hc-card-sub">Recent operational events</div></div>
            <FileText size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
          {auditEvents.length === 0 ? (
            <div className="hc-card-body" style={{ textAlign: 'center', padding: '48px 20px' }}>
              <FileText size={40} style={{ color: 'var(--text-light)', marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>No audit events</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Events are recorded automatically as operations occur.</div>
            </div>
          ) : (
            <div className="hc-list">
              {auditEvents.map((event) => (
                <div key={event.id} className="hc-list-item">
                  <div className="hc-list-icon hc-list-icon-blue"><ShieldCheck size={16} /></div>
                  <div className="hc-list-content">
                    <div className="hc-list-title">{event.action}</div>
                    <div className="hc-list-sub">{event.actor?.name || 'System'} · {formatDate(event.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
