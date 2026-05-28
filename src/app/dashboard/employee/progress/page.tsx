'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useLocale } from '@/components/i18n/LocaleProvider'
import { getCompanyTypeCopy, isAgencyCompanyType, normalizeCompanyType } from '@/lib/company-types'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { BarChart3, FolderKanban, Trophy, Zap, Target } from 'lucide-react'

interface Task {
  id: string; title: string; priority: string; stage: string; progress: number
  deadline?: string; project: { title: string }
}

const PROGRESS_REALTIME_EVENTS = ['task_created', 'task_updated', 'task_deleted', 'task_submission_created'] as const

export default function EmployeeProgressPage() {
  const { data: session } = useSession()
  const companyType = normalizeCompanyType((session?.user as { companyType?: string | null } | undefined)?.companyType)
  const companyCopy = getCompanyTypeCopy(companyType)
  const isAgency = isAgencyCompanyType(companyType)
  const { t } = useLocale()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const reloadTasks = useCallback(async () => {
    const data = await fetch('/api/tasks', { cache: 'no-store' }).then((response) => response.json())
    setTasks(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    void fetch('/api/tasks', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (!active) return
        setTasks(Array.isArray(data) ? data : [])
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useRealtimeSubscription(PROGRESS_REALTIME_EVENTS, () => {
    void reloadTasks()
  })

  const total = tasks.length
  const done = tasks.filter(t => t.stage === 'DONE').length
  const overall = total ? Math.round((done / total) * 100) : 0

  const byProject: Record<string, Task[]> = {}
  tasks.forEach(t => { const key = t.project.title; if (!byProject[key]) byProject[key] = []; byProject[key].push(t) })

  return (
    <div className="dashboard-page" style={{ maxWidth: '720px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-heading flex items-center gap-2.5">
          <BarChart3 size={24} strokeWidth={1.85} style={{ color: 'var(--accent)' }} /> {t('employee.progress.title')}
        </h1>
        <p className="page-sub">
          {t('employee.progress.subtitle').replace('{entities}', isAgency ? 'campaigns' : companyCopy.projectPluralLabel.toLowerCase())}
        </p>
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
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }}>{t('employee.progress.overall')}</div>
            <div style={{ fontSize: '42px', fontWeight: '800', letterSpacing: '-0.03em' }} className="gradient-text">{overall}%</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{t('employee.progress.count').replace('{done}', done.toString()).replace('{total}', total.toString())}</div>
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
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{t('common.noTasks')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 className="font-display text-sm font-semibold tracking-tight text-[var(--text-muted)]">
            {t('employee.progress.by').replace('{entities}', isAgency ? 'campaign' : companyCopy.projectLabel.toLowerCase())}
          </h2>
          {Object.entries(byProject).map(([projectName, projectTasks], i) => {
            const pDone = projectTasks.filter(t => t.stage === 'DONE').length
            const pTotal = projectTasks.length
            const pPct = pTotal ? Math.round((pDone / pTotal) * 100) : 0
            return (
              <div key={projectName} className="card card-interactive animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="icon-box" style={{ width: '30px', height: '30px', background: 'var(--accent-gradient)' }}>
                      <FolderKanban size={14} color="white" />
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', letterSpacing: '-0.01em' }}>{projectName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('employee.progress.total').replace('{count}', pTotal.toString())}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: pPct >= 80 ? 'var(--success)' : pPct >= 50 ? 'var(--warning)' : 'var(--accent)', letterSpacing: '-0.02em' }}>{pPct}%</div>
                </div>
                <div className="progress-bar" style={{ height: '5px' }}>
                  <div className="progress-fill" style={{ width: `${pPct}%`, background: pPct >= 80 ? '#059669' : pPct >= 50 ? '#d97706' : '#0f766e' }} />
                </div>
                <div style={{ display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {['TODO','IN_PROGRESS','REVIEW','DONE'].map(stage => {
                    const count = projectTasks.filter(t => t.stage === stage).length
                    const colors: Record<string, string> = { TODO: '#64748b', IN_PROGRESS: '#0f766e', REVIEW: '#d97706', DONE: '#059669' }
                    const labels: Record<string,string> = { TODO: t('pipeline.work'), IN_PROGRESS: t('common.inProgress'), REVIEW: t('pipeline.review'), DONE: t('overview.completed') }
                    return <div key={stage} style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span className="status-dot" style={{ width: '6px', height: '6px', background: colors[stage] }} /><span style={{ color: colors[stage], fontWeight: '700' }}>{count}</span> {labels[stage]}</div>
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
