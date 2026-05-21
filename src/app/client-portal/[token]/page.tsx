'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import useSWR from 'swr'
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  FolderKanban,
  Loader2,
  MessageSquare,
  Send,
} from 'lucide-react'
import RichTextEditor from '@/components/ui/RichTextEditor'

type PortalResponse = {
  client: {
    id: string
    companyId: string
    companyName: string
    contactPerson?: string | null
    email?: string | null
    avatarUrl?: string | null
  }
  campaigns: Array<{
    id: string
    title: string
    description?: string | null
    updatedAt: string
    category?: { id: string; name: string } | null
    deliverables: Array<{
      id: string
      title: string
      description?: string | null
      type: string
      status: string
      approvalState: string
      dueAt?: string | null
      files: Array<{
        id: string
        url: string
        playbackUrl?: string | null
        thumbnailUrl?: string | null
        type: string
        mimeType: string
        originalFilename: string
        createdAt: string
      }>
      tasks: Array<{
        id: string
        title: string
        stage: string
      }>
    }>
  }>
  comments: Array<{
    id: string
    campaignId?: string | null
    deliverableId?: string | null
    authorName: string
    authorEmail?: string | null
    content: string
    createdAt: string
  }>
}

type FeedbackForm = {
  campaignId: string
  deliverableId: string
  authorName: string
  authorEmail: string
  content: string
}

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })
  const body = await response.json()
  if (!response.ok) throw new Error(body?.error || 'Portal could not be loaded.')
  return body
}

function formatDate(value?: string | null) {
  if (!value) return 'No due date'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function progressForChapter(chapter: PortalResponse['campaigns'][number]['deliverables'][number]) {
  if (chapter.approvalState === 'APPROVED') return 100
  const done = chapter.tasks.filter((task) => task.stage === 'DONE').length
  return chapter.tasks.length ? Math.round((done / chapter.tasks.length) * 100) : 0
}

function statusLabel(status: string, approvalState: string) {
  if (approvalState === 'APPROVED') return 'Approved'
  if (approvalState === 'CHANGES_REQUESTED') return 'Changes requested'
  if (status === 'CLIENT_REVIEW') return 'Ready for review'
  if (status === 'DELIVERED') return 'Delivered'
  return 'In production'
}

export default function ClientPortalPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token
  const { data, error, isLoading, mutate } = useSWR<PortalResponse>(token ? `/api/client-portal/${token}` : null, fetcher)
  const [form, setForm] = useState<FeedbackForm>({
    campaignId: '',
    deliverableId: '',
    authorName: '',
    authorEmail: '',
    content: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const chapters = useMemo(() => data?.campaigns.flatMap((campaign) => campaign.deliverables.map((chapter) => ({ ...chapter, campaign }))) ?? [], [data])
  const commentsByTarget = useMemo(() => {
    const groups = new Map<string, PortalResponse['comments']>()
    for (const comment of data?.comments ?? []) {
      const key = comment.deliverableId || comment.campaignId || 'general'
      groups.set(key, [...(groups.get(key) ?? []), comment])
    }
    return groups
  }, [data])

  async function submitFeedback(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch(`/api/client-portal/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Feedback could not be sent.')
      setForm((current) => ({ ...current, content: '' }))
      await mutate()
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason.message : 'Feedback could not be sent.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[var(--bg)] px-5 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="card loading-shimmer h-48" />
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="card loading-shimmer h-96" />
            <div className="card loading-shimmer h-96" />
          </div>
        </div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--bg)] px-5 py-12">
        <div className="card max-w-lg text-center">
          <FileText size={34} className="mx-auto mb-3 text-[var(--text-light)]" />
          <h1 className="font-display text-xl font-semibold">Portal unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            This client link is disabled, expired, or no longer exists.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] px-5 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="dashboard-hero">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-[var(--accent-subtle)] text-lg font-black text-[var(--accent)]">
              {data.client.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.client.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                data.client.companyName.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <span className="dashboard-hero-kicker">
                <FolderKanban size={14} />
                Client review portal
              </span>
              <h1 className="page-heading mt-3">{data.client.companyName}</h1>
              <p className="page-sub">Review campaigns, chapters, files, and leave feedback for the production team.</p>
            </div>
          </div>
        </header>

        <div className="dashboard-stat-grid">
          <article className="stat-card">
            <span className="stat-card-label">Campaigns</span>
            <strong className="stat-card-value">{data.campaigns.length}</strong>
            <span className="stat-card-delta">Linked to your account</span>
          </article>
          <article className="stat-card">
            <span className="stat-card-label">Chapters</span>
            <strong className="stat-card-value">{chapters.length}</strong>
            <span className="stat-card-delta">Deliverables and review items</span>
          </article>
          <article className="stat-card">
            <span className="stat-card-label">Feedback</span>
            <strong className="stat-card-value">{data.comments.length}</strong>
            <span className="stat-card-delta">Client comments submitted</span>
          </article>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="grid gap-4">
            {data.campaigns.length === 0 ? (
              <div className="card py-14 text-center">
                <FolderKanban size={34} className="mx-auto mb-3 text-[var(--text-light)]" />
                <p className="font-semibold text-[var(--text-primary)]">No campaigns are available yet</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-muted)]">Your team will publish work here once production begins.</p>
              </div>
            ) : (
              data.campaigns.map((campaign) => (
                <article key={campaign.id} className="card">
                  <div className="panel-header">
                    <div className="min-w-0">
                      <h2 className="panel-title truncate">{campaign.title}</h2>
                      <p className="panel-meta">{campaign.category?.name || 'Campaign'} - Updated {formatDate(campaign.updatedAt)}</p>
                    </div>
                  </div>
                  {campaign.description && <p className="mb-4 text-sm leading-7 text-[var(--text-secondary)]">{campaign.description}</p>}

                  <div className="grid gap-3">
                    {campaign.deliverables.length === 0 ? (
                      <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">No chapters published yet.</div>
                    ) : (
                      campaign.deliverables.map((chapter, index) => {
                        const pct = progressForChapter(chapter)
                        const comments = commentsByTarget.get(chapter.id) ?? []
                        return (
                          <section key={chapter.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">Chapter {index + 1}</div>
                                <h3 className="mt-1 text-sm font-black text-[var(--text-primary)]">{chapter.title}</h3>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
                                  <span>{statusLabel(chapter.status, chapter.approvalState)}</span>
                                  <span>-</span>
                                  <span>{formatDate(chapter.dueAt)}</span>
                                </div>
                              </div>
                              <span className={`badge ${chapter.approvalState === 'APPROVED' ? 'badge-employee' : chapter.approvalState === 'CHANGES_REQUESTED' ? 'priority-critical' : 'badge-manager'}`}>
                                {pct}%
                              </span>
                            </div>

                            {chapter.description && <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{chapter.description}</p>}
                            <div className="progress-bar mt-3">
                              <div className="progress-fill" style={{ width: `${pct}%` }} />
                            </div>

                            {chapter.files.length > 0 && (
                              <div className="mt-4 grid gap-2">
                                {chapter.files.map((file) => (
                                  <a key={file.id} href={file.playbackUrl || file.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold transition hover:border-[var(--accent)]">
                                    <span className="min-w-0 truncate">{file.originalFilename}</span>
                                    <ExternalLink size={13} className="shrink-0 text-[var(--accent)]" />
                                  </a>
                                ))}
                              </div>
                            )}

                            {comments.length > 0 && (
                              <div className="mt-4 grid gap-2 border-t border-[var(--border)] pt-3">
                                {comments.slice(0, 3).map((comment) => (
                                  <div key={comment.id} className="rounded-[var(--radius-sm)] bg-white px-3 py-2 text-xs">
                                    <div className="font-black text-[var(--text-primary)]">{comment.authorName}</div>
                                    <p className="mt-1 leading-5 text-[var(--text-secondary)]">{comment.content}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </section>
                        )
                      })
                    )}
                  </div>
                </article>
              ))
            )}
          </section>

          <aside className="grid content-start gap-4">
            <form onSubmit={submitFeedback} className="card grid gap-3">
              <div>
                <h2 className="panel-title flex items-center gap-2">
                  <MessageSquare size={16} className="text-[var(--accent)]" />
                  Send feedback
                </h2>
                <p className="panel-meta mt-1">Choose a campaign or chapter so the team sees exactly where your note belongs.</p>
              </div>

              <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                Campaign *
                <select
                  className="input"
                  value={form.campaignId}
                  onChange={(event) => setForm({ ...form, campaignId: event.target.value, deliverableId: '' })}
                  required
                >
                  <option value="">Select campaign...</option>
                  {data.campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                Chapter
                <select className="input" value={form.deliverableId} onChange={(event) => setForm({ ...form, deliverableId: event.target.value })}>
                  <option value="">General campaign feedback</option>
                  {data.campaigns
                    .find((campaign) => campaign.id === form.campaignId)
                    ?.deliverables.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.title}
                      </option>
                    ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                Name *
                <input className="input" value={form.authorName} onChange={(event) => setForm({ ...form, authorName: event.target.value })} required />
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                Email
                <input type="email" className="input" value={form.authorEmail} onChange={(event) => setForm({ ...form, authorEmail: event.target.value })} />
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                Comment *
                <RichTextEditor value={form.content} onChange={(html) => setForm({ ...form, content: html })} placeholder="Your feedback..." minHeight={100} maxHeight={300} />
              </label>

              {submitError && <div className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{submitError}</div>}

              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Send feedback
              </button>
            </form>

            <section className="card">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Recent feedback</h2>
                  <p className="panel-meta">Latest notes sent from this portal.</p>
                </div>
              </div>
              <div className="grid gap-3">
                {data.comments.length === 0 ? (
                  <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">No feedback yet.</div>
                ) : (
                  data.comments.slice(0, 8).map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--accent)]">
                        {comment.deliverableId ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                      </div>
                      <div className="min-w-0 border-b border-[var(--border)] pb-3">
                        <div className="text-sm font-black text-[var(--text-primary)]">{comment.authorName}</div>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{comment.content}</p>
                        <div className="mt-1 text-[11px] font-semibold text-[var(--text-light)]">{formatDate(comment.createdAt)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
