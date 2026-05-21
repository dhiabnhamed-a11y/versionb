'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { formatDate, formatTimeAgo } from '@/lib/utils'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { applyRealtimeEntityPatch, runOptimisticMutation, type RealtimeEntityPatch } from '@/lib/realtime-state'
import {
  DELIVERABLE_TYPE_OPTIONS,
  getCompanyTypeCopy,
  getDeliverableTypeLabel,
  isAgencyCompanyType,
  isEnterpriseOperationsCompanyType,
  normalizeCompanyType,
} from '@/lib/company-types'
import { Plus, CheckSquare, Trash2, Clock, FolderKanban, User, Loader2, ListTodo, Link2, Pencil, CheckCircle2, RotateCcw } from 'lucide-react'
import RichTextEditor from '@/components/ui/RichTextEditor'
import RichTextContent from '@/components/ui/RichTextContent'
import { MediaPlayer } from '@/components/media/MediaPlayer'
import { readJsonResponse } from '@/lib/read-json'

interface TaskSubmission {
  id: string
  fileUrl: string
  fileName: string
  fileType: string
  mediaType?: string | null
  fileSize?: number | null
  duration?: number | null
  thumbnailUrl?: string | null
  playbackUrl?: string | null
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
  enterpriseAssignedTeam?: { id: string; name: string; code: string } | null
  enterpriseDepartment?: { id: string; name: string; code: string } | null
  project: { id: string; title: string; room?: { id: string; name: string } | null }
  submissions: TaskSubmission[]
  activities: { id: string; action: string; createdAt: string; user: { name: string } }[]
}

interface EnterpriseTeamOption {
  id: string
  name: string
  code: string
  queueKey?: string
  department: { id: string; name: string; code: string }
  leader?: { id: string; name: string } | null
  members?: { user: { id: string; name: string } }[]
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
const TASK_REALTIME_EVENTS = ['task_created', 'task_updated', 'task_deleted', 'task_submission_created', 'project_created'] as const
const STAGE_LABELS: Record<string, string> = { TODO: 'To Do', IN_PROGRESS: 'In Progress', REVIEW: 'Review', DONE: 'Done' }
const STAGE_BADGE_CLASSES: Record<string, string> = {
  TODO: 'stage-badge stage-todo',
  IN_PROGRESS: 'stage-badge stage-in-progress',
  REVIEW: 'stage-badge stage-review',
  DONE: 'stage-badge stage-done',
}

export default function AdminTasksPage() {
  const { data: session } = useSession()
  const companyType = normalizeCompanyType((session?.user as { companyType?: string | null } | undefined)?.companyType)
  const companyCopy = getCompanyTypeCopy(companyType)
  const isAgency = isAgencyCompanyType(companyType)
  const supportsTeamAssignment = isEnterpriseOperationsCompanyType(companyType)

  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [enterpriseTeams, setEnterpriseTeams] = useState<EnterpriseTeamOption[]>([])
  const [assignTarget, setAssignTarget] = useState<'INDIVIDUAL' | 'TEAM'>('INDIVIDUAL')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [rejectingTask, setRejectingTask] = useState<Task | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [actionError, setActionError] = useState('')
  const [reviewSaving, setReviewSaving] = useState(false)
  const [filterStage, setFilterStage] = useState('ALL')
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    deliverableType: 'GENERAL',
    deadline: '',
    assigneeId: '',
    projectId: '',
    stage: 'TODO',
    enterpriseAssignedTeamId: '',
  })
  const [saving, setSaving] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploadingAttachments, setUploadingAttachments] = useState(false)
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null)

  const fetchTasksPageData = useCallback(async () => {
    const [tasksResponse, projectsResponse, employeesResponse, teamsResponse] = await Promise.all([
      fetch('/api/tasks', { cache: 'no-store' }),
      fetch('/api/projects', { cache: 'no-store' }),
      fetch('/api/employees', { cache: 'no-store' }),
      supportsTeamAssignment ? fetch('/api/enterprise/teams', { cache: 'no-store' }).catch(() => null) : Promise.resolve(null),
    ])

    const [tasksBody, projectsBody, employeesBody, teamsBody] = await Promise.all([
      readJsonResponse(tasksResponse, []),
      readJsonResponse(projectsResponse, []),
      readJsonResponse(employeesResponse, []),
      teamsResponse && teamsResponse.ok ? readJsonResponse(teamsResponse, []) : Promise.resolve([]),
    ])

    return {
      tasks: Array.isArray(tasksBody) ? tasksBody : [],
      projects: Array.isArray(projectsBody) ? projectsBody : [],
      employees: Array.isArray(employeesBody) ? employeesBody : [],
      teams: Array.isArray(teamsBody) ? teamsBody : [],
    }
  }, [supportsTeamAssignment])

  const reloadTasksPageData = useCallback(async () => {
    const data = await fetchTasksPageData()
    setTasks(data.tasks)
    setProjects(data.projects)
    setEmployees(data.employees)
    setEnterpriseTeams(data.teams)
    setLoading(false)
  }, [fetchTasksPageData])

  useEffect(() => {
    let active = true

    const loadData = async () => {
      if (!active) return
      await reloadTasksPageData()
    }

    void loadData()

    return () => {
      active = false
    }
  }, [reloadTasksPageData])

  useRealtimeSubscription(TASK_REALTIME_EVENTS, (eventName, payload) => {
    const eventPayload = payload && typeof payload === 'object' ? (payload as { realtimePatch?: RealtimeEntityPatch<Task>; task?: Task; taskId?: string }) : null

    if (eventName === 'task_deleted' && eventPayload?.taskId) {
      setTasks((current) => current.filter((task) => task.id !== eventPayload.taskId))
      return
    }

    if (eventPayload?.realtimePatch?.entityType === 'task') {
      setTasks((current) => applyRealtimeEntityPatch(current, eventPayload.realtimePatch as RealtimeEntityPatch<Task>))
      return
    }

    if ((eventName === 'task_created' || eventName === 'task_updated') && eventPayload?.task) {
      setTasks((current) => {
        const withoutExisting = current.filter((task) => task.id !== eventPayload.task?.id)
        return [eventPayload.task as Task, ...withoutExisting]
      })
      return
    }

    void reloadTasksPageData()
  })

  function resetTaskForm() {
    setForm({
      title: '',
      description: '',
      priority: 'MEDIUM',
      deliverableType: 'GENERAL',
      deadline: '',
      assigneeId: '',
      projectId: '',
      stage: 'TODO',
      enterpriseAssignedTeamId: '',
    })
    setAssignTarget('INDIVIDUAL')
    setPendingFiles([])
  }

  function openCreateTaskModal() {
    setEditingTask(null)
    resetTaskForm()
    setShowModal(true)
  }

  function openEditTaskModal(task: Task) {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      deliverableType: task.deliverableType ?? 'GENERAL',
      deadline: task.deadline ? task.deadline.slice(0, 10) : '',
      assigneeId: task.assignee?.id ?? '',
      projectId: task.project.id,
      stage: task.stage,
      enterpriseAssignedTeamId: task.enterpriseAssignedTeam?.id ?? '',
    })
    setAssignTarget(task.enterpriseAssignedTeam?.id ? 'TEAM' : 'INDIVIDUAL')
    setShowModal(true)
  }

  async function uploadPendingFiles(taskId: string) {
    if (pendingFiles.length === 0) return
    setUploadingAttachments(true)
    const formData = new FormData()
    for (const file of pendingFiles) {
      formData.append('file', file)
      try {
        await fetch(`/api/tasks/${taskId}/attachments`, { method: 'POST', body: formData })
      } catch (err) {
        console.error('Failed to upload attachment:', err)
      }
      formData.delete('file')
    }
    setPendingFiles([])
    setUploadingAttachments(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.projectId) return
    setSaving(true)

    const payload = supportsTeamAssignment
      ? assignTarget === 'TEAM'
        ? { ...form, assigneeId: null, enterpriseAssignedTeamId: form.enterpriseAssignedTeamId || null }
        : { ...form, enterpriseAssignedTeamId: null }
      : { ...form, enterpriseAssignedTeamId: undefined }

    const response = await fetch(editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks', {
      method: editingTask ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      const taskId = editingTask?.id ?? ((await response.json().catch(() => ({}))) as { id?: string }).id
      if (taskId && pendingFiles.length > 0) {
        await uploadPendingFiles(taskId)
      }
    }

    setSaving(false)
    setShowModal(false)
    setEditingTask(null)
    resetTaskForm()
    await reloadTasksPageData()
  }

  async function handleDelete(id: string) {
    if (!confirm(`Delete this ${companyCopy.taskLabel.toLowerCase()}?`)) return
    setActionError('')
    const previousTasks = tasks
    try {
      await runOptimisticMutation({
        apply: () => setTasks((current) => current.filter((task) => task.id !== id)),
        rollback: () => setTasks(previousTasks),
        commit: async () => {
          const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
          if (!response.ok) {
            const body = (await response.json().catch(() => ({}))) as { error?: string; detail?: string }
            throw new Error(body.error || `${companyCopy.taskLabel} could not be deleted.`)
          }
          return response.json().catch(() => ({ ok: true }))
        },
      })
    } catch (error) {
      setActionError(error instanceof Error ? error.message : `${companyCopy.taskLabel} could not be deleted.`)
    }
  }

  async function handleAcceptReview(task: Task) {
    setReviewSaving(true)
    const previousTasks = tasks
    try {
      await runOptimisticMutation({
        apply: () => setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, stage: 'DONE', progress: 100 } : item))),
        rollback: () => setTasks(previousTasks),
        commit: async () => {
          const response = await fetch(`/api/tasks/${task.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stage: 'DONE' }),
          })
          if (!response.ok) throw new Error('Review could not be accepted.')
          return response.json()
        },
      })
    } finally {
      setReviewSaving(false)
    }
  }

  function openRejectReviewModal(task: Task) {
    setRejectingTask(task)
    setReviewComment('')
    setReviewError('')
  }

  function stripHtml(html: string) {
    return html.replace(/<[^>]*>/g, '').trim()
  }

  async function handleRejectReview(e: React.FormEvent) {
    e.preventDefault()
    if (!rejectingTask) return

    const comment = reviewComment.trim()
    if (!stripHtml(comment)) {
      setReviewError('Add a comment so the employee knows what to repeat.')
      return
    }

    setReviewSaving(true)
    setReviewError('')
    const previousTasks = tasks
    try {
      await runOptimisticMutation({
        apply: () => setTasks((current) => current.map((item) => (item.id === rejectingTask.id ? { ...item, stage: 'IN_PROGRESS', progress: 50 } : item))),
        rollback: () => setTasks(previousTasks),
        commit: async () => {
          const response = await fetch(`/api/tasks/${rejectingTask.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stage: 'IN_PROGRESS', reviewComment: comment }),
          })
          if (!response.ok) throw new Error('Review could not be returned.')
          return response.json()
        },
      })
      setRejectingTask(null)
      setReviewComment('')
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'Review could not be returned.')
    } finally {
      setReviewSaving(false)
    }
  }

  const filtered = filterStage === 'ALL' ? tasks : tasks.filter((task) => task.stage === filterStage)

  return (
    <div className="dashboard-page" style={{ maxWidth: '1020px' }}>
      <div className="dashboard-header-row">
        <div>
          <h1 className="page-heading flex items-center gap-2.5">
            <CheckSquare size={24} strokeWidth={1.85} style={{ color: 'var(--accent)' }} /> {companyCopy.taskPluralLabel}
          </h1>
          <p className="page-sub">
            {isAgency ? `${tasks.length} briefs across all campaigns` : `${tasks.length} total across all projects`}
          </p>
        </div>
        <button onClick={openCreateTaskModal} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
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

      {actionError && (
        <div className="alert-banner alert-danger mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          {actionError}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px' }} className="card">
          <ListTodo size={32} style={{ color: 'var(--text-muted)', opacity: 0.35, margin: '0 auto 12px', display: 'block' }} />
          <p style={{ color: 'var(--text-muted)', marginBottom: '12px', fontSize: '13px' }}>No {companyCopy.taskPluralLabel.toLowerCase()} found</p>
          <button onClick={openCreateTaskModal} className="btn-primary" style={{ fontSize: '12px' }}>
            Create {companyCopy.taskLabel}
          </button>
        </div>
      ) : (
        <div className="dashboard-card-stack">
          {filtered.map((task, index) => (
            <div
              key={task.id}
              className={`card card-interactive animate-fade-in${task.stage === 'REVIEW' ? ' review-card' : ''}`}
              style={{
                animationDelay: `${index * 30}ms`,
                padding: '16px 18px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div className="dashboard-item-row">
                <div className="dashboard-item-main">
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
                    <h3 style={{ minWidth: 0, overflowWrap: 'anywhere', fontSize: '14px', fontWeight: '600' }}>{task.title}</h3>
                  </div>
                  {task.description && <RichTextContent html={task.description} className="" style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.5' }} />}
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
                    {task.enterpriseAssignedTeam && (
                      <span style={{ fontSize: '11px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <User size={12} /> Team · {task.enterpriseAssignedTeam.name}
                        {task.enterpriseDepartment ? ` (${task.enterpriseDepartment.name})` : ''}
                      </span>
                    )}
                    {task.deadline && (
                      <span style={{ fontSize: '11px', color: new Date(task.deadline) < new Date() ? '#ef4444' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> {formatDate(task.deadline)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="dashboard-item-side">
                  <div style={{ textAlign: 'right' }}>
                    <span className={STAGE_BADGE_CLASSES[task.stage]}>{STAGE_LABELS[task.stage]}</span>
                    <div style={{ width: '80px', marginTop: '6px' }}>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${task.progress}%` }} />
                      </div>
                    </div>
                  </div>
                  {task.stage === 'REVIEW' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAcceptReview(task)}
                        className="btn-success btn-sm"
                        disabled={reviewSaving}
                        style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <CheckCircle2 size={13} />
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => openRejectReviewModal(task)}
                        className="btn-secondary btn-sm"
                        disabled={reviewSaving}
                        style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <RotateCcw size={13} />
                        Repeat
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => openEditTaskModal(task)}
                    className="btn-secondary btn-sm"
                    style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Pencil size={13} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="btn-danger btn-sm"
                    style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Trash2 size={15} />
                    Delete
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
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr)',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        background: 'var(--bg-elevated)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        minWidth: 0,
                      }}
                    >
                      {isAgency && submission.mediaType && (
                        <div style={{ minWidth: 0, width: '100%' }}>
                          <MediaPlayer
                            media={{
                              id: submission.id,
                              url: submission.fileUrl,
                              playbackUrl: submission.playbackUrl,
                              thumbnailUrl: submission.thumbnailUrl,
                              type: submission.mediaType,
                              mimeType: submission.fileType,
                              fileName: submission.fileName,
                              fileSize: submission.fileSize,
                              duration: submission.duration,
                            }}
                          />
                </div>
              )}

              <div style={{ marginTop: '8px' }}>
                <input
                  id={`attach-${task.id}`}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || [])
                    if (files.length === 0) return
                    setUploadingTaskId(task.id)
                    for (const file of files) {
                      const fd = new FormData()
                      fd.append('file', file)
                      try {
                        await fetch(`/api/tasks/${task.id}/attachments`, { method: 'POST', body: fd })
                      } catch (err) {
                        console.error('Upload failed:', err)
                      }
                    }
                    setUploadingTaskId(null)
                    e.target.value = ''
                    await reloadTasksPageData()
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  disabled={uploadingTaskId === task.id}
                  onClick={() => document.getElementById(`attach-${task.id}`)?.click()}
                >
                  {uploadingTaskId === task.id ? (
                    <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} />
                  ) : (
                    <Link2 size={13} />
                  )}
                  {uploadingTaskId === task.id ? 'Uploading...' : 'Attach file'}
                </button>
              </div>
                      <div
                        style={{
                          display: 'flex',
                          minWidth: 0,
                          width: '100%',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                          <div
                            style={{
                              overflowWrap: 'anywhere',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {submission.fileName}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {submission.user.name} - {formatTimeAgo(submission.createdAt)}
                          </div>
                          {submission.note && (
                            <div style={{ overflowWrap: 'anywhere', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              {submission.note}
                            </div>
                          )}
                        </div>
                        <a
                          href={submission.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary"
                          style={{
                            flex: '0 0 auto',
                            textDecoration: 'none',
                            fontSize: '11px',
                            padding: '6px 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Link2 size={13} />
                          Open file
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {task.activities.length > 0 && (
                <div
                  style={{
                    marginTop: '10px',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--border)',
                    fontSize: '11px',
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'center',
                  }}
                  className={task.activities[0].action.startsWith('Review rejected:') ? 'rejected-banner' : ''}
                >
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
            <h2 className="font-display mb-5 text-lg font-semibold tracking-tight">
              {editingTask ? `Edit ${companyCopy.taskLabel.toLowerCase()}` : `Create ${companyCopy.taskLabel.toLowerCase()}`}
            </h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                <RichTextEditor value={form.description} onChange={(html) => setForm({ ...form, description: html })} placeholder={isAgency ? 'Brief details, references, and expected output' : 'Details...'} minHeight={80} maxHeight={300} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Attachments
                </label>
                <div
                  style={{
                    border: '2px dashed var(--border)',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                    background: 'var(--bg-elevated)',
                  }}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.currentTarget.style.borderColor = 'var(--border)'
                    const files = Array.from(e.dataTransfer.files)
                    setPendingFiles((prev) => [...prev, ...files])
                  }}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      setPendingFiles((prev) => [...prev, ...files])
                      e.target.value = ''
                    }}
                  />
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Drop files here or click to browse
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.6 }}>
                    Images, PDFs, documents, spreadsheets — up to 50MB each
                  </div>
                </div>
                {pendingFiles.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {pendingFiles.map((file, i) => (
                      <div
                        key={`${file.name}-${i}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '6px 10px',
                          background: 'var(--bg-elevated)',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {file.name}
                        </span>
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                          {(file.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                          type="button"
                          onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '2px',
                            fontSize: '14px',
                            lineHeight: 1,
                            flexShrink: 0,
                          }}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {uploadingAttachments && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '4px 0' }}>
                        Uploading attachments...
                      </div>
                    )}
                  </div>
                )}
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

              <div className="form-split">
                {editingTask && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Stage
                    </label>
                    <select className="input" value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })}>
                      {STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {STAGE_LABELS[stage]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
                {supportsTeamAssignment && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setAssignTarget('INDIVIDUAL')}
                      className={assignTarget === 'INDIVIDUAL' ? 'btn-primary' : 'btn-secondary'}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      Individual
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignTarget('TEAM')}
                      className={assignTarget === 'TEAM' ? 'btn-primary' : 'btn-secondary'}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      Team
                    </button>
                  </div>
                )}
                {supportsTeamAssignment && assignTarget === 'TEAM' ? (
                  <select
                    className="input"
                    value={form.enterpriseAssignedTeamId}
                    onChange={(event) => setForm({ ...form, enterpriseAssignedTeamId: event.target.value })}
                  >
                    <option value="">Select a team</option>
                    {Object.entries(
                      enterpriseTeams.reduce<Record<string, EnterpriseTeamOption[]>>((acc, team) => {
                        const key = team.department?.name ?? 'Unassigned department'
                        acc[key] = acc[key] || []
                        acc[key].push(team)
                        return acc
                      }, {})
                    ).map(([departmentName, teams]) => (
                      <optgroup key={departmentName} label={departmentName}>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                            {team.queueKey ? ` · ${team.queueKey}` : ''}
                            {team.members?.length ? ` (${team.members.length} members)` : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                ) : (
                  <select className="input" value={form.assigneeId} onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}>
                    <option value="">Unassigned</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="modal-actions" style={{ marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingTask(null)
                  }}
                  className="btn-secondary"
                  style={{ fontSize: '12px', padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ fontSize: '12px', padding: '8px 16px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {saving ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : null}
                  {editingTask ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rejectingTask && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setRejectingTask(null)}>
          <div className="modal">
            <h2 className="font-display mb-2 text-lg font-semibold tracking-tight">Send task back</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '18px' }}>
              Add a clear note for {rejectingTask.assignee?.name ?? 'the employee'} before moving &quot;{rejectingTask.title}&quot; back to progress.
            </p>

            <form onSubmit={handleRejectReview} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Comment *
                </label>
                <RichTextEditor value={reviewComment} onChange={setReviewComment} placeholder="Explain what needs to be fixed or repeated..." minHeight={80} maxHeight={250} />
              </div>

              {reviewError && (
                <div className="alert-banner alert-danger">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  {reviewError}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" onClick={() => setRejectingTask(null)} className="btn-secondary" style={{ fontSize: '12px', padding: '8px 16px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={reviewSaving} style={{ fontSize: '12px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {reviewSaving ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  Send back to progress
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
