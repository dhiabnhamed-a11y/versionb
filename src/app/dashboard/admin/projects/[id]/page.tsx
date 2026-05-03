'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { getCompanyTypeCopy, getDeliverableTypeLabel, normalizeCompanyType } from '@/lib/company-types'
import { ArrowLeft, Camera, FolderKanban, User, Building2, Link2, Tags, UsersRound } from 'lucide-react'
import { ProjectCamera } from '@/components/camera/ProjectCamera'
import { MediaPlayer } from '@/components/media/MediaPlayer'
import { ProjectMediaStudio } from '@/components/media/ProjectMediaStudio'

type ProjectDetail = {
  id: string
  title: string
  description: string | null
  room?: { id: string; name: string } | null
  category?: { id: string; name: string; description?: string | null } | null
  clientName?: string | null
  hasCamera: boolean
  cameraType: 'device' | 'external'
  manager: { id: string; name: string } | null
  tasks: {
    id: string
    stage: string
    title: string
    deliverableType?: string
    submissions: {
      id: string
      fileUrl: string
      fileName: string
      fileType: string
      mediaType?: string | null
      fileSize?: number | null
      duration?: number | null
      thumbnailUrl?: string | null
      playbackUrl?: string | null
      cloudinaryPublicId?: string | null
      note?: string | null
      createdAt: string
      user: { id: string; name: string }
    }[]
  }[]
  projectMedia?: {
    id: string
    projectId: string
    url: string
    playbackUrl?: string | null
    thumbnailUrl?: string | null
    cloudinaryPublicId: string
    type: string
    mimeType: string
    originalFilename: string
    size: number
    duration?: number | null
    width?: number | null
    height?: number | null
    format?: string | null
    createdAt: string
    uploadedBy?: { id: string; name: string }
  }[]
}

export default function ProjectDetailPage() {
  const { data: session } = useSession()
  const params = useParams()
  const id = params.id as string
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const companyType = normalizeCompanyType((session?.user as { companyType?: string | null } | undefined)?.companyType)
  const companyCopy = getCompanyTypeCopy(companyType)
  const isAgency = companyType === 'DIGITAL_AGENCY'

  useEffect(() => {
    console.log('[ProjectDetailPage] mounted for project route', { id })
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const res = await fetch(`/api/projects/${id}`)
      if (cancelled) return
      if (res.status === 404) {
        setNotFound(true)
        setProject(null)
      } else if (res.ok) {
        const projectPayload = await res.json()
        console.log('[ProjectDetailPage] loaded project payload', {
          id: projectPayload.id,
          hasCamera: projectPayload.hasCamera,
          cameraType: projectPayload.cameraType,
        })
        setProject(projectPayload)
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
                    {project.room && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(33,66,255,0.18)] bg-[rgba(33,66,255,0.06)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2142ff]">
                        <Building2 className="h-3 w-3" />
                        {project.room.name}
                      </span>
                    )}
                    {isAgency && project.category && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(124,58,237,0.18)] bg-[rgba(124,58,237,0.06)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#7c3aed]">
                        <Tags className="h-3 w-3" />
                        {project.category.name}
                      </span>
                    )}
                    {isAgency && project.clientName && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(19,141,136,0.18)] bg-[var(--accent-subtle)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]">
                        <UsersRound className="h-3 w-3" />
                        {project.clientName}
                      </span>
                    )}
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

      <ProjectCamera
        projectId={project.id}
        initialEnabled={project.hasCamera}
        initialCameraType={project.cameraType}
        onProjectCameraChange={(settings) => {
          console.log('[ProjectDetailPage] camera settings changed', settings)
          setProject((current) => (current ? { ...current, ...settings } : current))
        }}
      />

      {isAgency && <ProjectMediaStudio projectId={project.id} initialMedia={project.projectMedia ?? []} />}

      <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h2 className="font-display mb-3 text-base font-semibold">
          {companyCopy.taskPluralLabel} in this {companyCopy.projectLabel.toLowerCase()}
        </h2>
        {project.tasks.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No {companyCopy.taskPluralLabel.toLowerCase()} yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {project.tasks.map((t) => (
              <li key={t.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--text-primary)]">{t.title}</span>
                    {isAgency && (
                      <span className="rounded-full border border-[rgba(124,58,237,0.18)] bg-[rgba(124,58,237,0.06)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#7c3aed]">
                        {getDeliverableTypeLabel(t.deliverableType)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t.stage}</span>
                </div>
                {t.submissions.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {t.submissions.map((submission) => (
                      <div key={submission.id} className="rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] px-3 py-2">
                        {isAgency && submission.mediaType ? (
                          <div className="grid gap-3 md:grid-cols-[minmax(0,280px)_1fr]">
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
                                user: submission.user,
                              }}
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[var(--text-primary)]">{submission.fileName}</div>
                              <div className="text-[11px] text-[var(--text-muted)]">{submission.user.name}</div>
                              {submission.note && <div className="mt-1 text-[11px] text-[var(--text-secondary)]">{submission.note}</div>}
                              <a
                                href={submission.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-secondary mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-[11px]"
                              >
                                <Link2 className="h-3.5 w-3.5" />
                                Open file
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-xs font-semibold text-[var(--text-primary)]">{submission.fileName}</div>
                              <div className="text-[11px] text-[var(--text-muted)]">{submission.user.name}</div>
                              {submission.note && <div className="mt-1 text-[11px] text-[var(--text-secondary)]">{submission.note}</div>}
                            </div>
                            <a
                              href={submission.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-[11px]"
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              Open file
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
