'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AlertTriangle, Copy, KeyRound, Link2, MailPlus, Plus, Users } from 'lucide-react'

interface Employee {
  id: string
  name: string
  email: string
  role: string
  assignedTasks: { id: string; stage: string; deadline?: string }[]
}

interface InviteRecord {
  id: string
  code: string
  invitedEmail: string
  invitedEmailMasked: string
  role: string
  companyName: string
  expiresAt: string
  createdAt: string
  usedAt: string | null
  inviteLink: string
}

const INVITE_TTL_OPTIONS = [
  { value: 24, label: '24 hours' },
  { value: 48, label: '48 hours' },
]

export default function EmployeesPage() {
  const { data: session } = useSession()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [invites, setInvites] = useState<InviteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ email: '', role: 'EMPLOYEE', ttlHours: 48 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdInvite, setCreatedInvite] = useState<InviteRecord | null>(null)
  const [copyFeedback, setCopyFeedback] = useState('')

  const canInviteAdmins = (session?.user as { role?: string } | undefined)?.role === 'OWNER'

  async function fetchEmployees() {
    const data = await fetch('/api/employees').then((response) => response.json())
    return Array.isArray(data) ? data : []
  }

  async function fetchInvites() {
    const data = await fetch('/api/invites').then((response) => response.json())
    return Array.isArray(data) ? data : []
  }

  useEffect(() => {
    let active = true

    const loadData = async () => {
      try {
        const [nextEmployees, nextInvites] = await Promise.all([fetchEmployees(), fetchInvites()])
        if (!active) return
        setEmployees(nextEmployees)
        setInvites(nextInvites)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadData()

    return () => {
      active = false
    }
  }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setCreatedInvite(null)
    setCopyFeedback('')

    const response = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = (await response.json()) as InviteRecord & { error?: string }
    setSaving(false)

    if (!response.ok) {
      setError(data.error || 'Failed to create invite.')
      return
    }

    setCreatedInvite(data)
    setForm({ email: '', role: 'EMPLOYEE', ttlHours: 48 })
    setInvites(await fetchInvites())
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopyFeedback(`${label} copied`)
      window.setTimeout(() => setCopyFeedback(''), 2000)
    } catch {
      setCopyFeedback(`Unable to copy ${label.toLowerCase()}`)
    }
  }

  const pendingInvites = invites.filter((invite) => !invite.usedAt && new Date(invite.expiresAt) > new Date())

  return (
    <div className="dashboard-page" style={{ maxWidth: '1080px' }}>
      <div className="dashboard-header-row">
        <div>
          <h1 className="page-heading flex items-center gap-2.5">
            <Users size={24} strokeWidth={1.85} style={{ color: 'var(--accent)' }} /> Team
          </h1>
          <p className="page-sub">{employees.length} members with {pendingInvites.length} active invites</p>
        </div>
        <button
          onClick={() => {
            setShowModal(true)
            setCreatedInvite(null)
            setError('')
            setCopyFeedback('')
          }}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
        >
          <Plus size={15} /> Invite Member
        </button>
      </div>

      <div
        className="card"
        style={{ marginBottom: '16px', display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
      >
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Invite-only onboarding
          </div>
          <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            New users can only join with a valid code. TASKIT assigns the company and role automatically on signup.
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Active invites
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>{pendingInvites.length}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Available roles
          </div>
          <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            {canInviteAdmins ? 'Admin and employee invites' : 'Employee invites only'}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">Invite queue</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
              Recent invites stay visible until they are used or expire.
            </p>
          </div>
        </div>

        {pendingInvites.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 0' }}>No active invites yet.</div>
        ) : (
          <>
            <div className="desktop-table">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Expires</th>
                      <th>Code</th>
                      <th>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvites.map((invite) => (
                      <tr key={invite.id}>
                        <td>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{invite.invitedEmail}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{invite.companyName}</div>
                        </td>
                        <td>
                          <span className={`badge ${invite.role === 'MANAGER' ? 'badge-manager' : 'badge-employee'}`}>
                            {invite.role === 'MANAGER' ? 'ADMIN' : 'EMPLOYEE'}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px' }}>{new Date(invite.expiresAt).toLocaleString()}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => copyText(invite.code, 'Code')}
                            className="btn-secondary"
                            style={{ fontSize: '11px', padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <KeyRound size={13} /> Copy code
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => copyText(invite.inviteLink, 'Invite link')}
                            className="btn-secondary"
                            style={{ fontSize: '11px', padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Link2 size={13} /> Copy link
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mobile-table-list">
              {pendingInvites.map((invite) => (
                <article key={invite.id} className="mobile-table-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{invite.invitedEmail}</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">{invite.companyName}</div>
                    </div>
                    <span className={`badge ${invite.role === 'MANAGER' ? 'badge-manager' : 'badge-employee'}`}>
                      {invite.role === 'MANAGER' ? 'ADMIN' : 'EMPLOYEE'}
                    </span>
                  </div>
                  <div className="mobile-table-meta">
                    <div className="mobile-table-meta-row">
                      <span className="mobile-table-label">Expires</span>
                      <span className="mobile-table-value">{new Date(invite.expiresAt).toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => copyText(invite.code, 'Code')}
                        className="btn-secondary"
                        style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <KeyRound size={14} /> Copy code
                      </button>
                      <button
                        type="button"
                        onClick={() => copyText(invite.inviteLink, 'Invite link')}
                        className="btn-secondary"
                        style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Link2 size={14} /> Copy link
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : (
        <>
          <div className="desktop-table">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Tasks</th>
                    <th>Completed</th>
                    <th>Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No members yet
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp, i) => {
                      const total = emp.assignedTasks.length
                      const done = emp.assignedTasks.filter((task) => task.stage === 'DONE').length
                      const score = total ? Math.round((done / total) * 100) : 0
                      const overdue = emp.assignedTasks.filter(
                        (task) => task.stage !== 'DONE' && task.deadline && new Date(task.deadline) < new Date()
                      ).length

                      return (
                        <tr key={emp.id} className="animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '8px',
                                  background: 'var(--accent-gradient)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  color: 'white',
                                  flexShrink: 0,
                                }}
                              >
                                {emp.name.charAt(0)}
                              </div>
                              <div>
                                <div style={{ fontWeight: '600', fontSize: '13px' }}>{emp.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{emp.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge badge-${emp.role.toLowerCase()}`}>{emp.role}</span>
                          </td>
                          <td>
                            <span style={{ fontWeight: '600', fontSize: '13px' }}>{total}</span>
                            {overdue > 0 && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  color: '#ef4444',
                                  marginLeft: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                }}
                              >
                                <AlertTriangle size={10} /> {overdue}
                              </span>
                            )}
                          </td>
                          <td>
                            <span style={{ fontWeight: '600', color: '#10b981', fontSize: '13px' }}>{done}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '70px' }}>
                                <div className="progress-bar">
                                  <div
                                    className="progress-fill"
                                    style={{
                                      width: `${score}%`,
                                      background: score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444',
                                    }}
                                  />
                                </div>
                              </div>
                              <span
                                style={{
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  color: score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444',
                                  minWidth: '30px',
                                }}
                              >
                                {score}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mobile-table-list">
            {employees.length === 0 ? (
              <div className="mobile-table-card text-center text-sm text-[var(--text-muted)]">No members yet</div>
            ) : (
              employees.map((emp, i) => {
                const total = emp.assignedTasks.length
                const done = emp.assignedTasks.filter((task) => task.stage === 'DONE').length
                const score = total ? Math.round((done / total) * 100) : 0
                const overdue = emp.assignedTasks.filter(
                  (task) => task.stage !== 'DONE' && task.deadline && new Date(task.deadline) < new Date()
                ).length

                return (
                  <article key={emp.id} className="mobile-table-card animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                    <div className="flex items-start gap-3">
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'var(--accent-gradient)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '13px',
                          fontWeight: '700',
                          color: 'white',
                          flexShrink: 0,
                        }}
                      >
                        {emp.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">{emp.name}</div>
                        <div className="truncate text-xs text-[var(--text-muted)]">{emp.email}</div>
                      </div>
                      <span className={`badge badge-${emp.role.toLowerCase()}`}>{emp.role}</span>
                    </div>
                    <div className="mobile-table-meta">
                      <div className="mobile-table-meta-row">
                        <span className="mobile-table-label">Assigned</span>
                        <span className="mobile-table-value">
                          {total}
                          {overdue > 0 ? ` · ${overdue} overdue` : ''}
                        </span>
                      </div>
                      <div className="mobile-table-meta-row">
                        <span className="mobile-table-label">Completed</span>
                        <span className="mobile-table-value" style={{ color: '#10b981' }}>
                          {done}
                        </span>
                      </div>
                      <div className="mobile-table-meta-row !items-center">
                        <span className="mobile-table-label">Performance</span>
                        <div className="flex items-center gap-2">
                          <div style={{ width: '84px' }}>
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${score}%`,
                                  background: score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444',
                                }}
                              />
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: '700',
                              color: score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444',
                            }}
                          >
                            {score}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '480px' }}>
            <h2 className="font-display mb-1.5 text-lg font-semibold tracking-tight">Invite team member</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '20px' }}>
              TASKIT will generate a one-time signup code and invite link for this person.
            </p>

            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Email
                </label>
                <input
                  className="input"
                  type="email"
                  placeholder="employee@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Role
                </label>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="EMPLOYEE">Employee</option>
                  {canInviteAdmins && <option value="MANAGER">Admin</option>}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Invite expiry
                </label>
                <select
                  className="input"
                  value={form.ttlHours}
                  onChange={(e) => setForm({ ...form, ttlHours: Number(e.target.value) })}
                >
                  {INVITE_TTL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div
                  style={{
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.15)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#f87171',
                    fontSize: '12px',
                  }}
                >
                  {error}
                </div>
              )}

              {createdInvite && (
                <div
                  style={{
                    background: 'rgba(34,197,94,0.06)',
                    border: '1px solid rgba(34,197,94,0.16)',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontSize: '12px', fontWeight: 700 }}>
                    <MailPlus size={14} /> Invite created
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Send this code or link to <strong>{createdInvite.invitedEmail}</strong>.
                  </div>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <div
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        background: 'var(--bg-elevated)',
                      }}
                    >
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Invite code
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                        {createdInvite.code}
                      </div>
                    </div>
                    <div
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        background: 'var(--bg-elevated)',
                      }}
                    >
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Invite link
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{createdInvite.inviteLink}</div>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Expires {new Date(createdInvite.expiresAt).toLocaleString()}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => copyText(createdInvite.code, 'Code')}
                        className="btn-secondary"
                        style={{ fontSize: '12px', padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Copy size={14} /> Copy code
                      </button>
                      <button
                        type="button"
                        onClick={() => copyText(createdInvite.inviteLink, 'Invite link')}
                        className="btn-secondary"
                        style={{ fontSize: '12px', padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Link2 size={14} /> Copy link
                      </button>
                    </div>
                    {copyFeedback && <div style={{ fontSize: '11px', color: '#15803d' }}>{copyFeedback}</div>}
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ fontSize: '12px', padding: '8px 16px' }}>
                  Close
                </button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ fontSize: '12px', padding: '8px 16px' }}>
                  {saving ? 'Creating...' : 'Create invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
