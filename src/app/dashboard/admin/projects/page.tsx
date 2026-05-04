'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Camera, ChevronRight, FolderKanban, Plus, Loader2, User, Building2, Tags, UsersRound, Pencil, Trash2 } from 'lucide-react'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'

import { getCompanyTypeCopy, normalizeCompanyType } from '@/lib/company-types'

interface Project {
  id: string
  title: string
  description?: string
  roomId?: string | null
  room?: { id: string; name: string } | null
  categoryId?: string | null
  category?: { id: string; name: string; description?: string | null } | null
  clientName?: string | null
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

interface ProjectCategory {
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

const PROJECT_REALTIME_EVENTS = [
  'project_created',
  'project_updated',
  'project_deleted',
  'room_created',
  'project_category_created',
  'task_created',
  'task_updated',
  'task_deleted',
] as const

export default function ProjectsPage() {
  const { data: session } = useSession()
  const companyType = normalizeCompanyType((session?.user as { companyType?: string | null } | undefined)?.companyType)
  const companyCopy = getCompanyTypeCopy(companyType)
  const isIndustry = companyType === 'INDUSTRY'
  const isAgency = companyType === 'DIGITAL_AGENCY'

  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [categories, setCategories] = useState<ProjectCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<ApiFailure | null>(null)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    roomId: '',
    categoryId: '',
    clientName: '',
    managerId: '',
    hasCamera: false,
    cameraType: 'device' as 'device' | 'external',
  })
  const [roomForm, setRoomForm] = useState({
    name: '',
    description: '',
  })
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)
  const [savingRoom, setSavingRoom] = useState(false)
  const [savingCategory, setSavingCategory] = useState(false)
  const [formError, setFormError] = useState<ApiFailure | null>(null)
  const [roomError, setRoomError] = useState<ApiFailure | null>(null)
  const [categoryError, setCategoryError] = useState<ApiFailure | null>(null)

  const fetchProjectsData = useCallback(async () => {
    const [projectResponse, employeeResponse, roomResponse, categoryResponse] = await Promise.all([
      fetch('/api/projects', { cache: 'no-store' }),
      fetch('/api/employees', { cache: 'no-store' }),
      fetch('/api/rooms', { cache: 'no-store' }),
      fetch('/api/project-categories', { cache: 'no-store' }),
    ])

    const [projectBody, employeeBody, roomBody, categoryBody] = await Promise.all([
      projectResponse.json(),
      employeeResponse.json(),
      roomResponse.json(),
      categoryResponse.json(),
    ])

    return {
      ok: projectResponse.ok,
      projects: Array.isArray(projectBody) ? projectBody : [],
      employees: Array.isArray(employeeBody) ? employeeBody : [],
      rooms: Array.isArray(roomBody) ? roomBody : [],
      categories: Array.isArray(categoryBody) ? categoryBody : [],
      projectError: Array.isArray(projectBody) ? null : ((projectBody as ApiFailure) ?? null),
    }
  }, [])

  const reload = useCallback(async () => {
    const data = await fetchProjectsData()
    setProjects(data.projects)
    setEmployees(data.employees)
    setRooms(data.rooms)
    setCategories(data.categories)
    setLoadError(data.ok ? null : data.projectError)
  }, [fetchProjectsData])

  useEffect(() => {
    let active = true

    const loadProjects = async () => {
      const data = await fetchProjectsData()
      if (!active) return
      setProjects(data.projects)
      setEmployees(data.employees)
      setRooms(data.rooms)
      setCategories(data.categories)
      setLoadError(data.ok ? null : data.projectError)
      setLoading(false)
    }

    void loadProjects()

    return () => {
      active = false
    }
  }, [fetchProjectsData])

  useRealtimeSubscription(PROJECT_REALTIME_EVENTS, () => {
    void reload()
  }, 350)

  function resetProjectForm() {
    setForm({
      title: '',
      description: '',
      roomId: '',
      categoryId: '',
      clientName: '',
      managerId: '',
      hasCamera: false,
      cameraType: 'device',
    })
  }

  function openCreateProjectModal() {
    setEditingProject(null)
    resetProjectForm()
    setFormError(null)
    setShowProjectModal(true)
  }

  function openEditProjectModal(project: Project) {
    setEditingProject(project)
    setForm({
      title: project.title,
      description: project.description ?? '',
      roomId: project.roomId ?? '',
      categoryId: project.categoryId ?? '',
      clientName: project.clientName ?? '',
      managerId: project.manager?.id ?? '',
      hasCamera: Boolean(project.hasCamera),
      cameraType: project.cameraType ?? 'device',
    })
    setFormError(null)
    setShowProjectModal(true)
  }

  async function handleSaveProject(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSaving(true)

    const response = await fetch(editingProject ? `/api/projects/${editingProject.id}` : '/api/projects', {
      method: editingProject ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description || undefined,
        roomId: isIndustry ? form.roomId || undefined : undefined,
        categoryId: isAgency ? form.categoryId || undefined : undefined,
        clientName: isAgency ? form.clientName || undefined : undefined,
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
    setEditingProject(null)
    resetProjectForm()
    await reload()
  }

  async function handleDeleteProject(project: Project) {
    if (!confirm(`Delete "${project.title}" and all of its ${companyCopy.taskPluralLabel.toLowerCase()}?`)) return
    setDeletingProjectId(project.id)
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    setDeletingProjectId(null)
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

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    setCategoryError(null)
    setSavingCategory(true)

    const response = await fetch('/api/project-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: categoryForm.name,
        description: categoryForm.description || undefined,
      }),
    })

    const body = (await response.json()) as ProjectCategory | ApiFailure
    setSavingCategory(false)

    if (!response.ok) {
      setCategoryError(body as ApiFailure)
      return
    }

    setShowCategoryModal(false)
    setCategoryForm({ name: '', description: '' })
    await reload()
  }

  const groupedRooms = rooms.map((room) => ({
    ...room,
    projects: projects.filter((project) => project.roomId === room.id),
  }))
  const unassignedProjects = projects.filter((project) => !project.roomId)
  const groupedCategories = categories.map((category) => ({
    ...category,
    projects: projects.filter((project) => project.categoryId === category.id),
  }))
  const uncategorizedProjects = projects.filter((project) => !project.categoryId)

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
        {isAgency && project.category && (
          <div
            className="mb-2 inline-flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ borderColor: 'rgba(124,58,237,0.18)', color: '#7c3aed', background: 'rgba(124,58,237,0.06)' }}
          >
            <Tags size={11} />
            {project.category.name}
          </div>
        )}
        {isAgency && project.clientName && (
          <div
            className="mb-2 inline-flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ borderColor: 'rgba(19,141,136,0.18)', color: 'var(--accent)', background: 'var(--accent-subtle)' }}
          >
            <UsersRound size={11} />
            {project.clientName}
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
            className="mt-4 flex items-center justify-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] py-2.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Open {companyCopy.projectLabel.toLowerCase()}
            <ChevronRight size={14} />
          </Link>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => openEditProjectModal(project)}
              className="btn-secondary btn-sm"
              style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              type="button"
              onClick={() => handleDeleteProject(project)}
              className="btn-danger btn-sm"
              disabled={deletingProjectId === project.id}
              style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {deletingProjectId === project.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Delete
            </button>
          </div>
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
                ? `${categories.length} categories, ${projects.length} client campaigns`
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
          {isAgency && (
            <button
              onClick={() => {
                setCategoryError(null)
                setShowCategoryModal(true)
              }}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
            >
              <Tags size={15} /> New category
            </button>
          )}
          <button
            onClick={openCreateProjectModal}
            className="btn-primary"
            disabled={(isIndustry && rooms.length === 0) || (isAgency && categories.length === 0)}
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

      {isAgency && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">Client categories</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                Group each client campaign by service, market, or account type before adding briefs and deliverables.
              </p>
            </div>
          </div>

          {categories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Create your first category before adding client campaigns.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {categories.map((category) => (
                <div key={category.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    <Tags size={14} style={{ color: 'var(--accent)' }} />
                    {category.name}
                  </div>
                  {category.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>{category.description}</p>}
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '10px' }}>
                    {category.projectCount} {companyCopy.projectPluralLabel.toLowerCase()}
                  </div>
                </div>
              ))}
            </div>
          )}
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
          <button
            onClick={openCreateProjectModal}
            className="btn-primary"
            style={{ fontSize: '12px' }}
            disabled={(isIndustry && rooms.length === 0) || (isAgency && categories.length === 0)}
          >
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
      ) : isAgency ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {groupedCategories.map((category) => (
            <section key={category.id}>
              <div style={{ marginBottom: '10px' }}>
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <Tags size={14} style={{ color: 'var(--accent)' }} />
                  {category.name}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  {category.projects.length} {companyCopy.projectPluralLabel.toLowerCase()}
                </div>
              </div>
              {category.projects.length === 0 ? (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--text-muted)]">
                  No client campaigns in this category yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {category.projects.map((project, index) => renderProjectCard(project, index))}
                </div>
              )}
            </section>
          ))}

          {uncategorizedProjects.length > 0 && (
            <section>
              <div style={{ marginBottom: '10px' }}>
                <div className="text-sm font-semibold text-[var(--text-primary)]">Uncategorized campaigns</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  {uncategorizedProjects.length} {companyCopy.projectPluralLabel.toLowerCase()}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {uncategorizedProjects.map((project, index) => renderProjectCard(project, index))}
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
            <h2 className="font-display mb-5 text-lg font-semibold tracking-tight">
              {editingProject ? `Edit ${companyCopy.projectLabel.toLowerCase()}` : `Create ${companyCopy.projectLabel.toLowerCase()}`}
            </h2>
            <form onSubmit={handleSaveProject} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

              {isAgency && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Category *
                    </label>
                    <select className="input" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required>
                      <option value="">Select a category...</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Client name
                    </label>
                    <input
                      className="input"
                      placeholder="e.g. Northstar Studio"
                      value={form.clientName}
                      onChange={(event) => setForm({ ...form, clientName: event.target.value })}
                    />
                  </div>
                </>
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
                <button
                  type="button"
                  onClick={() => {
                    setShowProjectModal(false)
                    setEditingProject(null)
                  }}
                  className="btn-secondary"
                  style={{ fontSize: '12px', padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ fontSize: '12px', padding: '8px 16px' }}>
                  {saving ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      {editingProject ? 'Saving...' : 'Creating...'}
                    </span>
                  ) : (
                    editingProject ? `Save ${companyCopy.projectLabel}` : `Create ${companyCopy.projectLabel}`
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

      {showCategoryModal && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setShowCategoryModal(false)}>
          <div className="modal">
            <h2 className="font-display mb-5 text-lg font-semibold tracking-tight">Create client category</h2>
            <form onSubmit={handleCreateCategory} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Name *
                </label>
                <input
                  className="input"
                  placeholder="e.g. E-commerce clients"
                  value={categoryForm.name}
                  onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Description
                </label>
                <textarea
                  className="input"
                  placeholder="Which clients or services belong here?"
                  value={categoryForm.description}
                  onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })}
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowCategoryModal(false)} className="btn-secondary" style={{ fontSize: '12px', padding: '8px 16px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={savingCategory} style={{ fontSize: '12px', padding: '8px 16px' }}>
                  {savingCategory ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    'Create category'
                  )}
                </button>
              </div>

              {categoryError && (
                <div style={{ borderRadius: '8px', border: '1px solid rgba(220, 38, 38, 0.18)', background: 'rgba(220, 38, 38, 0.05)', padding: '10px 12px' }}>
                  <p style={{ color: '#b91c1c', fontSize: '12px', fontWeight: 700 }}>{categoryError.error || 'Category could not be created'}</p>
                  {categoryError.detail && <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>{categoryError.detail}</p>}
                  {categoryError.hint && <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>{categoryError.hint}</p>}
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
