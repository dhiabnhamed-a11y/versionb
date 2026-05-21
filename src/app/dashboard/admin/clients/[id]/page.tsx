'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import useSWR from 'swr'
import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileSignature,
  FolderKanban,
  Link2,
  Loader2,
  Mail,
  Phone,
  Plus,
  ReceiptText,
  ShieldCheck,
  Zap,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { clientsApi, type ClientProfileResponse } from '@/lib/api-client/clients'
import { contractsApi, type ClientContractsResponse, type ContractGenerationInput } from '@/lib/api-client/contracts'
import { formatContractDate, getContractStatusLabel, type ContractLanguage } from '@/lib/contracts'
import { downloadPdfFromApi } from '@/lib/download-response'
import { formatInvoiceMoney, getInvoiceStatusLabel } from '@/lib/invoices'

type ProfileResponse = ClientProfileResponse

const fetcher = (url: string) => clientsApi.getFromUrl(url)
const contractsFetcher = (url: string) => {
  const match = url.match(/\/api\/clients\/([^/]+)\/contracts/)
  const clientId = match?.[1] ? decodeURIComponent(match[1]) : ''
  return contractsApi.listForClient(clientId)
}

type ContractWizardForm = Required<
  Pick<
    ContractGenerationInput,
    | 'contractType'
    | 'language'
    | 'currency'
    | 'governingLaw'
    | 'jurisdiction'
    | 'paymentFrequency'
    | 'paymentTerms'
    | 'confidentialityLevel'
    | 'supportTerms'
    | 'terminationNoticeDays'
    | 'revisionLimit'
    | 'ipOwnership'
    | 'serviceScope'
    | 'durationMonths'
    | 'renewalTerms'
    | 'riskProfile'
    | 'effectiveDate'
    | 'pricingStructure'
  >
> & {
  projectId: string
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function projectProgress(project: ProfileResponse['client']['projects'][number]) {
  const done = project.tasks.filter((task) => task.stage === 'DONE').length
  return project.tasks.length ? Math.round((done / project.tasks.length) * 100) : 0
}

function buildContractForm(client: ProfileResponse['client']): ContractWizardForm {
  const projectScope = client.projects
    .slice(0, 3)
    .map((project) => project.title)
    .join('; ')

  return {
    projectId: client.projects[0]?.id ?? '',
    contractType: 'SERVICE_AGREEMENT',
    language: 'en',
    currency: client.invoices[0]?.currency ?? 'USD',
    governingLaw: client.country ? `${client.country} law` : '',
    jurisdiction: client.country ?? '',
    paymentFrequency: client.invoices.length > 1 ? 'Monthly or per approved invoice' : 'Per approved invoice',
    paymentTerms: 'Net 15 days from valid invoice unless otherwise agreed',
    confidentialityLevel: 'standard',
    supportTerms: 'Business-hours support with priority handling for production-blocking issues',
    terminationNoticeDays: 30,
    revisionLimit: 'Two consolidated revision rounds per deliverable',
    ipOwnership: 'Client owns final paid deliverables; provider retains pre-existing tools, systems, reusable know-how, and templates',
    serviceScope: projectScope || client.notes || 'Professional services, operational deliverables, and client support managed in TASKIT',
    durationMonths: 12,
    renewalTerms: 'Renewal by mutual written agreement before the expiry date',
    riskProfile: 'standard',
    effectiveDate: todayInput(),
    pricingStructure: 'Fees follow approved invoices, statements of work, retainers, or written orders recorded in TASKIT',
  }
}

export default function ClientProfilePage() {
  const params = useParams<{ id: string }>()
  const { data, isLoading, error } = useSWR<ProfileResponse>(params?.id ? `/api/clients/${params.id}` : null, fetcher)
  const {
    data: contractData,
    isLoading: contractsLoading,
    mutate: refreshContracts,
  } = useSWR<ClientContractsResponse>(params?.id ? `/api/clients/${params.id}/contracts` : null, contractsFetcher)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)
  const [downloadingContractId, setDownloadingContractId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [portalUrl, setPortalUrl] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)
  const [contractModalOpen, setContractModalOpen] = useState(false)
  const [contractSaving, setContractSaving] = useState(false)
  const [contractError, setContractError] = useState<string | null>(null)
  const [contractMessage, setContractMessage] = useState<string | null>(null)
  const [contractForm, setContractForm] = useState<ContractWizardForm | null>(null)

  async function downloadInvoicePdf(invoice: ProfileResponse['client']['invoices'][number]) {
    setDownloadingInvoiceId(invoice.id)
    setDownloadError(null)

    try {
      await downloadPdfFromApi(`/api/invoices/${invoice.id}/pdf`, invoice.invoiceNumber, {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        source: 'client-profile',
      })
    } catch (reason) {
      setDownloadError(reason instanceof Error ? reason.message : 'Invoice PDF could not be downloaded.')
    } finally {
      setDownloadingInvoiceId(null)
    }
  }

  function openContractWizard() {
    if (!data?.client) return
    setContractForm(buildContractForm(data.client))
    setContractError(null)
    setContractMessage(null)
    setContractModalOpen(true)
  }

  async function generateContract(event: FormEvent) {
    event.preventDefault()
    if (!contractForm || !params.id) return

    setContractSaving(true)
    setContractError(null)
    setContractMessage(null)

    try {
      const input: ContractGenerationInput = {
        ...contractForm,
        projectId: contractForm.projectId || undefined,
        language: contractForm.language as ContractLanguage,
      }
      const response = await contractsApi.generateForClient(params.id, input)
      setContractMessage(response.aiMessage)
      setContractModalOpen(false)
      await refreshContracts()
    } catch (reason) {
      setContractError(reason instanceof Error ? reason.message : 'Contract could not be generated.')
    } finally {
      setContractSaving(false)
    }
  }

  async function downloadContractPdf(contract: NonNullable<ClientContractsResponse['items']>[number]) {
    setDownloadingContractId(contract.id)
    setDownloadError(null)

    try {
      await downloadPdfFromApi(`/api/contracts/${contract.id}/pdf`, contract.contractNumber, {
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        source: 'client-profile',
      })
    } catch (reason) {
      setDownloadError(reason instanceof Error ? reason.message : 'Contract PDF could not be downloaded.')
    } finally {
      setDownloadingContractId(null)
    }
  }

  async function generatePortalLink(rotate = false) {
    setPortalLoading(true)
    setPortalError(null)
    try {
      const body = await clientsApi.createPortal(params.id, { enabled: true, rotate })
      setPortalUrl(body.url)
      if (body.url && navigator.clipboard) {
        await navigator.clipboard.writeText(body.url).catch(() => undefined)
      }
    } catch (reason) {
      setPortalError(reason instanceof Error ? reason.message : 'Portal link could not be generated.')
    } finally {
      setPortalLoading(false)
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
  const contracts = contractData?.items ?? []

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
          <button type="button" onClick={openContractWizard} className="btn-primary">
            <Wand2 size={16} />
            Generate Contract
          </button>
          <Link href={`/dashboard/admin/invoices?clientId=${client.id}`} className="btn-primary">
            <Plus size={16} />
            New invoice
          </Link>
          <Link href={`/dashboard/admin/projects?clientId=${client.id}`} className="btn-secondary">
            <FolderKanban size={16} />
            New campaign
          </Link>
          <button type="button" onClick={() => generatePortalLink(false)} disabled={portalLoading} className="btn-secondary">
            {portalLoading ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
            Client link
          </button>
        </div>
      </section>

      {(portalUrl || portalError) && (
        <section className="card">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="panel-title">Client portal</h2>
              <p className="panel-meta">Share this private link so the client can review linked campaigns, deliverables, and leave feedback.</p>
              {portalError && <p className="mt-2 text-sm font-semibold text-red-600">{portalError}</p>}
              {portalUrl && <p className="mt-2 truncate text-xs font-semibold text-[var(--text-secondary)]">{portalUrl}</p>}
            </div>
            {portalUrl && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(portalUrl)}>
                  <Copy size={14} />
                  Copy
                </button>
                <a href={portalUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                  <ExternalLink size={14} />
                  Open
                </a>
                <button type="button" className="btn-danger btn-sm" onClick={() => generatePortalLink(true)} disabled={portalLoading}>
                  Rotate
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {(contractMessage || contractError) && (
        <section className={`alert-banner ${contractError ? 'alert-danger' : 'alert-success'}`}>
          {contractError ? <ShieldCheck size={18} /> : <Zap size={18} />}
          <div>
            <strong>{contractError ? 'Contract generation needs attention' : 'Contract intelligence completed'}</strong>
            <div>{contractError || contractMessage}</div>
          </div>
        </section>
      )}

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
        <article className="stat-card">
          <span className="stat-card-label">Contracts</span>
          <strong className="stat-card-value">{contracts.length}</strong>
          <span className="stat-card-delta">
            <FileSignature size={14} /> Legal records
          </span>
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
                <h2 className="panel-title">Contracts</h2>
                <p className="panel-meta">Generated agreements, versions, signature readiness, and audit-ready PDFs.</p>
              </div>
              <button type="button" onClick={openContractWizard} className="btn-secondary btn-sm">
                <Wand2 size={14} />
                New
              </button>
            </div>
            {downloadError && <div className="mb-3 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{downloadError}</div>}
            <div className="grid gap-3">
              {contractsLoading ? (
                <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-4">
                  <div className="loading-shimmer h-16 rounded-[var(--radius-sm)]" />
                </div>
              ) : contracts.length === 0 ? (
                <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-4 py-8 text-center">
                  <FileSignature size={26} className="mx-auto mb-3 text-[var(--text-light)]" />
                  <p className="text-sm font-bold text-[var(--text-primary)]">No contracts generated yet.</p>
                  <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-[var(--text-muted)]">
                    I can generate a professionally structured service agreement for this client using your operational and billing data.
                  </p>
                  <button type="button" onClick={openContractWizard} className="btn-primary btn-sm mt-4">
                    <Wand2 size={14} />
                    Generate Contract
                  </button>
                </div>
              ) : (
                contracts.map((contract) => {
                  const signedCount = contract.signatures?.filter((signature) => signature.status === 'signed').length ?? 0
                  const signatureCount = contract.signatures?.length ?? 0
                  const latestVersion = contract.versions?.[0]
                  return (
                    <article key={contract.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <FileSignature size={15} className="text-[var(--accent)]" />
                            <span className="text-sm font-black text-[var(--text-primary)]">{contract.contractNumber}</span>
                            <span className={`badge ${contract.status === 'signed' ? 'badge-employee' : contract.status === 'draft' ? 'badge-manager' : 'priority-medium'}`}>
                              {getContractStatusLabel(contract.status, contract.language)}
                            </span>
                          </div>
                          <div className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">{contract.title}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                            <span>v{contract.currentVersionNumber}</span>
                            <span>{contract.language.replaceAll('_', ' / ')}</span>
                            <span>Effective {formatContractDate(contract.effectiveDate, contract.language)}</span>
                            <span>{signedCount}/{signatureCount || 2} signatures</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          {latestVersion && (
                            <span className="rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] px-3 py-2 text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                              {latestVersion.status}
                            </span>
                          )}
                          <button type="button" onClick={() => downloadContractPdf(contract)} disabled={downloadingContractId === contract.id} className="btn-secondary btn-sm">
                            {downloadingContractId === contract.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            PDF
                          </button>
                        </div>
                      </div>
                    </article>
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

      {contractModalOpen && contractForm && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setContractModalOpen(false)}>
          <div className="modal max-h-[92vh] w-[min(96vw,980px)] overflow-y-auto">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--accent-subtle)] px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-[var(--accent)]">
                  <Zap size={13} />
                  Contract Generation Wizard
                </div>
                <h2 className="font-display mt-3 text-xl font-semibold tracking-tight">Enterprise service agreement</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                  I can generate a professionally structured service agreement for this client using your operational and billing data.
                </p>
              </div>
              <button type="button" onClick={() => setContractModalOpen(false)} className="rounded-full p-2 hover:bg-[var(--bg-elevated)]" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {contractError && <div className="alert-banner alert-danger mb-4"><ShieldCheck size={18} /><div>{contractError}</div></div>}

            <form onSubmit={generateContract} className="grid gap-5">
              <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-black text-[var(--text-primary)]">
                  <FileSignature size={16} className="text-[var(--accent)]" />
                  Document profile
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                    Language
                    <select className="input bg-white" value={contractForm.language} onChange={(event) => setContractForm({ ...contractForm, language: event.target.value as ContractLanguage })}>
                      <option value="en">English</option>
                      <option value="fr">French</option>
                      <option value="ar">Arabic</option>
                      <option value="bilingual_en_fr">English / French</option>
                      <option value="bilingual_en_ar">English / Arabic</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                    Contract type
                    <select className="input bg-white" value={contractForm.contractType} onChange={(event) => setContractForm({ ...contractForm, contractType: event.target.value })}>
                      <option value="SERVICE_AGREEMENT">Service agreement</option>
                      <option value="RETAINER_AGREEMENT">Retainer agreement</option>
                      <option value="PROJECT_CONTRACT">Project contract</option>
                      <option value="NDA_SERVICE_AGREEMENT">NDA + service agreement</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                    Linked project
                    <select className="input bg-white" value={contractForm.projectId} onChange={(event) => setContractForm({ ...contractForm, projectId: event.target.value })}>
                      <option value="">Client-level agreement</option>
                      {client.projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.title}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                    Currency
                    <input className="input bg-white uppercase" maxLength={3} value={contractForm.currency} onChange={(event) => setContractForm({ ...contractForm, currency: event.target.value.toUpperCase() })} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                    Effective date
                    <input type="date" className="input bg-white" value={contractForm.effectiveDate} onChange={(event) => setContractForm({ ...contractForm, effectiveDate: event.target.value })} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                    Duration months
                    <input type="number" min="1" max="120" className="input bg-white" value={contractForm.durationMonths} onChange={(event) => setContractForm({ ...contractForm, durationMonths: Number(event.target.value) })} />
                  </label>
                </div>
              </section>

              <section className="rounded-[var(--radius-md)] border border-[var(--border)] p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-black text-[var(--text-primary)]">
                  <ShieldCheck size={16} className="text-[var(--accent)]" />
                  Legal controls
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                    Governing law
                    <input className="input" value={contractForm.governingLaw} onChange={(event) => setContractForm({ ...contractForm, governingLaw: event.target.value })} placeholder="e.g. Tunisia law" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                    Jurisdiction
                    <input className="input" value={contractForm.jurisdiction} onChange={(event) => setContractForm({ ...contractForm, jurisdiction: event.target.value })} placeholder="e.g. Tunis, Tunisia" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                    Confidentiality level
                    <select className="input" value={contractForm.confidentialityLevel} onChange={(event) => setContractForm({ ...contractForm, confidentialityLevel: event.target.value })}>
                      <option value="standard">Standard</option>
                      <option value="strict">Strict</option>
                      <option value="regulated">Regulated / sensitive</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                    Termination notice
                    <input type="number" min="0" max="365" className="input" value={contractForm.terminationNoticeDays} onChange={(event) => setContractForm({ ...contractForm, terminationNoticeDays: Number(event.target.value) })} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)] md:col-span-2">
                    Intellectual property ownership
                    <RichTextEditor value={contractForm.ipOwnership} onChange={(html) => setContractForm({ ...contractForm, ipOwnership: html })} placeholder="IP ownership clause..." minHeight={60} maxHeight={200} />
                  </label>
                </div>
              </section>

              <section className="rounded-[var(--radius-md)] border border-[var(--border)] p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-black text-[var(--text-primary)]">
                  <ReceiptText size={16} className="text-[var(--accent)]" />
                  Commercial terms
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                    Payment frequency
                    <input className="input" value={contractForm.paymentFrequency} onChange={(event) => setContractForm({ ...contractForm, paymentFrequency: event.target.value })} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                    Payment terms
                    <input className="input" value={contractForm.paymentTerms} onChange={(event) => setContractForm({ ...contractForm, paymentTerms: event.target.value })} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                    Revision limits
                    <input className="input" value={contractForm.revisionLimit} onChange={(event) => setContractForm({ ...contractForm, revisionLimit: event.target.value })} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                    Renewal terms
                    <input className="input" value={contractForm.renewalTerms} onChange={(event) => setContractForm({ ...contractForm, renewalTerms: event.target.value })} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)] md:col-span-2">
                    Service scope
                    <RichTextEditor value={contractForm.serviceScope} onChange={(html) => setContractForm({ ...contractForm, serviceScope: html })} placeholder="Scope of services..." minHeight={80} maxHeight={250} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)] md:col-span-2">
                    Support terms
                    <RichTextEditor value={contractForm.supportTerms} onChange={(html) => setContractForm({ ...contractForm, supportTerms: html })} placeholder="Support terms..." minHeight={60} maxHeight={200} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)] md:col-span-2">
                    Pricing structure
                    <RichTextEditor value={contractForm.pricingStructure} onChange={(html) => setContractForm({ ...contractForm, pricingStructure: html })} placeholder="Pricing details..." minHeight={60} maxHeight={200} />
                  </label>
                </div>
              </section>

              <div className="modal-actions">
                <button type="button" onClick={() => setContractModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={contractSaving} className="btn-primary">
                  {contractSaving ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                  Generate enterprise contract
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
