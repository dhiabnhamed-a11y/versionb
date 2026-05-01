'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Camera, ChevronRight, FolderKanban, Plus, Loader2, User, Building2 } from 'lucide-react'

import { getCompanyTypeCopy, normalizeCompanyType } from '@/lib/company-types'

interface Project {
  id: string
  title: string
  description?: string
  roomId?: string | null
  room?: { id: string; name: string } | null
  hasCamera?: boolean
  cameraType?: 'device' | 'external'
  manager?: { id: string; name: string }
  tasks: { id: string; stage: string }[]
}

interface Employee {
  id: string
  name: string
}

interface Room {
  id: string
  name: string
  description?: string | null
  projectCount: number
}

interface ApiFailure {
  error?: string
  detail?: string
  hint?: string
}

export default function ProjectsPage() {
  const { data: session } = useSession()
  const companyType = normalizeCompanyType((session?.user as { companyType?: string | null } | undefined)?.companyType)
  const companyCopy = getCompanyTypeCopy(companyType)
  const isIndustry = companyType === 'INDUSTRY'
  const isAgency = companyType === 'DIGITAL_AGENCY'

  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<ApiFailure | null>(null)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    roomId: '',
    managerId: '',
    hasCamera: false,
    cameraType: 'device' as 'device' | 'external',
  })
  const [roomForm, setRoomForm] = useState({
    name: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)
  const [savingRoom, setSavingRoom] = useState(false)
  const [formError, setFormError] = useState<ApiFailure | null>(null)
  const [roomError, setRoomError] = useState<ApiFailure | null>(null)

  async function fetchProjectsData() {
    const [projectResponse, employeeResponse, roomResponse] = await Promise.all([
      fetch('/api/projects'),
      fetch('/api/employees'),
      fetch('/api/rooms'),
    ])

    const [projectBody, employeeBody, roomBody] = await Promise.all([
      projectResponse.json(),
      employeeResponse.json(),
      roomResponse.json(),
    ])

    return {
      ok: projectResponse.ok,
      projects: Array.isArray(projectBody) ? projectBody : [],
      employees: Array.isArray(employeeBody) ? employeeBody : [],
      rooms: Array.isArray(roomBody) ? roomBody : [],
      projectError: Array.isArray(projectBody) ? null : ((projectBody as ApiFailure) ?? null),
    }
  }

  async function reload() {
    const data = await fetchProjectsData()
    setProjects(data.projects)
    setEmployees(data.employees)
    setRooms(data.rooms)
    setLoadError(data.ok ? null : data.projectError)
  }

  useEffect(() => {
    let active = true

    const loadProjects = async () => {
      const data = await fetchProjectsData()
      if (!active) return
      setProjects(data.projects)
      setEmployees(data.employees)
      setRooms(data.rooms)
      setLoadError(data.ok ? null : data.projectError)
      setLoading(false)
    }

    void loadProjects()

    return () => {
      active = false
    }
  }, [])

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSaving(true)

    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description || undefined,
        roomId: isIndustry ? form.roomId || undefined : undefined,
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

    setShowProjectModal(false)
    setForm({
      title: '',
      description: '',
      roomId: '',
      managerId: '',
      hasCamera: false,
      cameraType: 'device',
    })
    await reload()
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault()
    setRoomError(null)
    setSavingRoom(true)

    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: roomForm.name,
        description: roomForm.description || undefined,
      }),
    })

    const body = (await response.json()) as Room | ApiFailure
    setSavingRoom(false)

    if (!response.ok) {
      setRoomError(body as ApiFailure)
      return
    }

    setShowRoomModal(false)
    setRoomForm({ name: '', description: '' })
    await reload()
  }

  const groupedRooms = rooms.map((room) => ({
    ...room,
    projects: projects.filter((project) => project.roomId === room.id),
  }))
  const unassignedProjects = projects.filter((project) => !project.roomId)

  function renderProjectCard(project: Project, index: number) {
    const done = project.tasks.filter((task) => task.stage === 'DONE').length
    const pct = project.tasks.length ? Math.round((done / project.tasks.length) * 100) : 0

    return (
      <div key={project.id} className="card animate-fade-in flex flex-col" style={{ animationDelay: `${index * 50}ms` }}>
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
            {project.tasks.length} {companyCopy.taskPluralLabel.toLowerCase()}
          </span>
        </div>
        <h3 style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px', letterSpacing: '-0.01em' }}>{project.title}</h3>
        {isIndustry && project.room && (
          <div
            className="mb-2 inline-flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ borderColor: 'rgba(33,66,255,0.18)', color: '#2142ff', background: 'rgba(33,66,255,0.06)' }}
          >
            <Building2 size={11} />
            {project.room.name}
          </div>
        )}
        {project.hasCamera && (
          <div
            className="mb-2 inline-flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ borderColor: 'var(--accent-ring)', color: 'var(--accent)', background: 'var(--accent-subtle)' }}
          >
            <Camera size={11} />
            Camera
          </div>
        )}
        {project.description && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: '1.5' }}>{project.description}</p>
        )}
        {project.manager && (
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
            <User size={12} /> {project.manager.name}
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
              {done}/{project.tasks.length}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <Link
            href={`/dashboard/admin/projects/${project.id}`}
            className="mt-3 flex items-center justify-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Open {companyCopy.projectLabel.toLowerCase()}
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page" style={{ maxWidth: '1080px' }}>
      <div className="dashboard-header-row">
        <div>
          <h1 className="page-heading flex items-center gap-2.5">
            <FolderKanban size={24} strokeWidth={1.85} style={{ color: 'var(--accent)' }} /> {companyCopy.projectPluralLabel}
          </h1>
          <p className="page-sub">
            {isIndustry
              ? `${rooms.length} ${companyCopy.groupPluralLabel.toLowerCase()}, ${projects.length} ${companyCopy.projectPluralLabel.toLowerCase()}`
              : isAgency
                ? `${projects.length} active campaigns ready for briefs and uploads`
                : `${projects.length} active projects`}
          </p>
        </div>
        <div className="dashboard-header-actions">
          {isIndustry && (
            <button
              onClick={() => {
                setRoomError(null)
                setShowRoomModal(true)
              }}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
            >
              <Building2 size={15} /> New {companyCopy.groupLabel}
            </button>
          )}
          <button
            onClick={() => {
              setFormError(null)
              setShowProjectModal(true)
            }}
            className="btn-primary"
            disabled={isIndustry && rooms.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
          >
            <Plus size={15} /> New {companyCopy.projectLabel}
          </button>
        </div>
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
            {loadError.error || `${companyCopy.projectPluralLabel} could not be loaded`}
          </p>
          {loadError.detail && <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '6px' }}>{loadError.detail}</p>}
          {loadError.hint && <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{loadError.hint}</p>}
        </div>
      )}

      {isIndustry && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">{companyCopy.groupPluralLabel}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                Rooms separate work areas first, then {companyCopy.projectPluralLabel.toLowerCase()} live inside each room.
              </p>
            </div>
          </div>

          {rooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Create your first {companyCopy.groupLabel.toLowerCase()} before adding {companyCopy.projectPluralLabel.toLowerCase()}.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {rooms.map((room) => (
                <div key={room.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{room.name}</div>
                  {room.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>{room.description}</p>}
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '10px' }}>
                    {room.projectCount} {companyCopy.projectPluralLabel.toLowerCase()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {[1, 2, 3].map((index) => (
            <div key={index} className="card" style={{ height: '140px' }} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <FolderKanban size={32} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 10px', display: 'block' }} />
          <p style={{ color: 'var(--text-muted)', marginBottom: '12px', fontSize: '13px' }}>
            No {companyCopy.projectPluralLabel.toLowerCase()} yet
          </p>
          <button onClick={() => setShowProjectModal(true)} className="btn-primary" style={{ fontSize: '12px' }} disabled={isIndustry && rooms.length === 0}>
            Create {companyCopy.projectLabel}
          </button>
        </div>
      ) : isIndustry ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {groupedRooms.map((room) => (
            <section key={room.id}>
              <div style={{ marginBottom: '10px' }}>
                <div className="text-sm font-semibold text-[var(--text-primary)]">{room.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  {room.projects.length} {companyCopy.projectPluralLabel.toLowerCase()}
                </div>
              </div>
              {room.projects.length === 0 ? (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--text-muted)]">
                  No {companyCopy.projectPluralLabel.toLowerCase()} in this {companyCopy.groupLabel.toLowerCase()} yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {room.projects.map((project, index) => renderProjectCard(project, index))}
                </div>
              )}
            </section>
          ))}

          {unassignedProjects.length > 0 && (
            <section>
              <div style={{ marginBottom: '10px' }}>
                <div className="text-sm font-semibold text-[var(--text-primary)]">Unassigned room</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  {unassignedProjects.length} {companyCopy.projectPluralLabel.toLowerCase()}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {unassignedProjects.map((project, index) => renderProjectCard(project, index))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {projects.map((project, index) => renderProjectCard(project, index))}
        </div>
      )}

      {showProjectModal && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setShowProjectModal(false)}>
          <div className="modal max-h-[90vh] overflow-y-auto">
            <h2 className="font-display mb-5 text-lg font-semibold tracking-tight">Create {companyCopy.projectLabel.toLowerCase()}</h2>
            <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {isIndustry && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    {companyCopy.groupLabel} *
                  </label>
                  <select className="input" value={form.roomId} onChange={(event) => setForm({ ...form, roomId: event.target.value })} required>
                    <option value="">Select a room...</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Name *
                </label>
                <input
                  className="input"
                  placeholder={isAgency ? 'e.g. Summer launch campaign' : 'e.g. Q2 delivery project'}
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Description
                </label>
                <textarea
                  className="input"
                  placeholder={isAgency ? 'Client scope, creative direction, and delivery notes' : 'What is this about?'}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Manager
                </label>
                <select className="input" value={form.managerId} onChange={(event) => setForm({ ...form, managerId: event.target.value })}>
                  <option value="">None</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-[var(--radius-sm)] border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.hasCamera}
                    onChange={(event) => setForm({ ...form, hasCamera: event.target.checked })}
                    className="mt-1 accent-teal-600"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                      <Camera size={16} style={{ color: 'var(--accent)' }} />
                      Enable project camera
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                      Adds a camera workspace on the project page for browser capture or external IP camera streaming.
                    </p>
                  </div>
                </label>
                {form.hasCamera && (
                  <div className="mt-3 pl-7">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      Camera source
                    </label>
                    <select className="input" value={form.cameraType} onChange={(event) => setForm({ ...form, cameraType: event.target.value as 'device' | 'external' })}>
                      <option value="device">This device (browser)</option>
                      <option value="external">External IP camera</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowProjectModal(false)} className="btn-secondary" style={{ fontSize: '12px', padding: '8px 16px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ fontSize: '12px', padding: '8px 16px' }}>
                  {saving ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    `Create ${companyCopy.projectLabel}`
                  )}
                </button>
              </div>

              {formError && (
                <div style={{ borderRadius: '8px', border: '1px solid rgba(220, 38, 38, 0.18)', background: 'rgba(220, 38, 38, 0.05)', padding: '10px 12px' }}>
                  <p style={{ color: '#b91c1c', fontSize: '12px', fontWeight: 700 }}>{formError.error || `${companyCopy.projectLabel} could not be created`}</p>
                  {formError.detail && <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>{formError.detail}</p>}
                  {formError.hint && <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>{formError.hint}</p>}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {showRoomModal && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setShowRoomModal(false)}>
          <div className="modal">
            <h2 className="font-display mb-5 text-lg font-semibold tracking-tight">Create {companyCopy.groupLabel.toLowerCase()}</h2>
            <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Name *
                </label>
                <input
                  className="input"
                  placeholder="e.g. Assembly line A"
                  value={roomForm.name}
                  onChange={(event) => setRoomForm({ ...roomForm, name: event.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Description
                </label>
                <textarea
                  className="input"
                  placeholder="What kind of work lives in this room?"
                  value={roomForm.description}
                  onChange={(event) => setRoomForm({ ...roomForm, description: event.target.value })}
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowRoomModal(false)} className="btn-secondary" style={{ fontSize: '12px', padding: '8px 16px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={savingRoom} style={{ fontSize: '12px', padding: '8px 16px' }}>
                  {savingRoom ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    `Create ${companyCopy.groupLabel}`
                  )}
                </button>
              </div>

              {roomError && (
                <div style={{ borderRadius: '8px', border: '1px solid rgba(220, 38, 38, 0.18)', background: 'rgba(220, 38, 38, 0.05)', padding: '10px 12px' }}>
                  <p style={{ color: '#b91c1c', fontSize: '12px', fontWeight: 700 }}>{roomError.error || `${companyCopy.groupLabel} could not be created`}</p>
                  {roomError.detail && <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>{roomError.detail}</p>}
                  {roomError.hint && <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>{roomError.hint}</p>}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
