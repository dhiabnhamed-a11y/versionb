'use client'

import { useEffect, useState } from 'react'
import { Download, FileCheck2, Loader2, ShieldCheck } from 'lucide-react'

import styles from './LegalAdminClient.module.css'

type ActiveVersion = {
  documentType: string
  version: string
  title: string
  contentHash: string
  requiresReacceptance: boolean
  effectiveAt: string
}

type RecentConsent = {
  id: string
  userName: string
  userEmail: string
  companyName: string | null
  consentType: string
  documentVersion: string
  acceptedAt: string
  ipAddress: string | null
  locale: string | null
  consentHash: string
}

type Snapshot = {
  activeVersions: ActiveVersion[]
  counts: Record<string, number>
  recentConsents: RecentConsent[]
}

const documentTypes = [
  'TERMS_OF_SERVICE',
  'PRIVACY_POLICY',
  'COOKIE_POLICY',
  'AI_USAGE_DISCLOSURE',
  'MARKETING_EMAILS',
] as const

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function LegalAdminClient() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    documentType: 'TERMS_OF_SERVICE',
    version: '2026.05',
    title: '',
    summary: '',
    requiresReacceptance: true,
  })

  async function loadSnapshot() {
    setLoading(true)
    setError('')
    const response = await fetch('/api/legal/admin', { cache: 'no-store' })
    const payload = (await response.json()) as Snapshot & { error?: string }

    if (!response.ok) {
      setError(payload.error || 'Unable to load legal controls.')
      setLoading(false)
      return
    }

    setSnapshot(payload)
    setLoading(false)
  }

  useEffect(() => {
    let active = true

    async function loadInitialSnapshot() {
      const response = await fetch('/api/legal/admin', { cache: 'no-store' })
      const payload = (await response.json()) as Snapshot & { error?: string }

      if (!active) return

      if (!response.ok) {
        setError(payload.error || 'Unable to load legal controls.')
        setLoading(false)
        return
      }

      setSnapshot(payload)
      setLoading(false)
    }

    void loadInitialSnapshot()

    return () => {
      active = false
    }
  }, [])

  async function publishVersion(event: React.FormEvent) {
    event.preventDefault()
    setPublishing(true)
    setError('')

    const response = await fetch('/api/legal/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const payload = (await response.json()) as { error?: string }
    setPublishing(false)

    if (!response.ok) {
      setError(payload.error || 'Unable to publish legal document version.')
      return
    }

    await loadSnapshot()
  }

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <div>
          <div className={styles.kicker}>Legal Ops</div>
          <h1 className="page-heading">Consent and policy control center</h1>
          <p className="page-sub">
            Manage active legal versions, force re-acceptance when policies change, and export immutable signup consent evidence.
          </p>
        </div>

        <div className={styles.controls}>
          <a className="btn-secondary" href="/api/legal/admin/export">
            <Download size={16} />
            Export consent logs
          </a>
          <button className="btn-secondary" type="button" onClick={loadSnapshot} disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            Refresh
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.grid}>
        <div className="card">
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>Active versions</div>
              <p className={styles.muted}>These server-side versions are used when signup consent is recorded.</p>
            </div>
          </div>

          <div className={styles.versionList}>
            {loading ? (
              <div className={styles.muted}>Loading active legal versions...</div>
            ) : (
              snapshot?.activeVersions.map((version) => (
                <div key={version.documentType} className={styles.versionRow}>
                  <div className={styles.rowTop}>
                    <div className={styles.rowTitle}>{version.title}</div>
                    <span className={styles.badge}>{version.version}</span>
                  </div>
                  <div className={styles.muted}>
                    {version.documentType} . Effective {formatDate(version.effectiveAt)}
                  </div>
                  <div className={styles.hash}>{version.contentHash}</div>
                  {version.requiresReacceptance && <span className={`${styles.badge} ${styles.dangerBadge}`}>Re-acceptance required</span>}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>Publish new version</div>
              <p className={styles.muted}>Publishing deactivates the prior active version for the selected document type.</p>
            </div>
          </div>

          <form className={styles.publishForm} onSubmit={publishVersion}>
            <div className={styles.publishGrid}>
              <label>
                <span className={styles.muted}>Document type</span>
                <select
                  className="input"
                  value={form.documentType}
                  onChange={(event) => setForm((current) => ({ ...current, documentType: event.target.value }))}
                >
                  {documentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={styles.muted}>Version</span>
                <input
                  className="input"
                  value={form.version}
                  onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))}
                  placeholder="2026.06"
                  required
                />
              </label>
            </div>
            <label>
              <span className={styles.muted}>Title</span>
              <input
                className="input"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Leave blank to use the default document title"
              />
            </label>
            <label>
              <span className={styles.muted}>Change summary</span>
              <textarea
                className="input"
                value={form.summary}
                onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                rows={3}
                placeholder="Summarize material policy changes for the audit trail."
              />
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={form.requiresReacceptance}
                onChange={(event) => setForm((current) => ({ ...current, requiresReacceptance: event.target.checked }))}
              />
              Force users missing this active version to re-accept.
            </label>
            <button className="btn-primary" type="submit" disabled={publishing}>
              {publishing ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />}
              Publish version
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle}>Recent acceptance history</div>
            <p className={styles.muted}>Immutable consent records with version, timestamp, network evidence, locale, and integrity hash.</p>
          </div>
        </div>

        <div className={styles.consentList}>
          {loading ? (
            <div className={styles.muted}>Loading acceptance history...</div>
          ) : (
            snapshot?.recentConsents.map((consent) => (
              <div key={consent.id} className={styles.consentRow}>
                <div className={styles.rowTop}>
                  <div className={styles.rowTitle}>{consent.userName}</div>
                  <span className={styles.badge}>{consent.consentType}</span>
                </div>
                <div className={styles.muted}>
                  {consent.userEmail} . {consent.companyName ?? 'No company'} . Version {consent.documentVersion} .{' '}
                  {formatDate(consent.acceptedAt)}
                </div>
                <div className={styles.muted}>
                  IP {consent.ipAddress ?? 'not captured'} . Locale {consent.locale ?? 'not captured'}
                </div>
                <div className={styles.hash}>{consent.consentHash}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
