'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { clientsApi, type Client, type ClientsResponse, type ClientStatus } from '@/lib/api-client/clients'
import { formatInvoiceMoney } from '@/lib/invoices'

type ClientForm = {
  companyName: string
  contactPerson: string
  email: string
  phone: string
  country: string
  address: string
  notes: string
  avatarUrl: string
  status: ClientStatus
}

const fetcher = (url: string) => clientsApi.listFromUrl(url)

function emptyForm(): ClientForm {
  return {
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    country: '',
    address: '',
    notes: '',
    avatarUrl: '',
    status: 'active',
  }
}

function formFromClient(client: Client): ClientForm {
  return {
    companyName: client.companyName,
    contactPerson: client.contactPerson ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    country: client.country ?? '',
    address: client.address ?? '',
    notes: client.notes ?? '',
    avatarUrl: client.avatarUrl ?? '',
    status: client.status,
  }
}

const CLIENT_REALTIME_EVENTS = ['client_created', 'client_updated', 'client_deleted', 'invoice_created', 'invoice_updated', 'invoice_deleted', 'project_created', 'project_updated'] as const

export default function ClientsPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ClientStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [form, setForm] = useState<ClientForm>(() => emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const url = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '24' })
    if (query.trim()) params.set('q', query.trim())
    if (status !== 'all') params.set('status', status)
    return `/api/clients?${params.toString()}`
  }, [page, query, status])

  const { data, isLoading, mutate } = useSWR<ClientsResponse>(url, fetcher, {
    keepPreviousData: true,
  })

  useRealtimeSubscription(CLIENT_REALTIME_EVENTS, () => {
    void mutate()
  }, 350)

  const clients = data?.items ?? []
  const summary = data?.summary ?? { activeCount: 0, inactiveCount: 0, unpaidTotal: 0 }
  const pagination = data?.pagination ?? { page: 1, pageSize: 24, total: 0, pageCount: 0 }

  function openCreateModal() {
    setEditingClient(null)
    setForm(emptyForm())
    setError(null)
    setModalOpen(true)
  }

  function openEditModal(client: Client) {
    setEditingClient(client)
    setForm(formFromClient(client))
    setError(null)
    setModalOpen(true)
  }

  async function saveClient(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const optimisticClient: Client = {
      id: editingClient?.id ?? `temp-${Date.now()}`,
      ...form,
      createdAt: editingClient?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      unpaidTotal: editingClient?.unpaidTotal ?? 0,
      _count: editingClient?._count ?? { projects: 0, invoices: 0 },
    }

    await mutate(
      async (current) => {
        if (editingClient) {
          await clientsApi.update(editingClient.id, form)
        } else {
          await clientsApi.create(form)
        }
        return current
      },
      {
        optimisticData: (current) => {
          if (!current) {
            return {
              items: [optimisticClient],
              pagination: { page: 1, pageSize: 24, total: 1, pageCount: 1 },
              summary: {
                activeCount: optimisticClient.status === 'active' ? 1 : 0,
                inactiveCount: optimisticClient.status === 'inactive' ? 1 : 0,
                unpaidTotal: 0,
              },
            }
          }
          return {
            ...current,
            items: editingClient
              ? current.items.map((client) => (client.id === editingClient.id ? optimisticClient : client))
              : [optimisticClient, ...current.items],
          }
        },
        rollbackOnError: true,
        revalidate: true,
      }
    ).catch((reason) => {
      setError(reason instanceof Error ? reason.message : 'Client could not be saved.')
      setSaving(false)
      return
    })

    setSaving(false)
    setModalOpen(false)
  }

  async function deleteClient(client: Client) {
    if (!confirm(`Delete ${client.companyName}? Projects and invoices will stay in the workspace but lose this client link.`)) return

    await mutate(
      async (current) => {
        await clientsApi.delete(client.id)
        return current
      },
      {
        optimisticData: (current) =>
          current
            ? { ...current, items: current.items.filter((item) => item.id !== client.id) }
            : { items: [], pagination: { page: 1, pageSize: 24, total: 0, pageCount: 0 }, summary: { activeCount: 0, inactiveCount: 0, unpaidTotal: 0 } },
        rollbackOnError: true,
        revalidate: true,
      }
    ).catch((reason) => setError(reason instanceof Error ? reason.message : 'Client could not be deleted.'))
  }

  return (
    <div className="dashboard-page" style={{ maxWidth: '1180px' }}>
      <div className="dashboard-header-row">
        <div>
          <h1 className="page-heading flex items-center gap-2.5">
            <Building2 size={25} strokeWidth={1.85} style={{ color: 'var(--accent)' }} />
            Clients
          </h1>
          <p className="page-sub">Accounts, campaigns, deliverables, invoice health, and history in one place.</p>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" onClick={openCreateModal} className="btn-primary">
            <Plus size={16} />
            New client
          </button>
        </div>
      </div>

      <div className="dashboard-stat-grid">
        <article className="stat-card">
          <span className="stat-card-label">Active clients</span>
          <strong className="stat-card-value">{summary.activeCount}</strong>
          <span className="stat-card-delta">
            <CheckCircle2 size={14} /> Ready accounts
          </span>
        </article>
        <article className="stat-card">
          <span className="stat-card-label">Inactive</span>
          <strong className="stat-card-value">{summary.inactiveCount}</strong>
          <span className="stat-card-delta">Archived relationships</span>
        </article>
        <article className="stat-card">
          <span className="stat-card-label">Unpaid</span>
          <strong className="stat-card-value text-[var(--warning)]">{formatInvoiceMoney(summary.unpaidTotal, 'USD')}</strong>
          <span className="stat-card-delta">Across linked invoices</span>
        </article>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-muted)] focus-within:border-[var(--accent)] focus-within:bg-white">
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Search by company, contact, email, country..."
            className="min-w-0 flex-1 border-0 bg-transparent font-medium text-[var(--text-primary)] outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'inactive'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setStatus(item)
                setPage(1)
              }}
              className={`filter-chip ${status === item ? 'filter-chip-active' : ''}`}
            >
              {item === 'all' ? 'All' : item}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      {isLoading && !data ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="card loading-shimmer h-44" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="card py-14 text-center">
          <UsersRound size={34} className="mx-auto mb-3 text-[var(--text-light)]" />
          <p className="font-semibold text-[var(--text-primary)]">No clients found</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-muted)]">Create a client account to connect campaigns, briefs, deliverables, and invoices.</p>
          <button type="button" onClick={openCreateModal} className="btn-primary mt-5">
            <Plus size={16} />
            New client
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((client, index) => (
            <article key={client.id} className="card animate-fade-in flex min-h-[220px] flex-col" style={{ animationDelay: `${index * 35}ms` }}>
              <div className="flex items-start justify-between gap-3">
                <Link href={`/dashboard/admin/clients/${client.id}`} className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] bg-[var(--accent-subtle)] text-sm font-black text-[var(--accent)]">
                      {client.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={client.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        client.companyName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-black text-[var(--text-primary)]">{client.companyName}</h2>
                      <p className="truncate text-xs font-semibold text-[var(--text-muted)]">{client.contactPerson || client.country || 'Client account'}</p>
                    </div>
                  </div>
                </Link>
                <span className={`badge ${client.status === 'active' ? 'badge-employee' : 'priority-medium'}`}>{client.status}</span>
              </div>

              <div className="mt-4 grid gap-2 text-xs text-[var(--text-secondary)]">
                {client.email && (
                  <a href={`mailto:${client.email}`} className="flex min-w-0 items-center gap-2 truncate">
                    <Mail size={13} className="shrink-0 text-[var(--text-muted)]" />
                    {client.email}
                  </a>
                )}
                {client.phone && (
                  <a href={`tel:${client.phone}`} className="flex min-w-0 items-center gap-2 truncate">
                    <Phone size={13} className="shrink-0 text-[var(--text-muted)]" />
                    {client.phone}
                  </a>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] p-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Projects</div>
                  <div className="mt-1 text-sm font-black">{client._count?.projects ?? 0}</div>
                </div>
                <div className="rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] p-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Invoices</div>
                  <div className="mt-1 text-sm font-black">{client._count?.invoices ?? 0}</div>
                </div>
                <div className="rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] p-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Unpaid</div>
                  <div className="mt-1 truncate text-sm font-black">{formatInvoiceMoney(client.unpaidTotal ?? 0, 'USD')}</div>
                </div>
              </div>

              <div className="mt-auto grid grid-cols-[1fr_auto_auto] gap-2 pt-4">
                <Link href={`/dashboard/admin/clients/${client.id}`} className="btn-secondary btn-sm">
                  <FileText size={14} />
                  Profile
                </Link>
                <button type="button" onClick={() => openEditModal(client)} className="btn-secondary btn-sm" aria-label="Edit client">
                  <Pencil size={14} />
                </button>
                <button type="button" onClick={() => deleteClient(client)} className="btn-danger btn-sm !px-3" aria-label="Delete client">
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {pagination.pageCount > 1 && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
            Previous
          </button>
          <span className="text-xs font-semibold text-[var(--text-muted)]">
            Page {pagination.page} of {pagination.pageCount}
          </span>
          <button type="button" className="btn-secondary btn-sm" disabled={page >= pagination.pageCount} onClick={() => setPage((current) => current + 1)}>
            Next
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setModalOpen(false)}>
          <div className="modal max-h-[92vh] w-[min(96vw,760px)] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold tracking-tight">{editingClient ? 'Edit client' : 'Create client'}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-full p-2 hover:bg-[var(--bg-elevated)]" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveClient} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                  Company name *
                  <input className="input" value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} required />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                  Contact person
                  <input className="input" value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                  Email
                  <input type="email" className="input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                  Phone
                  <input className="input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                  Country
                  <input className="input" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                  Status
                  <select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ClientStatus })}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)] md:col-span-2">
                  Logo URL
                  <input className="input" value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)] md:col-span-2">
                  Address
                  <textarea className="input" rows={2} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)] md:col-span-2">
                  Notes
                  <RichTextEditor value={form.notes} onChange={(html) => setForm({ ...form, notes: html })} placeholder="Client notes..." minHeight={100} maxHeight={300} />
                </label>
              </div>

              {error && <div className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

              <div className="modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {editingClient ? 'Save client' : 'Create client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
