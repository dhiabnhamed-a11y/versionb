'use client'

import { useEffect, useState } from 'react'
import { Bell, Radio, Phone, Clock, Send, Loader2, CheckCircle2 } from 'lucide-react'
import { alertsApi, getApiErrorMessage } from '@/lib/api-client'
import { playTaskitNotificationSound, registerTaskitNotificationSoundUnlock } from '@/lib/notification-sound'

interface Employee { id: string; name: string; email: string; role: string }

const ALERT_TYPES = [
  { value: 'URGENT_TASK', label: 'Urgent Task', desc: 'Immediate action required', icon: Bell, color: '#dc2626' },
  { value: 'DEADLINE_WARNING', label: 'Deadline Warning', desc: 'Approaching deadline', icon: Clock, color: '#d97706' },
  { value: 'MANAGER_CALL', label: 'Manager Call', desc: 'Request a callback', icon: Phone, color: '#0e7490' },
]

export default function SendAlertPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [form, setForm] = useState({ type: 'URGENT_TASK', title: '', message: '', recipientId: '' })
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    registerTaskitNotificationSoundUnlock()
    fetch('/api/employees').then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d.filter((e: Employee) => e.role === 'EMPLOYEE') : []))
  }, [])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!form.recipientId) { setError('Please select an employee'); return }
    setSending(true); setError(''); setSuccess(false)
    try {
      await alertsApi.create(form)
      void playTaskitNotificationSound({ force: true })
      setSuccess(true); setForm({ ...form, title: '', message: '', recipientId: '' })
      setTimeout(() => setSuccess(false), 4000)
    } catch (error) {
      setError(getApiErrorMessage(error, 'Failed to send'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="dashboard-page" style={{ maxWidth: '560px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 className="page-heading flex items-center gap-2.5">
          <Bell size={24} strokeWidth={1.85} style={{ color: 'var(--accent)' }} /> Send alert
        </h1>
        <p className="page-sub">Reach a teammate instantly with sound, vibration, and a full-screen signal.</p>
      </div>

      <div
        style={{
          background: 'var(--accent-subtle)',
          border: '1px solid rgba(15, 118, 110, 0.2)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          marginBottom: '24px',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
        }}
      >
        <Radio size={16} style={{ color: 'var(--accent)', marginTop: '1px', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent)', marginBottom: '2px' }}>Real-time delivery</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            The employee will instantly hear a sound alert, see a full-screen notification, and their device will vibrate.
          </div>
        </div>
      </div>

      <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Alert type</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {ALERT_TYPES.map(t => {
              const Icon = t.icon
              return (
                <label key={t.value} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', borderRadius: 'var(--radius-sm)', border: `1px solid ${form.type === t.value ? 'var(--accent-ring)' : 'var(--border)'}`, background: form.type === t.value ? 'var(--accent-subtle)' : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <input type="radio" name="alertType" value={t.value} checked={form.type === t.value} onChange={e => setForm({ ...form, type: e.target.value })} className="accent-teal-600" />
                  <Icon size={16} style={{ color: t.color }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{t.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.desc}</div>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Target employee</label>
          <select className="input" value={form.recipientId} onChange={e => setForm({ ...form, recipientId: e.target.value })} required>
            <option value="">Select employee...</option>
            {employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.name} ({emp.email})</option>))}
          </select>
          {employees.length === 0 && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>No employees found. Add team members first.</p>}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Title</label>
          <input className="input" placeholder="e.g. Critical fix needed" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Message</label>
          <textarea className="input" placeholder="Alert details..." value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required rows={3} />
        </div>

        {error && <div className="alert-banner alert-danger"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>{error}</div>}

        {success && (
          <div className="alert-banner alert-success">
            <CheckCircle2 size={16} />
            <span><strong>Alert sent</strong> — the employee has been notified in real-time.</span>
          </div>
        )}

        <button className="btn-primary" type="submit" disabled={sending} style={{ height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {sending ? <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> : <><Send size={15} /> Send Alert</>}
        </button>
      </form>
    </div>
  )
}
