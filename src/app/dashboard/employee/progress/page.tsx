'use client'

import { useEffect, useState } from 'react'
import { BarChart3, FolderKanban, Trophy, Zap, Target } from 'lucide-react'

interface Task {
  id: string; title: string; priority: string; stage: string; progress: number
  deadline?: string; project: { title: string }
}

export default function EmployeeProgressPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tasks').then(r => r.json()).then(d => { setTasks(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  const total = tasks.length
  const done = tasks.filter(t => t.stage === 'DONE').length
  const overall = total ? Math.round((done / total) * 100) : 0

  const byProject: Record<string, Task[]> = {}
  tasks.forEach(t => { const key = t.project.title; if (!byProject[key]) byProject[key] = []; byProject[key].push(t) })

  return (
    <div style={{ maxWidth: '720px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-heading flex items-center gap-2.5">
          <BarChart3 size={24} strokeWidth={1.85} style={{ color: 'var(--accent)' }} /> My progress
        </h1>
        <p className="page-sub">How you&apos;re moving work across projects</p>
      </div>

      {/* Overall score */}
      <div
        className="card"
        style={{
          marginBottom: '20px',
          background: 'linear-gradient(135deg, rgba(15, 118, 110, 0.09), rgba(217, 119, 6, 0.05))',
          border: '1px solid rgba(15, 118, 110, 0.18)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }}>Overall Completion</div>
            <div style={{ fontSize: '42px', fontWeight: '800', letterSpacing: '-0.03em' }} className="gradient-text">{overall}%</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{done} of {total} tasks completed</div>
          </div>
          <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: `conic-gradient(#0f766e ${overall * 3.6}deg, var(--bg-elevated) 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {overall >= 80 ? <Trophy size={22} style={{ color: '#d97706' }} /> : overall >= 50 ? <Zap size={22} style={{ color: '#0f766e' }} /> : <Target size={22} style={{ color: 'var(--text-muted)' }} />}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : Object.keys(byProject).length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <Target size={32} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 10px', display: 'block' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No tasks to track</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 className="font-display text-sm font-semibold tracking-tight text-[var(--text-muted)]">By project</h2>
          {Object.entries(byProject).map(([projectName, projectTasks], i) => {
            const pDone = projectTasks.filter(t => t.stage === 'DONE').length
            const pTotal = projectTasks.length
            const pPct = pTotal ? Math.round((pDone / pTotal) * 100) : 0
            return (
              <div key={projectName} className="card animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="icon-box" style={{ width: '30px', height: '30px', background: 'var(--accent-gradient)' }}>
                      <FolderKanban size={14} color="white" />
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', letterSpacing: '-0.01em' }}>{projectName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pTotal} tasks</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: pPct >= 80 ? '#059669' : pPct >= 50 ? '#d97706' : 'var(--accent)', letterSpacing: '-0.02em' }}>{pPct}%</div>
                </div>
                <div className="progress-bar" style={{ height: '5px' }}>
                  <div className="progress-fill" style={{ width: `${pPct}%`, background: pPct >= 80 ? '#059669' : pPct >= 50 ? '#d97706' : '#0f766e' }} />
                </div>
                <div style={{ display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {['TODO','IN_PROGRESS','REVIEW','DONE'].map(stage => {
                    const count = projectTasks.filter(t => t.stage === stage).length
                    const colors: Record<string, string> = { TODO: '#64748b', IN_PROGRESS: '#0f766e', REVIEW: '#d97706', DONE: '#059669' }
                    const labels: Record<string,string> = { TODO: 'To Do', IN_PROGRESS: 'Active', REVIEW: 'Review', DONE: 'Done' }
                    return <div key={stage} style={{ fontSize: '11px', color: 'var(--text-muted)' }}><span style={{ color: colors[stage], fontWeight: '700' }}>{count}</span> {labels[stage]}</div>
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
