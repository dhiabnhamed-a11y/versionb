'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Camera, FolderKanban, User } from 'lucide-react'
import { ProjectCamera } from '@/components/camera/ProjectCamera'

type ProjectDetail = {
  id: string
  title: string
  description: string | null
  hasCamera: boolean
  cameraType: 'device' | 'external'
  manager: { id: string; name: string } | null
  tasks: { id: string; stage: string; title: string }[]
}

export default function ProjectDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const res = await fetch(`/api/projects/${id}`)
      if (cancelled) return
      if (res.status === 404) {
        setNotFound(true)
        setProject(null)
      } else if (res.ok) {
        setProject(await res.json())
        setNotFound(false)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex max-w-4xl items-center justify-center py-24">
        <div className="spinner" />
      </div>
    )
  }

  if (notFound || !project) {
    return (
      <div className="card max-w-lg text-center">
        <p className="text-[var(--text-muted)]">Project not found or you don&apos;t have access.</p>
        <Link href="/dashboard/admin/projects" className="btn-primary mt-4 inline-block text-sm no-underline">
          Back to projects
        </Link>
      </div>
    )
  }

  const done = project.tasks.filter((t) => t.stage === 'DONE').length
  const pct = project.tasks.length ? Math.round((done / project.tasks.length) * 100) : 0

  return (
    <div className="max-w-4xl space-y-8">
      <Link
        href="/dashboard/admin/projects"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        All projects
      </Link>

      <header className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{ background: 'var(--accent-gradient)' }}
            >
              <FolderKanban className="h-6 w-6" strokeWidth={1.85} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                  {project.title}
                </h1>
                {project.hasCamera && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-ring)] bg-[var(--accent-subtle)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]">
                    <Camera className="h-3 w-3" />
                    Camera on
                  </span>
                )}
              </div>
              {project.description && (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">{project.description}</p>
              )}
              {project.manager && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <User className="h-3.5 w-3.5" />
                  Manager: {project.manager.name}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums text-[var(--accent)]">{pct}%</div>
            <div className="text-xs text-[var(--text-muted)]">
              {done}/{project.tasks.length} tasks done
            </div>
          </div>
        </div>
      </header>

      {project.hasCamera && <ProjectCamera projectId={project.id} />}

      <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h2 className="font-display mb-3 text-base font-semibold">Tasks in this project</h2>
        {project.tasks.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No tasks yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {project.tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-[var(--text-primary)]">{t.title}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t.stage}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
