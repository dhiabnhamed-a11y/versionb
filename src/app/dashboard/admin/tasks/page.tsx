'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { formatDate, formatTimeAgo } from '@/lib/utils'
import {
  DELIVERABLE_TYPE_OPTIONS,
  getCompanyTypeCopy,
  getDeliverableTypeLabel,
  normalizeCompanyType,
} from '@/lib/company-types'
import { Plus, CheckSquare, Trash2, Clock, FolderKanban, User, Loader2, ListTodo, Link2 } from 'lucide-react'

interface TaskSubmission {
  id: string
  fileUrl: string
  fileName: string
  fileType: string
  note?: string | null
  createdAt: string
  user: { id: string; name: string }
}

interface Task {
  id: string
  title: string
  description?: string
  priority: string
  deliverableType?: string
  deadline?: string
  stage: string
  progress: number
  assignee?: { id: string; name: string; email: string }
  project: { id: string; title: string; room?: { id: string; name: string } | null }
  submissions: TaskSubmission[]
  activities: { id: string; action: string; createdAt: string; user: { name: string } }[]
}

interface Project {
  id: string
  title: string
}

interface Employee {
  id: string
  name: string
  email: string
}

const STAGES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']
const STAGE_LABELS: Record<string, string> = { TODO: 'To Do', IN_PROGRESS: 'In Progress', REVIEW: 'Review', DONE: 'Done' }
const STAGE_COLORS: Record<string, string> = {
  TODO: 'var(--text-muted)',
  IN_PROGRESS: '#0f766e',
  REVIEW: '#d97706',
  DONE: '#059669',
}

export default function AdminTasksPage() {
  const { data: session } = useSession()
  const companyType = normalizeCompanyType((session?.user as { companyType?: string | null } | undefined)?.companyType)
  const companyCopy = getCompanyTypeCopy(companyType)
  const isAgency = companyType === 'DIGITAL_AGENCY'

  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterStage, setFilterStage] = useState('ALL')
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    deliverableType: 'GENERAL',
    deadline: '',
    assigneeId: '',
    projectId: '',
  })
  const [saving, setSaving] = useState(false)

  async function fetchTasksPageData() {
    const [tasksResponse, projectsResponse, employeesResponse] = await Promise.all([
      fetch('/api/tasks').then((response) => response.json()),
      fetch('/api/projects').then((response) => response.json()),
      fetch('/api/employees').then((response) => response.json()),
    ])

    return {
      tasks: Array.isArray(tasksResponse) ? tasksResponse : [],
      projects: Array.isArray(projectsResponse) ? projectsResponse : [],
      employees: Array.isArray(employeesResponse) ? employeesResponse : [],
    }
  }

  useEffect(() => {
    let active = true

    const loadData = async () => {
      const data = await fetchTasksPageData()
      if (!active) return
      setTasks(data.tasks)
      setProjects(data.projects)
      setEmployees(data.employees)
      setLoading(false)
    }

    void loadData()

    return () => {
      active = false
    }
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.projectId) return
    setSaving(true)

    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setSaving(false)
    setShowModal(false)
    setForm({
      title: '',
      description: '',
      priority: 'MEDIUM',
      deliverableType: 'GENERAL',
      deadline: '',
      assigneeId: '',
      projectId: '',
    })
    const data = await fetchTasksPageData()
    setTasks(data.tasks)
    setProjects(data.projects)
    setEmployees(data.employees)
  }

  async function handleDelete(id: string) {
    if (!confirm(`Delete this ${companyCopy.taskLabel.toLowerCase()}?`)) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    const data = await fetchTasksPageData()
    setTasks(data.tasks)
    setProjects(data.projects)
    setEmployees(data.employees)
  }

  const filtered = filterStage === 'ALL' ? tasks : tasks.filter((task) => task.stage === filterStage)

  return (
    <div style={{ maxWidth: '1020px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-heading flex items-center gap-2.5">
            <CheckSquare size={24} strokeWidth={1.85} style={{ color: 'var(--accent)' }} /> {companyCopy.taskPluralLabel}
          </h1>
          <p className="page-sub">
            {isAgency ? `${tasks.length} briefs across all campaigns` : `${tasks.length} total across all projects`}
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <Plus size={15} /> New {companyCopy.taskLabel}
        </button>
      </div>

      <div className="mb-[18px] flex flex-wrap gap-2">
        {['ALL', ...STAGES].map((stage) => (
          <button
            key={stage}
            type="button"
            onClick={() => setFilterStage(stage)}
            className={`filter-chip ${filterStage === stage ? 'filter-chip-active' : ''}`}
          >
            {stage === 'ALL' ? 'All' : STAGE_LABELS[stage]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px' }} className="card">
          <ListTodo size={32} style={{ color: 'var(--text-muted)', opacity: 0.35, margin: '0 auto 12px', display: 'block' }} />
          <p style={{ color: 'var(--text-muted)', marginBottom: '12px', fontSize: '13px' }}>No {companyCopy.taskPluralLabel.toLowerCase()} found</p>
          <button onClick={() => setShowModal(true)} className="btn-primary" style={{ fontSize: '12px' }}>
            Create {companyCopy.taskLabel}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((task, index) => (
            <div key={task.id} className="card animate-fade-in" style={{ animationDelay: `${index * 30}ms`, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span className={`priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                    {isAgency && (
                      <span
                        className="rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
                        style={{ borderColor: 'rgba(124,58,237,0.18)', color: '#7c3aed', background: 'rgba(124,58,237,0.06)' }}
                      >
                        {getDeliverableTypeLabel(task.deliverableType)}
                      </span>
                    )}
                    <h3 style={{ fontSize: '14px', fontWeight: '600' }}>{task.title}</h3>
                  </div>
                  {task.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.5' }}>{task.description}</p>}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FolderKanban size={12} /> {task.project.title}
                    </span>
                    {task.project.room && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {task.project.room.name}
                      </span>
                    )}
                    {task.assignee && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} /> {task.assignee.name}
                      </span>
                    )}
                    {task.deadline && (
                      <span style={{ fontSize: '11px', color: new Date(task.deadline) < new Date() ? '#ef4444' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> {formatDate(task.deadline)}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: STAGE_COLORS[task.stage], fontWeight: '600', marginBottom: '4px' }}>{STAGE_LABELS[task.stage]}</div>
                    <div style={{ width: '80px' }}>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${task.progress}%` }} />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(task.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px', transition: 'color 0.2s', display: 'flex' }}
                    onMouseEnter={(event) => (event.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(event) => (event.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {task.submissions.length > 0 && (
                <div
                  style={{
                    marginTop: '10px',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--border)',
                    display: 'grid',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Uploaded deliverables
                  </div>
                  {task.submissions.map((submission) => (
                    <div
                      key={submission.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap',
                        background: 'var(--bg-elevated)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{submission.fileName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {submission.user.name} - {formatTimeAgo(submission.createdAt)}
                        </div>
                        {submission.note && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{submission.note}</div>}
                      </div>
                      <a
                        href={submission.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary"
                        style={{ textDecoration: 'none', fontSize: '11px', padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Link2 size={13} />
                        Open file
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {task.activities.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Clock size={11} />
                  <span>
                    {task.activities[0].user.name} - {task.activities[0].action}
                  </span>
                  <span style={{ marginLeft: 'auto' }}>{formatTimeAgo(task.activities[0].createdAt)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2 className="font-display mb-5 text-lg font-semibold tracking-tight">Create {companyCopy.taskLabel.toLowerCase()}</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  {companyCopy.projectLabel} *
                </label>
                <select className="input" value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })} required>
                  <option value="">Select...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Title *
                </label>
                <input className="input" placeholder={isAgency ? 'e.g. Homepage hero image' : 'Task title'} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Description
                </label>
                <textarea className="input" placeholder={isAgency ? 'Brief details, references, and expected output' : 'Details...'} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
              </div>

              {isAgency && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Deliverable type
                  </label>
                  <select className="input" value={form.deliverableType} onChange={(event) => setForm({ ...form, deliverableType: event.target.value })}>
                    {DELIVERABLE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Priority
                  </label>
                  <select className="input" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Deadline
                  </label>
                  <input className="input" type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Assign to
                </label>
                <select className="input" value={form.assigneeId} onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}>
                  <option value="">Unassigned</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ fontSize: '12px', padding: '8px 16px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ fontSize: '12px', padding: '8px 16px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {saving ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : null}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
