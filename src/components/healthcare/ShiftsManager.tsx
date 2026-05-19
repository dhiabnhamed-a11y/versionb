"use client"

import React, { useEffect, useState } from 'react'

type Shift = {
  id: string
  name: string
  department?: string
  time?: string
  type?: string
  staffCount?: number
  coverage?: number
}

export default function ShiftsManager({ initialShifts = [] }: { initialShifts?: Shift[]; initialOnCall?: Record<string, unknown>[] }) {
  const [shifts, setShifts] = useState<Shift[]>(initialShifts)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', department: '', startsAt: '', endsAt: '', type: 'day', staffCount: 1, coverage: 100 })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // fetch latest on mount
    fetch('/api/admin/shifts', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setShifts(data)
        else if (data?.data) setShifts(data.data)
      })
      .catch(() => {})
  }, [])

  async function createShift(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
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
      setShifts((s) => [created as Shift, ...s])
      setForm({ name: '', department: '', startsAt: '', endsAt: '', type: 'day', staffCount: 1, coverage: 100 })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
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
    <div>
      <div style={{ marginBottom: 12 }}>
        <form onSubmit={createShift} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Shift name" />
          <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Department" />
          <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="day">Day</option>
            <option value="night">Night</option>
            <option value="oncall">OnCall</option>
          </select>
          <input type="number" value={form.staffCount} onChange={(e) => setForm({ ...form, staffCount: Number(e.target.value) })} min={0} style={{ width: 80 }} />
          <input type="number" value={form.coverage} onChange={(e) => setForm({ ...form, coverage: Number(e.target.value) })} min={0} max={100} style={{ width: 80 }} />
          <button type="submit" disabled={loading}>Create</button>
        </form>
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      </div>

      <div>
        {shifts.map((s) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #eee' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{s.department} · {s.time || ''} · {s.staffCount ?? 0} staff</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => deleteShift(s.id)} disabled={loading}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
