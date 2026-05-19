'use client'

import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Building2, CheckCircle2, Eye, Loader2, Search, ShieldCheck, XCircle, CreditCard } from 'lucide-react'

import styles from './SuperAdminCompaniesClient.module.css'
import SuperAdminBillingOverview from './SuperAdminBillingOverview'

type CompanyStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'DISABLED'
type StatusFilter = CompanyStatus | 'ALL'

type CompanyRecord = {
  id: string
  name: string
  emailDomain: string | null
  companyType: string
  country: string | null
  industry: string | null
  registrationNumber: string | null
  status: CompanyStatus
  reviewNote: string | null
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
  owner: {
    id: string
    name: string
    email: string
    accountStatus: string
    createdAt: string
  }
  reviewedBy: {
    id: string
    name: string
    email: string
  } | null
}

type CompanyResponse = {
  status: StatusFilter
  query: string
  counts: Record<CompanyStatus, number>
  companies: CompanyRecord[]
}

type AdminView = StatusFilter | 'BILLING'

const statusTabs: { value: AdminView; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACTIVE', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'DISABLED', label: 'Disabled' },
  { value: 'BILLING', label: 'Billing' },
]

function formatDate(value: string | null) {
  if (!value) return 'Not reviewed yet'
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getActionButtons(company: CompanyRecord) {
  if (company.status === 'PENDING') {
    return ['APPROVE', 'REJECT'] as const
  }

  if (company.status === 'ACTIVE') {
    return ['DISABLE'] as const
  }

  return ['APPROVE'] as const
}

export default function SuperAdminCompaniesClient({ initialStatus }: { initialStatus: string }) {
  const [status, setStatus] = useState<AdminView>(
    initialStatus === 'ACTIVE' || initialStatus === 'REJECTED' || initialStatus === 'DISABLED' || initialStatus === 'ALL' || initialStatus === 'BILLING'
      ? (initialStatus as AdminView)
      : 'PENDING'
  )
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<CompanyResponse | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [updatingAction, setUpdatingAction] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true

    async function loadCompanies() {
      setLoading(true)
      setError('')

      const response = await fetch(
        `/api/super-admin/companies?status=${encodeURIComponent(status)}&query=${encodeURIComponent(deferredSearch)}`,
        { cache: 'no-store' }
      )
      const payload = (await response.json()) as CompanyResponse & { error?: string }

      if (!active) return

      if (!response.ok) {
        setError(payload.error || 'Failed to load company registrations.')
        setLoading(false)
        return
      }

      setData(payload)
      setLoading(false)
      setSelectedCompanyId((prev) => {
        if (!prev && payload.companies[0]) return payload.companies[0].id
        if (prev && !payload.companies.some((company) => company.id === prev)) return payload.companies[0]?.id ?? null
        return prev
      })
    }

    void loadCompanies()

    return () => {
      active = false
    }
  }, [status, deferredSearch, refreshKey])

  const selectedCompany = useMemo(
    () => data?.companies.find((company) => company.id === selectedCompanyId) ?? data?.companies[0] ?? null,
    [data?.companies, selectedCompanyId]
  )

  async function handleAction(companyId: string, action: 'APPROVE' | 'REJECT' | 'DISABLE') {
    setUpdatingAction(`${companyId}:${action}`)
    setError('')

    const response = await fetch('/api/super-admin/companies', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, action }),
    })
    const payload = (await response.json()) as { error?: string }

    setUpdatingAction(null)

    if (!response.ok) {
      setError(payload.error || 'Failed to update company status.')
      return
    }

    setRefreshKey((current) => current + 1)
  }

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <div>
          <div className={styles.kicker}>Super Admin</div>
          <h1 className="page-heading">Company approval center</h1>
          <p className="page-sub">Review new registrations, verify company details, and control company activation centrally.</p>
        </div>

        <div className={styles.summaryCard}>
          <ShieldCheck size={18} className={styles.summaryIcon} />
          <div>
            <div className={styles.summaryLabel}>Pending verification</div>
            <div className={styles.summaryValue}>{data?.counts.PENDING ?? 0}</div>
          </div>
        </div>
      </div>

      <div className={styles.topControls}>
        <div className={styles.tabs}>
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={`${styles.tabButton} ${status === tab.value ? styles.tabButtonActive : ''}`}
            >
              {tab.value === 'BILLING' ? <CreditCard size={14} /> : null}
              <span>{tab.label}</span>
              {tab.value !== 'BILLING' && (
                <span className={styles.tabCount}>{data?.counts[tab.value as CompanyStatus] ?? 0}</span>
              )}
            </button>
          ))}
        </div>

        <label className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search by company name, registration number, or domain"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      {error && (
        <div
          className="rounded-[var(--radius-sm)] border px-3.5 py-2.5 text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.06)',
            borderColor: 'rgba(239, 68, 68, 0.2)',
            color: '#b91c1c',
          }}
        >
          {error}
        </div>
      )}

      {status === 'BILLING' ? (
        <SuperAdminBillingOverview />
      ) : null}

      <div className={styles.contentGrid} style={{ display: status === 'BILLING' ? 'none' : undefined }}>
        <div className="card">
          <div className={styles.tableHeader}>
            <div>
              <div className={styles.tableTitle}>Company requests</div>
              <div className={styles.tableSubtitle}>{status === 'PENDING' ? 'Pending companies are shown by default.' : 'Review the selected company status bucket.'}</div>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Registration</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className={styles.loadingCell}>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Loading company registrations...</span>
                    </td>
                  </tr>
                ) : data?.companies.length ? (
                  data.companies.map((company) => (
                    <tr
                      key={company.id}
                      className={selectedCompany?.id === company.id ? styles.activeRow : ''}
                      onClick={() => setSelectedCompanyId(company.id)}
                    >
                      <td>
                        <div className={styles.companyCell}>
                          <div className={styles.companyAvatar}>
                            <Building2 size={16} />
                          </div>
                          <div>
                            <div className={styles.companyName}>{company.name}</div>
                            <div className={styles.companyMeta}>{company.country || 'Country missing'} . {company.industry || 'Industry missing'}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.regValue}>{company.registrationNumber || 'Not provided'}</div>
                        <div className={styles.smallMeta}>{company.emailDomain || 'No business domain'}</div>
                      </td>
                      <td>
                        <div className={styles.ownerName}>{company.owner.name}</div>
                        <div className={styles.smallMeta}>{company.owner.email}</div>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[`status${company.status}`]}`}>{company.status}</span>
                      </td>
                      <td>
                        <div className={styles.actionRow}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ fontSize: '12px', padding: '7px 10px' }}
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedCompanyId(company.id)
                            }}
                          >
                            <Eye size={14} /> View
                          </button>
                          {getActionButtons(company).map((action) => {
                            const isApprove = action === 'APPROVE'
                            const isBusy = updatingAction === `${company.id}:${action}`
                            return (
                              <button
                                key={action}
                                type="button"
                                className={isApprove ? 'btn-primary' : 'btn-danger'}
                                style={{ fontSize: '12px', padding: '7px 10px' }}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void handleAction(company.id, action)
                                }}
                                disabled={Boolean(updatingAction)}
                              >
                                {isBusy ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : isApprove ? (
                                  <CheckCircle2 size={14} />
                                ) : (
                                  <XCircle size={14} />
                                )}
                                <span>{action === 'APPROVE' ? 'Approve' : action === 'REJECT' ? 'Reject' : 'Disable'}</span>
                              </button>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className={styles.emptyCell}>
                      No companies matched this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className={styles.detailsHeader}>
            <div className={styles.tableTitle}>Registration details</div>
            {selectedCompany && <span className={`${styles.statusBadge} ${styles[`status${selectedCompany.status}`]}`}>{selectedCompany.status}</span>}
          </div>

          {!selectedCompany ? (
            <div className={styles.detailsEmpty}>Select a company to inspect its registration details.</div>
          ) : (
            <div className={styles.detailsBody}>
              <div className={styles.detailsBlock}>
                <div className={styles.detailLabel}>Company name</div>
                <div className={styles.detailValue}>{selectedCompany.name}</div>
              </div>
              <div className={styles.detailsGrid}>
                <div className={styles.detailsBlock}>
                  <div className={styles.detailLabel}>Registration number</div>
                  <div className={styles.detailValue}>{selectedCompany.registrationNumber || 'Not provided'}</div>
                </div>
                <div className={styles.detailsBlock}>
                  <div className={styles.detailLabel}>Company type</div>
                  <div className={styles.detailValue}>{selectedCompany.companyType}</div>
                </div>
                <div className={styles.detailsBlock}>
                  <div className={styles.detailLabel}>Country</div>
                  <div className={styles.detailValue}>{selectedCompany.country || 'Not provided'}</div>
                </div>
                <div className={styles.detailsBlock}>
                  <div className={styles.detailLabel}>Industry</div>
                  <div className={styles.detailValue}>{selectedCompany.industry || 'Not provided'}</div>
                </div>
              </div>

              <div className={styles.detailsBlock}>
                <div className={styles.detailLabel}>Owner</div>
                <div className={styles.detailValue}>{selectedCompany.owner.name}</div>
                <div className={styles.detailSubtext}>{selectedCompany.owner.email}</div>
              </div>

              <div className={styles.detailsGrid}>
                <div className={styles.detailsBlock}>
                  <div className={styles.detailLabel}>Submitted</div>
                  <div className={styles.detailValue}>{formatDate(selectedCompany.createdAt)}</div>
                </div>
                <div className={styles.detailsBlock}>
                  <div className={styles.detailLabel}>Last reviewed</div>
                  <div className={styles.detailValue}>{formatDate(selectedCompany.reviewedAt)}</div>
                </div>
              </div>

              <div className={styles.detailsBlock}>
                <div className={styles.detailLabel}>Reviewer</div>
                <div className={styles.detailValue}>{selectedCompany.reviewedBy?.name ?? 'No reviewer yet'}</div>
                <div className={styles.detailSubtext}>{selectedCompany.reviewedBy?.email ?? 'Approval action still pending'}</div>
              </div>

              <div className={styles.detailsBlock}>
                <div className={styles.detailLabel}>Review note</div>
                <div className={styles.detailSubtext}>{selectedCompany.reviewNote || 'No note recorded.'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
