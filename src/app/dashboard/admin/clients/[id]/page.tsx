'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import useSWR from 'swr'
import { useState } from 'react'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  Download,
  FolderKanban,
  Loader2,
  Mail,
  Phone,
  Plus,
  ReceiptText,
  Upload,
} from 'lucide-react'
import { formatInvoiceMoney, getInvoiceStatusLabel } from '@/lib/invoices'

type ProfileResponse = {
  client: {
    id: string
    companyName: string
    contactPerson?: string | null
    email?: string | null
    phone?: string | null
    country?: string | null
    address?: string | null
    notes?: string | null
    avatarUrl?: string | null
    status: 'active' | 'inactive'
    projects: Array<{
      id: string
      title: string
      description?: string | null
      category?: { id: string; name: string } | null
      manager?: { id: string; name: string } | null
      tasks: Array<{ id: string; stage: string }>
      updatedAt: string
    }>
    invoices: Array<{
      id: string
      invoiceNumber: string
      status: string
      currency: string
      dueDate?: string | null
      total: number | string
      campaign?: { id: string; title: string } | null
      brief?: { id: string; title: string } | null
      createdAt: string
    }>
    activities: Array<{
      id: string
      type: string
      title: string
      body?: string | null
      createdAt: string
      actor?: { id: string; name: string; email: string } | null
    }>
    _count: { projects: number; invoices: number }
  }
  stats: {
    activeProjects: number
    completedProjects: number
    unpaidInvoiceCount: number
    unpaidTotal: number
  }
  recentDeliverables: Array<{
    id: string
    type: string
    originalFilename: string
    thumbnailUrl?: string | null
    url: string
    createdAt: string
    uploadedBy: { id: string; name: string }
  }>
}

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })
  const body = await response.json()
  if (!response.ok) throw new Error(body?.error || 'Client could not be loaded.')
  return body
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function projectProgress(project: ProfileResponse['client']['projects'][number]) {
  const done = project.tasks.filter((task) => task.stage === 'DONE').length
  return project.tasks.length ? Math.round((done / project.tasks.length) * 100) : 0
}

export default function ClientProfilePage() {
  const params = useParams<{ id: string }>()
  const { data, isLoading, error } = useSWR<ProfileResponse>(params?.id ? `/api/clients/${params.id}` : null, fetcher)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  function getDownloadFilename(disposition: string | null, fallback: string) {
    const match = disposition?.match(/filename="?([^";]+)"?/i)
    return match?.[1] || `${fallback.replace(/[^a-zA-Z0-9._-]/g, '_') || 'invoice'}.pdf`
  }

  async function downloadInvoicePdf(invoice: ProfileResponse['client']['invoices'][number]) {
    setDownloadingInvoiceId(invoice.id)
    setDownloadError(null)

    try {
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/pdf' },
      })
      const contentType = response.headers.get('content-type') ?? ''
      if (!response.ok || !contentType.includes('application/pdf')) {
        const body = contentType.includes('application/json') ? await response.json().catch(() => null) : null
        throw new Error(body?.error || 'Invoice PDF could not be downloaded.')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = getDownloadFilename(response.headers.get('content-disposition'), invoice.invoiceNumber)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(url)
    } catch (reason) {
      setDownloadError(reason instanceof Error ? reason.message : 'Invoice PDF could not be downloaded.')
    } finally {
      setDownloadingInvoiceId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="dashboard-page" style={{ maxWidth: '1180px' }}>
        <div className="card loading-shimmer h-48" />
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="card loading-shimmer h-80" />
          <div className="card loading-shimmer h-80" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="dashboard-page" style={{ maxWidth: '860px' }}>
        <Link href="/dashboard/admin/clients" className="btn-secondary btn-sm mb-4 w-fit">
          <ArrowLeft size={14} />
          Clients
        </Link>
        <div className="card border-red-200 bg-red-50 text-sm font-semibold text-red-700">{error instanceof Error ? error.message : 'Client could not be loaded.'}</div>
      </div>
    )
  }

  const { client, stats, recentDeliverables } = data

  return (
    <div className="dashboard-page" style={{ maxWidth: '1180px' }}>
      <Link href="/dashboard/admin/clients" className="btn-secondary btn-sm mb-4 w-fit">
        <ArrowLeft size={14} />
        Clients
      </Link>

      <section className="dashboard-hero">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-[var(--accent-subtle)] text-xl font-black text-[var(--accent)]">
            {client.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={client.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              client.companyName.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <span className="dashboard-hero-kicker">
              <Building2 size={14} />
              {client.status} client
            </span>
            <h1 className="page-heading mt-3">{client.companyName}</h1>
            <p className="page-sub">{client.contactPerson || client.country || 'Client profile'}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[var(--text-secondary)]">
              {client.email && (
                <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5">
                  <Mail size={13} /> {client.email}
                </a>
              )}
              {client.phone && (
                <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1.5">
                  <Phone size={13} /> {client.phone}
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="dashboard-hero-actions">
          <Link href={`/dashboard/admin/invoices?clientId=${client.id}`} className="btn-primary">
            <Plus size={16} />
            New invoice
          </Link>
          <Link href={`/dashboard/admin/projects?clientId=${client.id}`} className="btn-secondary">
            <FolderKanban size={16} />
            New campaign
          </Link>
        </div>
      </section>

      <div className="dashboard-stat-grid">
        <article className="stat-card">
          <span className="stat-card-label">Active projects</span>
          <strong className="stat-card-value">{stats.activeProjects}</strong>
          <span className="stat-card-delta">
            <FolderKanban size={14} /> Campaigns in motion
          </span>
        </article>
        <article className="stat-card">
          <span className="stat-card-label">Completed</span>
          <strong className="stat-card-value">{stats.completedProjects}</strong>
          <span className="stat-card-delta">
            <CheckCircle2 size={14} /> Finished campaigns
          </span>
        </article>
        <article className="stat-card">
          <span className="stat-card-label">Unpaid invoices</span>
          <strong className="stat-card-value text-[var(--warning)]">{formatInvoiceMoney(stats.unpaidTotal, 'USD')}</strong>
          <span className="stat-card-delta">{stats.unpaidInvoiceCount} open invoice{stats.unpaidInvoiceCount === 1 ? '' : 's'}</span>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="grid gap-4">
          <div className="card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Projects</h2>
                <p className="panel-meta">Latest campaigns linked to this client.</p>
              </div>
            </div>
            <div className="grid gap-3">
              {client.projects.length === 0 ? (
                <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">No linked campaigns yet.</div>
              ) : (
                client.projects.map((project) => {
                  const pct = projectProgress(project)
                  return (
                    <Link key={project.id} href={`/dashboard/admin/projects/${project.id}`} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-4 transition hover:border-[var(--accent)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-[var(--text-primary)]">{project.title}</div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">{project.category?.name || 'Campaign'} {project.manager ? `- ${project.manager.name}` : ''}</div>
                        </div>
                        <span className="text-xs font-black text-[var(--accent)]">{pct}%</span>
                      </div>
                      <div className="progress-bar mt-3">
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </div>

          <div className="card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Invoices</h2>
                <p className="panel-meta">Recent billing records for this client.</p>
              </div>
            </div>
            {downloadError && <div className="mb-3 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{downloadError}</div>}
            <div className="grid gap-3">
              {client.invoices.length === 0 ? (
                <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">No invoices yet.</div>
              ) : (
                client.invoices.map((invoice) => (
                  <div key={invoice.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <ReceiptText size={15} className="text-[var(--accent)]" />
                          <span className="text-sm font-black">{invoice.invoiceNumber}</span>
                          <span className={`badge ${invoice.status === 'paid' ? 'badge-employee' : invoice.status === 'overdue' ? 'priority-critical' : 'badge-manager'}`}>{getInvoiceStatusLabel(invoice.status)}</span>
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">{invoice.campaign?.title || invoice.brief?.title || `Due ${formatDate(invoice.dueDate)}`}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm">{formatInvoiceMoney(Number(invoice.total), invoice.currency)}</strong>
                        <button type="button" onClick={() => downloadInvoicePdf(invoice)} disabled={downloadingInvoiceId === invoice.id} className="btn-secondary btn-sm" aria-label="Download invoice PDF">
                          {downloadingInvoiceId === invoice.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Recent deliverables</h2>
                <p className="panel-meta">Latest uploaded assets across linked campaigns.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {recentDeliverables.length === 0 ? (
                <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-muted)] md:col-span-2">No deliverables uploaded yet.</div>
              ) : (
                recentDeliverables.map((deliverable) => (
                  <a key={deliverable.id} href={deliverable.url} target="_blank" rel="noreferrer" className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-3 transition hover:border-[var(--accent)]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] text-[var(--accent)]">
                        <Upload size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-black text-[var(--text-primary)]">{deliverable.originalFilename}</div>
                        <div className="mt-1 text-[11px] font-semibold text-[var(--text-muted)]">{deliverable.type} by {deliverable.uploadedBy.name}</div>
                      </div>
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="grid content-start gap-4">
          <div className="card">
            <h2 className="panel-title">Client notes</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[var(--text-secondary)]">{client.notes || 'No notes have been added for this client.'}</p>
            {client.address && <p className="mt-4 whitespace-pre-line border-t border-[var(--border)] pt-4 text-xs font-semibold leading-6 text-[var(--text-muted)]">{client.address}</p>}
          </div>

          <div className="card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Activity</h2>
                <p className="panel-meta">Timeline of account changes and billing events.</p>
              </div>
            </div>
            <div className="grid gap-3">
              {client.activities.length === 0 ? (
                <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">No activity yet.</div>
              ) : (
                client.activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--accent)]">
                      <Clock3 size={14} />
                    </div>
                    <div className="min-w-0 border-b border-[var(--border)] pb-3">
                      <div className="text-sm font-black text-[var(--text-primary)]">{activity.title}</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        {formatDate(activity.createdAt)} {activity.actor ? `by ${activity.actor.name}` : ''}
                      </div>
                      {activity.body && <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{activity.body}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
