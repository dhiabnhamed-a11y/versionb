'use client'

import { useEffect, useState } from 'react'
import { formatDate, formatTimeAgo } from '@/lib/utils'
import { ListTodo, Clock, FolderKanban, AlertTriangle, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'

interface Task {
  id: string; title: string; description?: string; priority: string
  deadline?: string; stage: string; progress: number
  project: { id: string; title: string }
  activities: { action: string; createdAt: string; user: { name: string } }[]
}

const STAGES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']
const STAGE_LABELS: Record<string, string> = { TODO: 'To Do', IN_PROGRESS: 'In Progress', REVIEW: 'Review', DONE: 'Done' }
const STAGE_COLORS: Record<string, string> = { TODO: '#505a70', IN_PROGRESS: '#3b82f6', REVIEW: '#f59e0b', DONE: '#10b981' }

export default function EmployeeDashboard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  async function load() { const d = await fetch('/api/tasks').then(r => r.json()); setTasks(Array.isArray(d) ? d : []); setLoading(false) }
   
   
  useEffect(() => { load() }, [])

  async function advanceStage(task: Task) {
    const idx = STAGES.indexOf(task.stage); if (idx >= STAGES.length - 1) return
    setUpdating(task.id)
    await fetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: STAGES[idx + 1] }) })
    setUpdating(null); load()
  }

  const todo = tasks.filter(t => t.stage === 'TODO')
  const inProgress = tasks.filter(t => t.stage === 'IN_PROGRESS')
  const review = tasks.filter(t => t.stage === 'REVIEW')
  const done = tasks.filter(t => t.stage === 'DONE')
  const overdue = tasks.filter(t => t.stage !== 'DONE' && t.deadline && new Date(t.deadline) < new Date())

  const statCards = [
    { label: 'To Do', count: todo.length, color: '#505a70' },
    { label: 'In Progress', count: inProgress.length, color: '#3b82f6' },
    { label: 'Review', count: review.length, color: '#f59e0b' },
    { label: 'Done', count: done.length, color: '#10b981' },
  ]

  return (
    <div style={{ maxWidth: '820px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '-0.02em' }}>
          <ListTodo size={22} style={{ color: 'var(--accent)' }} /> My Tasks
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          {tasks.length} assigned · {done.length} completed{overdue.length > 0 && <span style={{ color: '#ef4444' }}> · {overdue.length} overdue</span>}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
        {statCards.map(s => (
          <div key={s.label} className="stat-card" style={{ textAlign: 'center', padding: '14px' }}>
            <div style={{ fontSize: '24px', fontWeight: '800', color: s.color, lineHeight: 1, letterSpacing: '-0.02em' }}>{s.count}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {overdue.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
          <div><span style={{ fontSize: '13px', fontWeight: '600', color: '#f87171' }}>{overdue.length} overdue task{overdue.length > 1 ? 's' : ''}</span><span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>— update as soon as possible</span></div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : tasks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <ListTodo size={32} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 10px', display: 'block' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No tasks assigned yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {tasks.map((task, i) => {
            const isOverdue = task.stage !== 'DONE' && task.deadline && new Date(task.deadline) < new Date()
            const nextIdx = STAGES.indexOf(task.stage) + 1
            const canAdvance = nextIdx < STAGES.length

            return (
              <div key={task.id} className="card animate-fade-in" style={{ animationDelay: `${i * 40}ms`, border: isOverdue ? '1px solid rgba(239,68,68,0.2)' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span className={`priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                      <h3 style={{ fontSize: '14px', fontWeight: '600' }}>{task.title}</h3>
                      {isOverdue && <span style={{ fontSize: '10px', color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', padding: '1px 6px', borderRadius: '3px', fontWeight: '700' }}>OVERDUE</span>}
                    </div>
                    {task.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.5' }}>{task.description}</p>}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><FolderKanban size={12} /> {task.project.title}</span>
                      {task.deadline && <span style={{ fontSize: '11px', color: isOverdue ? '#ef4444' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {formatDate(task.deadline)}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-elevated)', borderRadius: '6px', padding: '4px 10px', border: `1px solid ${STAGE_COLORS[task.stage]}20` }}>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: STAGE_COLORS[task.stage] }}>{STAGE_LABELS[task.stage]}</span>
                    </div>
                    {canAdvance && (
                      <button onClick={() => advanceStage(task)} disabled={updating === task.id} className="btn-primary" style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {updating === task.id ? <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> : <ArrowRight size={13} />}
                        {STAGE_LABELS[STAGES[STAGES.indexOf(task.stage) + 1]]}
                      </button>
                    )}
                    {task.stage === 'DONE' && <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={13} /> Complete</span>}
                  </div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}><span>Progress</span><span>{task.progress}%</span></div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${task.progress}%` }} /></div>
                </div>

                {task.activities.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <Clock size={11} /> {task.activities[0].action} · {formatTimeAgo(task.activities[0].createdAt)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
