'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { enterpriseApi } from '@/lib/api-client/enterprise'
import { getApiErrorMessage } from '@/lib/api-client'

type IncidentRow = {
  id: string
  incidentNumber: string
  title: string
  description?: string | null
  priority: string
  status: string
  createdAt: string
  department?: { name: string } | null
  reportedBy?: { name: string } | null
  assignedTeam?: { name: string } | null
}

function priorityBadge(p: string) {
  const m: Record<string, string> = { P1: 'hc-badge-critical', P2: 'hc-badge-maintenance', P3: 'hc-badge-inspection', P4: 'hc-badge-operational', CRITICAL: 'hc-badge-critical', HIGH: 'hc-badge-maintenance', MEDIUM: 'hc-badge-inspection', LOW: 'hc-badge-operational' }
  return m[p] || 'hc-badge-offline'
}

function formatDate(v: string) {
  return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function IncidentsTableClient({ incidents }: { incidents: IncidentRow[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const focusId = searchParams.get('incident')
  const [rows, setRows] = useState(incidents)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const selected = useMemo(() => rows.find((row) => row.id === focusId) ?? null, [focusId, rows])

  async function respond(id: string) {
    setBusyId(id)
    setMessage(null)
    try {
      const updated = await enterpriseApi.updateIncident(id, { status: 'IN_PROGRESS', firstRespondedAt: new Date().toISOString() })
      setRows((current) => current.map((row) => (row.id === id ? { ...row, status: updated.status } : row)))
      setMessage('Incident marked in progress')
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'Failed to update incident'))
    } finally {
      setBusyId(null)
    }
  }

  async function resolve(id: string) {
    setBusyId(id)
    setMessage(null)
    try {
      const updated = await enterpriseApi.updateIncident(id, { status: 'RESOLVED', resolution: 'Resolved from requests console' })
      setRows((current) => current.map((row) => (row.id === id ? { ...row, status: updated.status } : row)))
      setMessage('Incident resolved')
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'Failed to resolve incident'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section>
      {message && <p className="hc-card-body" style={{ color: 'var(--accent)', fontSize: 13 }}>{message}</p>}
      {selected && (
        <article className="hc-card" style={{ marginBottom: 16 }}>
          <header className="hc-card-header">
            <section>
              <p className="hc-card-title">{selected.title}</p>
              <p className="hc-card-sub">{selected.incidentNumber}</p>
            </section>
            <section style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="hc-new-btn" disabled={busyId === selected.id} onClick={() => void respond(selected.id)}>Respond</button>
              <button type="button" className="hc-new-btn" disabled={busyId === selected.id} onClick={() => void resolve(selected.id)}>Resolve</button>
              <button type="button" className="hc-settings-btn" onClick={() => router.push('/dashboard/admin/requests')}>Close</button>
            </section>
          </header>
          {selected.description && <p className="hc-card-body">{selected.description}</p>}
        </article>
      )}
      <section style={{ overflowX: 'auto' }}>
        <table className="hc-table">
          <thead><tr><th>ID</th><th>Title</th><th>Priority</th><th>Department</th><th>Reporter</th><th>Assigned Team</th><th>Status</th><th>Reported</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((inc) => (
              <tr key={inc.id} style={inc.id === focusId ? { background: 'rgba(15,118,110,.08)' } : undefined}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{inc.incidentNumber}</td>
                <td style={{ fontWeight: 600 }}>{inc.title}</td>
                <td><span className={`hc-badge ${priorityBadge(inc.priority)}`}>{inc.priority}</span></td>
                <td>{inc.department?.name || '—'}</td>
                <td>{inc.reportedBy?.name || '—'}</td>
                <td>{inc.assignedTeam?.name || <span style={{ color: 'var(--text-light)' }}>Unassigned</span>}</td>
                <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{inc.status.toLowerCase().replace(/_/g, ' ')}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(inc.createdAt)}</td>
                <td>
                  <section style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="hc-new-btn" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => router.push(`/dashboard/admin/requests?incident=${inc.id}`)}>View</button>
                    {!['RESOLVED', 'CLOSED', 'CANCELLED'].includes(inc.status) && (
                      <>
                        <button type="button" className="hc-new-btn" style={{ padding: '4px 8px', fontSize: 11 }} disabled={busyId === inc.id} onClick={() => void respond(inc.id)}>Respond</button>
                        <button type="button" className="hc-settings-btn" style={{ padding: '4px 8px', fontSize: 11 }} disabled={busyId === inc.id} onClick={() => void resolve(inc.id)}>Resolve</button>
                      </>
                    )}
                  </section>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  )
}
