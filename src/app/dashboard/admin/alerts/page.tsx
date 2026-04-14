'use client'

import { useEffect, useState } from 'react'
import { Bell, Radio, Phone, Clock, Zap, Send, Loader2, CheckCircle2, ChevronDown } from 'lucide-react'

interface Employee { id: string; name: string; email: string; role: string }

const ALERT_TYPES = [
  { value: 'URGENT_TASK', label: 'Urgent Task', desc: 'Immediate action required', icon: Bell, color: '#ef4444' },
  { value: 'DEADLINE_WARNING', label: 'Deadline Warning', desc: 'Approaching deadline', icon: Clock, color: '#f59e0b' },
  { value: 'MANAGER_CALL', label: 'Manager Call', desc: 'Request a callback', icon: Phone, color: '#3b82f6' },
]

export default function SendAlertPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [form, setForm] = useState({ type: 'URGENT_TASK', title: '', message: '', recipientId: '' })
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d.filter((e: Employee) => e.role === 'EMPLOYEE') : []))
  }, [])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!form.recipientId) { setError('Please select an employee'); return }
    setSending(true); setError(''); setSuccess(false)
    const res = await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSending(false)
    if (res.ok) {
      setSuccess(true); setForm({ ...form, title: '', message: '', recipientId: '' })
      setTimeout(() => setSuccess(false), 4000)
    } else { const d = await res.json(); setError(d.error || 'Failed to send') }
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '-0.02em' }}>
          <Bell size={22} style={{ color: 'var(--accent)' }} /> Send Alert
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Instantly notify an employee with a real-time sound alert.</p>
      </div>

      <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)', borderRadius: '10px', padding: '14px 16px', marginBottom: '24px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <Radio size={16} style={{ color: 'var(--accent)', marginTop: '1px', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-hover)', marginBottom: '2px' }}>Real-Time Delivery</div>
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
                <label key={t.value} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', borderRadius: '8px', border: `1px solid ${form.type === t.value ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`, background: form.type === t.value ? 'rgba(59,130,246,0.05)' : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <input type="radio" name="alertType" value={t.value} checked={form.type === t.value} onChange={e => setForm({ ...form, type: e.target.value })} style={{ accentColor: '#3b82f6' }} />
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

        {error && <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '13px' }}>{error}</div>}

        {success && (
          <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '8px', padding: '12px 14px', color: '#10b981', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <CheckCircle2 size={16} />
            <span><strong>Alert sent</strong> — the employee has been notified.</span>
          </div>
        )}

        <button className="btn-primary" type="submit" disabled={sending} style={{ height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {sending ? <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> : <><Send size={15} /> Send Alert</>}
        </button>
      </form>
    </div>
  )
}
