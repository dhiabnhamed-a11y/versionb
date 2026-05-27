"use client"

import React, { useEffect, useState, useCallback } from 'react'
import { Clock, Plus, Trash2, Users, AlertCircle, X } from 'lucide-react'

type Shift = {
  id: string
  name: string
  department?: string
  time?: string
  startsAt?: string | Date
  endsAt?: string | Date
  type?: string
  staffCount?: number
  coverage?: number
}

function formatTimeRange(start?: string | Date, end?: string | Date) {
  if (!start || !end) return ''
  const startsAt = new Date(start)
  const endsAt = new Date(end)
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return ''
  return `${startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function formatDateLabel(start?: string | Date) {
  if (!start) return ''
  const d = new Date(start)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function normalizeShift(shift: Shift): Shift {
  return {
    ...shift,
    department: shift.department || 'General',
    time: shift.time || formatTimeRange(shift.startsAt, shift.endsAt),
    staffCount: Number(shift.staffCount ?? 0),
    coverage: Number(shift.coverage ?? 100),
  }
}

const defaultForm = { name: '', department: '', startsAt: '', endsAt: '', type: 'day', staffCount: 1, coverage: 100 }

const typeLabels: Record<string, string> = { day: 'Day', night: 'Night', oncall: 'On-Call' }
const typeColors: Record<string, string> = { day: '#2563eb', night: '#7c3aed', oncall: '#0891b2' }

export default function ShiftsManager({ initialShifts = [] }: { initialShifts?: Shift[]; initialOnCall?: Record<string, unknown>[] }) {
  const [shifts, setShifts] = useState<Shift[]>(() => initialShifts.map(normalizeShift))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/admin/shifts', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setShifts(data.map(normalizeShift))
        else if (data?.data) setShifts(data.data.map(normalizeShift))
      })
      .catch(() => {})
  }, [])

  function validate(): boolean {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = 'Shift name is required'
    if (!form.startsAt) errors.startsAt = 'Start time is required'
    if (!form.endsAt) errors.endsAt = 'End time is required'
    if (form.startsAt && form.endsAt && new Date(form.endsAt).getTime() <= new Date(form.startsAt).getTime()) {
      errors.endsAt = 'End time must be after start time'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function createShift(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'same-origin',
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Create failed')
      const created = payload?.data ?? payload
      setShifts((s) => [normalizeShift(created as Shift), ...s])
      setForm(defaultForm)
      setShowForm(false)
      setFieldErrors({})
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function deleteShift(id: string) {
    if (!confirm('Delete this shift?')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/shifts/${id}`, { method: 'DELETE', credentials: 'same-origin' })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Delete failed')
      setShifts((s) => s.filter((x) => x.id !== id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="hc-card" style={{ marginBottom: 24 }}>
      <div className="hc-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="hc-card-title">Shift Schedule</div>
          <div className="hc-card-sub">{shifts.length} shift{shifts.length !== 1 ? 's' : ''} scheduled</div>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setFieldErrors({}); setError(null) }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6,
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Shift'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createShift} style={{ padding: '0 20px 20px', borderBottom: '1px solid var(--border)' }}>
          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: 6, marginBottom: 14, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Shift Name</label>
              <input
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Morning Triage"
                style={{ width: '100%', padding: '8px 10px', border: `1px solid ${fieldErrors.name ? '#dc2626' : 'var(--border)'}`, borderRadius: 6, fontSize: 13, background: '#fff' }}
              />
              {fieldErrors.name && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>{fieldErrors.name}</div>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Department</label>
              <input
                value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="e.g. Emergency"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: '#fff' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Start Time</label>
              <input
                type="datetime-local" value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', border: `1px solid ${fieldErrors.startsAt ? '#dc2626' : 'var(--border)'}`, borderRadius: 6, fontSize: 13, background: '#fff' }}
              />
              {fieldErrors.startsAt && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>{fieldErrors.startsAt}</div>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>End Time</label>
              <input
                type="datetime-local" value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', border: `1px solid ${fieldErrors.endsAt ? '#dc2626' : 'var(--border)'}`, borderRadius: 6, fontSize: 13, background: '#fff' }}
              />
              {fieldErrors.endsAt && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>{fieldErrors.endsAt}</div>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Type</label>
              <select
                value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: '#fff' }}
              >
                <option value="day">Day</option>
                <option value="night">Night</option>
                <option value="oncall">On-Call</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Staff</label>
                <input
                  type="number" value={form.staffCount}
                  onChange={(e) => setForm({ ...form, staffCount: Math.max(0, Number(e.target.value)) })}
                  min={0} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: '#fff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Coverage %</label>
                <input
                  type="number" value={form.coverage}
                  onChange={(e) => setForm({ ...form, coverage: Math.min(100, Math.max(0, Number(e.target.value))) })}
                  min={0} max={100} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: '#fff' }}
                />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit" disabled={saving}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 22px',
                background: saving ? '#94a3b8' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6,
                cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >
              {saving ? 'Saving...' : 'Create Shift'}
            </button>
          </div>
        </form>
      )}

      <div className="hc-card-body" style={{ padding: 0 }}>
        {shifts.length === 0 && (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <Clock size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>No shifts scheduled yet.</div>
            <div style={{ marginTop: 4 }}>Click "Add Shift" to create the first one.</div>
          </div>
        )}
        {shifts.map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
              borderBottom: '1px solid var(--border)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-bg, #f8fafc)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
          >
            <div style={{
              width: 4, height: 36, borderRadius: 2,
              background: typeColors[s.type || 'day'] || '#2563eb', flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#64748b', marginTop: 2, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <span style={{
                    display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: typeColors[s.type || 'day'] + '18', color: typeColors[s.type || 'day'],
                  }}>
                    {typeLabels[s.type || 'day'] || s.type}
                  </span>
                </span>
                <span>{s.department}</span>
                <span>{formatDateLabel(s.startsAt)} · {s.time}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Users size={12} /> {s.staffCount}
                </span>
                {s.coverage !== undefined && s.coverage < 100 && (
                  <span style={{ color: s.coverage < 50 ? '#dc2626' : '#d97706' }}>
                    {s.coverage}% covered
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => deleteShift(s.id)} disabled={loading}
              title="Delete shift"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 6,
                background: 'transparent', cursor: 'pointer', color: '#94a3b8', flexShrink: 0,
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fca5a5' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
