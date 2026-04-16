'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Camera, ChevronRight, FolderKanban, Plus, Loader2, User } from 'lucide-react'

interface Project {
  id: string
  title: string
  description?: string
  hasCamera?: boolean
  cameraType?: 'device' | 'external'
  manager?: { id: string; name: string }
  tasks: { id: string; stage: string }[]
}
interface Employee {
  id: string
  name: string
}

interface ApiFailure {
  error?: string
  detail?: string
  hint?: string
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<ApiFailure | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    managerId: '',
    hasCamera: false,
    cameraType: 'device' as 'device' | 'external',
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<ApiFailure | null>(null)

  async function fetchProjectsData() {
    const [projectResponse, employeeResponse] = await Promise.all([
      fetch('/api/projects'),
      fetch('/api/employees'),
    ])

    const [projectBody, employeeBody] = await Promise.all([projectResponse.json(), employeeResponse.json()])

    return {
      ok: projectResponse.ok,
      projects: Array.isArray(projectBody) ? projectBody : [],
      employees: Array.isArray(employeeBody) ? employeeBody : [],
      projectError: Array.isArray(projectBody) ? null : ((projectBody as ApiFailure) ?? null),
    }
  }

  useEffect(() => {
    let active = true

    const loadProjects = async () => {
      const data = await fetchProjectsData()
      if (!active) return
      setProjects(data.projects)
      setEmployees(data.employees)
      setLoadError(data.ok ? null : data.projectError)
      setLoading(false)
    }

    void loadProjects()

    return () => {
      active = false
    }
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description || undefined,
        managerId: form.managerId || undefined,
        hasCamera: form.hasCamera,
        cameraType: form.cameraType,
      }),
    })
    const body = (await response.json()) as Project | ApiFailure
    setSaving(false)
    if (!response.ok) {
      setFormError(body as ApiFailure)
      return
    }
    setShowModal(false)
    setForm({
      title: '',
      description: '',
      managerId: '',
      hasCamera: false,
      cameraType: 'device',
    })
    const data = await fetchProjectsData()
    setProjects(data.projects)
    setEmployees(data.employees)
    setLoadError(data.ok ? null : data.projectError)
  }

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 className="page-heading flex items-center gap-2.5">
            <FolderKanban size={24} strokeWidth={1.85} style={{ color: 'var(--accent)' }} /> Projects
          </h1>
          <p className="page-sub">{projects.length} active projects</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
        >
          <Plus size={15} /> New Project
        </button>
      </div>

      {loadError && (
        <div
          className="card"
          style={{
            marginBottom: '16px',
            borderColor: 'rgba(220, 38, 38, 0.2)',
            background: 'rgba(220, 38, 38, 0.04)',
          }}
        >
          <p style={{ color: '#b91c1c', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
            {loadError.error || 'Projects could not be loaded'}
          </p>
          {loadError.detail && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '6px' }}>
              {loadError.detail}
            </p>
          )}
          {loadError.hint && (
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              {loadError.hint}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card" style={{ height: '140px' }} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <FolderKanban size={32} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 10px', display: 'block' }} />
          <p style={{ color: 'var(--text-muted)', marginBottom: '12px', fontSize: '13px' }}>No projects yet</p>
          <button onClick={() => setShowModal(true)} className="btn-primary" style={{ fontSize: '12px' }}>
            Create Project
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {projects.map((p, i) => {
            const done = p.tasks.filter((t) => t.stage === 'DONE').length
            const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0
            return (
              <div key={p.id} className="card animate-fade-in flex flex-col" style={{ animationDelay: `${i * 50}ms` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div className="icon-box" style={{ width: '36px', height: '36px', background: 'var(--accent-gradient)' }}>
                    <FolderKanban size={17} color="white" />
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      background: 'var(--bg-elevated)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: '500',
                    }}
                  >
                    {p.tasks.length} tasks
                  </span>
                </div>
                <h3 style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px', letterSpacing: '-0.01em' }}>{p.title}</h3>
                {p.hasCamera && (
                  <div
                    className="mb-2 inline-flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ borderColor: 'var(--accent-ring)', color: 'var(--accent)', background: 'var(--accent-subtle)' }}
                  >
                    <Camera size={11} />
                    Camera
                  </div>
                )}
                {p.description && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: '1.5' }}>{p.description}</p>
                )}
                {p.manager && (
                  <p
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <User size={12} /> {p.manager.name}
                  </p>
                )}
                <div className="mt-auto pt-2">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      marginBottom: '4px',
                    }}
                  >
                    <span>Progress</span>
                    <span>
                      {done}/{p.tasks.length}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <Link
                    href={`/dashboard/admin/projects/${p.id}`}
                    className="mt-3 flex items-center justify-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    Open project
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal max-h-[90vh] overflow-y-auto">
            <h2 className="font-display mb-5 text-lg font-semibold tracking-tight">Create project</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Name *
                </label>
                <input
                  className="input"
                  placeholder="e.g. Q2 Campaign"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Description
                </label>
                <textarea
                  className="input"
                  placeholder="What is this about?"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Manager
                </label>
                <select className="input" value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
                  <option value="">None</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="rounded-[var(--radius-sm)] border p-3"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.hasCamera}
                    onChange={(e) => setForm({ ...form, hasCamera: e.target.checked })}
                    className="mt-1 accent-teal-600"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                      <Camera size={16} style={{ color: 'var(--accent)' }} />
                      Enable project camera
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                      Adds an in-browser camera workspace on the project page to capture images and short videos (this device or external
                      webcam later).
                    </p>
                  </div>
                </label>
                {form.hasCamera && (
                  <div className="mt-3 pl-7">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      Camera source (for your records)
                    </label>
                    <select
                      className="input"
                      value={form.cameraType}
                      onChange={(e) => setForm({ ...form, cameraType: e.target.value as 'device' | 'external' })}
                    >
                      <option value="device">This device (browser)</option>
                      <option value="external">External / dedicated camera (planned)</option>
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ fontSize: '12px', padding: '8px 16px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ fontSize: '12px', padding: '8px 16px' }}>
                  {saving ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Creating…
                    </span>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
              {formError && (
                <div
                  style={{
                    borderRadius: '8px',
                    border: '1px solid rgba(220, 38, 38, 0.18)',
                    background: 'rgba(220, 38, 38, 0.05)',
                    padding: '10px 12px',
                  }}
                >
                  <p style={{ color: '#b91c1c', fontSize: '12px', fontWeight: 700 }}>
                    {formError.error || 'Project could not be created'}
                  </p>
                  {formError.detail && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                      {formError.detail}
                    </p>
                  )}
                  {formError.hint && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                      {formError.hint}
                    </p>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
