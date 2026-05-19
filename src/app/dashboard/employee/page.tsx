'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { formatDate, formatTimeAgo } from '@/lib/utils'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { getCompanyTypeCopy, getDeliverableTypeLabel, isAgencyCompanyType, normalizeCompanyType } from '@/lib/company-types'
import { ListTodo, Clock, FolderKanban, AlertTriangle, ArrowRight, CheckCircle2, Loader2, Link2, Upload } from 'lucide-react'
import { MediaPlayer } from '@/components/media/MediaPlayer'

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
  project: { id: string; title: string; room?: { id: string; name: string } | null }
  submissions: TaskSubmission[]
  activities: { action: string; createdAt: string; user: { name: string } }[]
}

const EMPLOYEE_FLOW = ['TODO', 'IN_PROGRESS', 'REVIEW']
const TASK_REALTIME_EVENTS = ['task_created', 'task_updated', 'task_deleted', 'task_submission_created'] as const
const STAGE_LABELS: Record<string, string> = { TODO: 'To Do', IN_PROGRESS: 'In Progress', REVIEW: 'Review', DONE: 'Done' }
const STAGE_BADGE_CLASSES: Record<string, string> = {
  TODO: 'stage-badge stage-todo',
  IN_PROGRESS: 'stage-badge stage-in-progress',
  REVIEW: 'stage-badge stage-review',
  DONE: 'stage-badge stage-done',
}

export default function EmployeeDashboard() {
  const { data: session } = useSession()
  const companyType = normalizeCompanyType((session?.user as { companyType?: string | null } | undefined)?.companyType)
  const companyCopy = getCompanyTypeCopy(companyType)
  const isAgency = isAgencyCompanyType(companyType)

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [uploadTask, setUploadTask] = useState<Task | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState('')

  const fetchTasks = useCallback(async () => {
    const data = await fetch('/api/tasks', { cache: 'no-store' }).then((response) => response.json())
    return Array.isArray(data) ? data : []
  }, [])

  const reloadTasks = useCallback(async () => {
    setTasks(await fetchTasks())
    setLoading(false)
  }, [fetchTasks])

  useEffect(() => {
    let active = true

    void (async () => {
      const nextTasks = await fetchTasks()
      if (!active) return
      setTasks(nextTasks)
      setLoading(false)
    })()

    return () => {
      active = false
    }
  }, [fetchTasks])

  useRealtimeSubscription(TASK_REALTIME_EVENTS, () => {
    void reloadTasks()
  })

  async function advanceStage(task: Task) {
    const index = EMPLOYEE_FLOW.indexOf(task.stage)
    if (index < 0 || index >= EMPLOYEE_FLOW.length - 1) return
    setUpdating(task.id)
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: EMPLOYEE_FLOW[index + 1] }),
    })
    setUpdating(null)
    await reloadTasks()
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadTask || !uploadFile) {
      setUploadError('Choose a file before uploading.')
      return
    }

    setUploading(true)
    setUploadError('')

    const formData = new FormData()
    formData.append('file', uploadFile)
    formData.append('note', uploadNote)

    const response = await fetch(`/api/tasks/${uploadTask.id}/submissions`, {
      method: 'POST',
      body: formData,
    })

    const data = (await response.json()) as { error?: string }
    setUploading(false)

    if (!response.ok) {
      setUploadError(data.error || 'Upload failed.')
      return
    }

    setUploadTask(null)
    setUploadFile(null)
    setUploadNote('')
    await reloadTasks()
  }

  const todo = tasks.filter((task) => task.stage === 'TODO')
  const inProgress = tasks.filter((task) => task.stage === 'IN_PROGRESS')
  const review = tasks.filter((task) => task.stage === 'REVIEW')
  const done = tasks.filter((task) => task.stage === 'DONE')
  const overdue = tasks.filter((task) => task.stage !== 'DONE' && task.deadline && new Date(task.deadline) < new Date())

  const statCards = [
    { label: 'To Do', count: todo.length, color: '#64748b' },
    { label: 'In Progress', count: inProgress.length, color: '#0f766e' },
    { label: 'Review', count: review.length, color: '#d97706' },
    { label: 'Done', count: done.length, color: '#059669' },
  ]

  return (
    <div className="dashboard-page" style={{ maxWidth: '860px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-heading flex items-center gap-2.5">
          <ListTodo size={24} strokeWidth={1.85} style={{ color: 'var(--accent)' }} /> {isAgency ? 'My briefs' : 'My tasks'}
        </h1>
        <p className="page-sub">
          {isAgency
            ? `${tasks.length} assigned briefs - upload finished work directly for review`
            : `${tasks.length} assigned - ${done.length} completed${overdue.length > 0 ? ` - ${overdue.length} overdue` : ''}`}
        </p>
      </div>

      <div className="dashboard-stat-grid dashboard-stat-grid-compact">
        {statCards.map((card) => (
          <div key={card.label} className="stat-card" style={{ textAlign: 'center', padding: '14px' }}>
            <div style={{ fontSize: '24px', fontWeight: '800', color: card.color, lineHeight: 1, letterSpacing: '-0.02em' }}>{card.count}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {overdue.length > 0 && (
        <div className="alert-banner alert-danger" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={16} />
          <div>
            <strong>{overdue.length} overdue {companyCopy.taskPluralLabel.toLowerCase()}</strong>
            <span style={{ marginLeft: '6px', fontWeight: 500, opacity: 0.85 }}>— update as soon as possible</span>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : tasks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <ListTodo size={32} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 10px', display: 'block' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No {companyCopy.taskPluralLabel.toLowerCase()} assigned yet</p>
        </div>
      ) : (
        <div className="dashboard-card-stack">
          {tasks.map((task, index) => {
            const isOverdue = task.stage !== 'DONE' && task.deadline && new Date(task.deadline) < new Date()
            const nextIndex = EMPLOYEE_FLOW.indexOf(task.stage) + 1
            const canAdvance = task.stage !== 'REVIEW' && task.stage !== 'DONE' && nextIndex > 0 && nextIndex < EMPLOYEE_FLOW.length
            const latestActivity = task.activities[0]
            const latestRejected = latestActivity?.action.startsWith('Review rejected:')

            return (
              <div key={task.id} className="card card-interactive animate-fade-in" style={{ animationDelay: `${index * 40}ms`, border: isOverdue ? '1px solid var(--danger-border)' : undefined }}>
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
                      {isOverdue && (
                        <span className="overdue-tag">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    {task.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.5' }}>{task.description}</p>}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FolderKanban size={12} /> {task.project.title}
                      </span>
                      {task.project.room && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{task.project.room.name}</span>}
                      {task.deadline && (
                        <span style={{ fontSize: '11px', color: isOverdue ? '#ef4444' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> {formatDate(task.deadline)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="dashboard-item-side">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={STAGE_BADGE_CLASSES[task.stage]}>{STAGE_LABELS[task.stage]}</span>
                    </div>
                    {canAdvance && (
                      <button onClick={() => advanceStage(task)} disabled={updating === task.id} className="btn-primary" style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {updating === task.id ? <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> : <ArrowRight size={13} />}
                        {task.stage === 'TODO' ? 'Start progress' : 'Send to review'}
                      </button>
                    )}
                    {task.stage === 'REVIEW' && (
                      <span style={{ fontSize: '11px', color: '#d97706', fontWeight: '600' }}>
                        Waiting admin review
                      </span>
                    )}
                    {task.stage === 'DONE' && (
                      <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={13} /> Complete
                      </span>
                    )}
                    {isAgency && (
                      <button
                        type="button"
                        onClick={() => {
                          setUploadTask(task)
                          setUploadError('')
                          setUploadFile(null)
                          setUploadNote('')
                        }}
                        className="btn-secondary"
                        style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Upload size={13} />
                        Upload work
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                    <span>Progress</span>
                    <span>{task.progress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${task.progress}%` }} />
                  </div>
                </div>

                {task.submissions.length > 0 && (
                  <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
                    {task.submissions.map((submission) => (
                      <div
                        key={submission.id}
                        className="grid min-w-0 gap-3 rounded-[8px] bg-[var(--bg-elevated)] px-3 py-2.5"
                      >
                        {isAgency && submission.mediaType && (
                          <div className="min-w-0">
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
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0 flex-[1_1_260px]">
                            <div style={{ overflowWrap: 'anywhere', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {submission.fileName}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Uploaded {formatTimeAgo(submission.createdAt)}
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
                            className="btn-secondary shrink-0 whitespace-nowrap"
                            style={{ textDecoration: 'none', fontSize: '11px', padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Link2 size={13} />
                            Open file
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {latestActivity && (
                  <div
                    className={latestRejected ? 'rejected-banner' : ''}
                    style={{
                      marginTop: '10px',
                      fontSize: '11px',
                      color: latestRejected ? undefined : 'var(--text-muted)',
                      padding: latestRejected ? undefined : 0,
                      display: 'flex',
                      gap: '6px',
                      alignItems: 'center',
                    }}
                  >
                    <Clock size={11} /> {latestActivity.action} - {formatTimeAgo(latestActivity.createdAt)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {uploadTask && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setUploadTask(null)}>
          <div className="modal">
            <h2 className="font-display mb-2 text-lg font-semibold tracking-tight">Upload finished work</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '18px' }}>
              {uploadTask.title} - {getDeliverableTypeLabel(uploadTask.deliverableType)}
            </p>
            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  File *
                </label>
                <input
                  className="input"
                  type="file"
                  accept={isAgency ? 'image/*,video/*,audio/*' : undefined}
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Note
                </label>
                <textarea
                  className="input"
                  placeholder="What should your manager know about this upload?"
                  value={uploadNote}
                  onChange={(event) => setUploadNote(event.target.value)}
                  rows={3}
                />
              </div>

              {uploadError && (
                <div className="alert-banner alert-danger">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  {uploadError}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" onClick={() => setUploadTask(null)} className="btn-secondary" style={{ fontSize: '12px', padding: '8px 16px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={uploading} style={{ fontSize: '12px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Send to boss
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
