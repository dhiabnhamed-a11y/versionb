'use client'

import { useEffect, useState } from 'react'
import { Users, Plus, Loader2, AlertTriangle } from 'lucide-react'

interface Employee {
  id: string; name: string; email: string; role: string
  assignedTasks: { id: string; stage: string; deadline?: string }[]
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ email: '', role: 'EMPLOYEE' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function load() { const d = await fetch('/api/employees').then(r => r.json()); setEmployees(Array.isArray(d) ? d : []); setLoading(false) }
  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(''); setSuccess('')
    const res = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json(); setSaving(false)
    if (!res.ok) setError(data.error || 'Failed')
    else { setSuccess(`${data.name} added`); setForm({ email: '', role: 'EMPLOYEE' }); load() }
  }

  return (
    <div style={{ maxWidth: '920px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '-0.02em' }}>
            <Users size={22} style={{ color: 'var(--accent)' }} /> Team
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{employees.length} members</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <Plus size={15} /> Add Member
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>Member</th><th>Role</th><th>Tasks</th><th>Completed</th><th>Performance</th></tr></thead>
            <tbody>
              {employees.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>No members yet</td></tr>
              ) : employees.map((emp, i) => {
                const total = emp.assignedTasks.length
                const done = emp.assignedTasks.filter(t => t.stage === 'DONE').length
                const score = total ? Math.round((done / total) * 100) : 0
                const overdue = emp.assignedTasks.filter(t => t.stage !== 'DONE' && t.deadline && new Date(t.deadline) < new Date()).length
                return (
                  <tr key={emp.id} className="animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: 'white', flexShrink: 0 }}>{emp.name.charAt(0)}</div>
                        <div><div style={{ fontWeight: '600', fontSize: '13px' }}>{emp.name}</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{emp.email}</div></div>
                      </div>
                    </td>
                    <td><span className={`badge badge-${emp.role.toLowerCase()}`}>{emp.role}</span></td>
                    <td>
                      <span style={{ fontWeight: '600', fontSize: '13px' }}>{total}</span>
                      {overdue > 0 && <span style={{ fontSize: '10px', color: '#ef4444', marginLeft: '6px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><AlertTriangle size={10} /> {overdue}</span>}
                    </td>
                    <td><span style={{ fontWeight: '600', color: '#10b981', fontSize: '13px' }}>{done}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '70px' }}><div className="progress-bar"><div className="progress-fill" style={{ width: `${score}%`, background: score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444' }} /></div></div>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444', minWidth: '30px' }}>{score}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '400px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '6px' }}>Add Team Member</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '20px' }}>User must have an existing TaskForce account.</p>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>Email</label><input className="input" type="email" placeholder="employee@company.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>Role</label><select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="EMPLOYEE">Employee</option><option value="MANAGER">Manager</option></select></div>
              {error && <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '6px', padding: '8px 12px', color: '#f87171', fontSize: '12px' }}>{error}</div>}
              {success && <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '6px', padding: '8px 12px', color: '#10b981', fontSize: '12px' }}>{success}</div>}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ fontSize: '12px', padding: '8px 16px' }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ fontSize: '12px', padding: '8px 16px' }}>{saving ? 'Adding...' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
