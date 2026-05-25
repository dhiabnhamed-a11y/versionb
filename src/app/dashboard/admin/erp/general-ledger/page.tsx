'use client'

import { useEffect, useState, useCallback } from 'react'
import { BookOpen, Plus, X, Check, Loader2, AlertCircle } from 'lucide-react'

// --- Types ---

type Account = {
  id: string
  code: string
  name: string
  type: string
  normalBalance: string
  category?: { code: string; name: string; rootType: string } | null
}

type JournalLine = {
  id: string
  accountId: string
  lineNumber: number
  description: string | null
  debit: number
  credit: number
  account: { id: string; code: string; name: string; type: string; normalBalance: string }
}

type JournalEntry = {
  id: string
  entryNumber: string
  status: string
  transactionDate: string
  memo: string | null
  totalDebit: number
  totalCredit: number
  sourceType: string
  postedAt: string | null
  createdAt: string
  lines: JournalLine[]
}

type FetchState = 'idle' | 'loading' | 'error'

// --- Form types ---

type FormLine = {
  key: string
  accountId: string
  description: string
  debit: string
  credit: string
}

// --- Helpers ---

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCurrency(n: number | string) {
  const num = typeof n === 'string' ? parseFloat(n) : n
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(num)
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: '#1e293b', color: '#94a3b8' },
  PENDING_APPROVAL: { bg: '#3b82f614', color: '#60a5fa' },
  APPROVED: { bg: '#a855f714', color: '#a855f7' },
  POSTED: { bg: '#22c55e14', color: '#22c55e' },
  REVERSED: { bg: '#ef444414', color: '#ef4444' },
  VOID: { bg: '#ef444414', color: '#ef4444' },
}

// --- Account Picker ---

function AccountPicker({ accounts, value, onChange }: { accounts: Account[]; value: string; onChange: (id: string) => void }) {
  const selected = accounts.find((a) => a.id === value)
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '6px 8px',
          borderRadius: '6px',
          border: '1px solid #334155',
          background: '#0f172a',
          color: '#f1f5f9',
          fontSize: '12px',
          fontFamily: 'inherit',
        }}
      >
        <option value="">Select account...</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} - {a.name}
          </option>
        ))}
      </select>
      {selected && (
        <span style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', display: 'block' }}>
          {selected.type} ({selected.normalBalance})
        </span>
      )}
    </div>
  )
}

// --- Main Page ---

export default function GeneralLedgerPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [fetchState, setFetchState] = useState<FetchState>('loading')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [postingId, setPostingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10))
  const [formMemo, setFormMemo] = useState('')
  const [formCurrency, setFormCurrency] = useState('USD')
  const [formPostNow, setFormPostNow] = useState(true)
  const [formLines, setFormLines] = useState<FormLine[]>([
    { key: crypto.randomUUID(), accountId: '', description: '', debit: '', credit: '' },
    { key: crypto.randomUUID(), accountId: '', description: '', debit: '', credit: '' },
  ])

  const fetchEntries = useCallback(async () => {
    setFetchState('loading')
    try {
      const res = await fetch('/api/v1/erp/journal-entries', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch')
      const body = await res.json()
      setEntries(body.data ?? [])
      setFetchState('idle')
    } catch {
      setFetchState('error')
    }
  }, [])

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/erp/accounts', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch accounts')
      const body = await res.json()
      setAccounts(body.data ?? [])
    } catch {
      /* accounts can be empty */
    }
  }, [])

  useEffect(() => {
    void fetchEntries()
    void fetchAccounts()
  }, [fetchEntries, fetchAccounts])

  // --- Form helpers ---

  const totalDebit = formLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)
  const totalCredit = formLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.001
  const hasEmptyLine = formLines.some((l) => !l.accountId || (!l.debit && !l.credit))

  function addLine() {
    setFormLines((prev) => [...prev, { key: crypto.randomUUID(), accountId: '', description: '', debit: '', credit: '' }])
  }

  function removeLine(key: string) {
    if (formLines.length <= 2) return
    setFormLines((prev) => prev.filter((l) => l.key !== key))
  }

  function updateLine(key: string, field: keyof FormLine, value: string) {
    setFormLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)))
  }

  function resetForm() {
    setFormDate(new Date().toISOString().slice(0, 10))
    setFormMemo('')
    setFormCurrency('USD')
    setFormPostNow(true)
    setFormLines([
      { key: crypto.randomUUID(), accountId: '', description: '', debit: '', credit: '' },
      { key: crypto.randomUUID(), accountId: '', description: '', debit: '', credit: '' },
    ])
    setError(null)
  }

  async function handleSubmit() {
    if (hasEmptyLine || !balanced) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/erp/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionDate: formDate,
          memo: formMemo || undefined,
          currency: formCurrency,
          postNow: formPostNow,
          lines: formLines.map((l) => ({
            accountId: l.accountId,
            description: l.description || undefined,
            debit: l.debit || null,
            credit: l.credit || null,
          })),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || body.data?.message || 'Failed to create journal entry')
      }
      resetForm()
      setShowForm(false)
      void fetchEntries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePost(entryId: string) {
    setPostingId(entryId)
    try {
      const res = await fetch(`/api/v1/erp/journal-entries/${entryId}/post`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to post')
      void fetchEntries()
    } catch {
      setError('Failed to post journal entry')
    } finally {
      setPostingId(null)
    }
  }

  // --- Render ---

  if (fetchState === 'loading') {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: '#64748b' }} />
      </div>
    )
  }

  if (fetchState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-3" style={{ minHeight: '60vh', color: '#64748b' }}>
        <AlertCircle size={32} />
        <p>Could not load journal entries. Make sure the ERP migration has been applied.</p>
        <button onClick={() => void fetchEntries()} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px' }}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="dashboard-header-row">
        <div>
          <h1 className="page-heading flex items-center gap-2.5">
            <BookOpen size={24} strokeWidth={1.85} style={{ color: 'var(--accent)' }} /> General Ledger
          </h1>
          <p className="page-sub">Chart of accounts, journal entries, and trial balance</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm) }}
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            border: 'none',
            background: showForm ? '#1e293b' : 'linear-gradient(135deg, #3b82f6, #6366f1)',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'background 0.15s',
          }}
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'New Journal Entry'}
        </button>
      </div>

      {/* New Journal Entry Form */}
      {showForm && (
        <div
          style={{
            border: '1px solid #334155',
            borderRadius: '12px',
            background: '#0f172a',
            padding: '20px',
            marginBottom: '24px',
          }}
        >
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>New Journal Entry</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '8px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>Date</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #334155', background: '#090d14', color: '#f1f5f9', fontSize: '13px', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>Currency</label>
              <select value={formCurrency} onChange={(e) => setFormCurrency(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #334155', background: '#090d14', color: '#f1f5f9', fontSize: '13px', fontFamily: 'inherit' }}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="TND">TND</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: '#94a3b8' }}>
                <input type="checkbox" checked={formPostNow} onChange={(e) => setFormPostNow(e.target.checked)}
                  style={{ accentColor: '#3b82f6' }} />
                Post now
              </label>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>Memo</label>
            <input type="text" value={formMemo} onChange={(e) => setFormMemo(e.target.value)} placeholder="Brief description of this entry..."
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #334155', background: '#090d14', color: '#f1f5f9', fontSize: '13px', fontFamily: 'inherit', marginBottom: '16px' }} />
          </div>

          {/* Lines Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid #1e293b' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', minWidth: '200px' }}>Account</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', minWidth: '140px' }}>Description</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', minWidth: '100px' }}>Debit</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', minWidth: '100px' }}>Credit</th>
                  <th style={{ padding: '6px 8px', width: '30px' }} />
                </tr>
              </thead>
              <tbody>
                {formLines.map((line) => (
                  <tr key={line.key} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <AccountPicker accounts={accounts} value={line.accountId} onChange={(v) => updateLine(line.key, 'accountId', v)} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input type="text" value={line.description} onChange={(e) => updateLine(line.key, 'description', e.target.value)} placeholder="Line description"
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #1e293b', background: '#090d14', color: '#f1f5f9', fontSize: '12px', fontFamily: 'inherit' }} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input type="number" step="0.01" min="0" value={line.debit} onChange={(e) => updateLine(line.key, 'debit', e.target.value)} placeholder="0.00"
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #1e293b', background: line.credit && parseFloat(line.credit) > 0 ? '#1a0a0a' : '#090d14', color: '#f1f5f9', fontSize: '12px', fontFamily: 'inherit', textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input type="number" step="0.01" min="0" value={line.credit} onChange={(e) => updateLine(line.key, 'credit', e.target.value)} placeholder="0.00"
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #1e293b', background: line.debit && parseFloat(line.debit) > 0 ? '#0a1a0a' : '#090d14', color: '#f1f5f9', fontSize: '12px', fontFamily: 'inherit', textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      {formLines.length > 2 && (
                        <button onClick={() => removeLine(line.key)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', fontSize: '14px', lineHeight: 1 }}>
                          <X size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <button onClick={addLine}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px dashed #334155', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>
              + Add line
            </button>
            <div style={{ textAlign: 'right', fontSize: '13px' }}>
              <span style={{ color: balanced ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                {formatCurrency(totalDebit)} {balanced ? '=' : '≠'} {formatCurrency(totalCredit)}
              </span>
              {!balanced && <span style={{ color: '#ef4444', fontSize: '11px', display: 'block' }}>Debits and credits must be equal</span>}
            </div>
          </div>

          {error && (
            <div style={{ marginTop: '12px', padding: '10px', borderRadius: '8px', background: '#ef444414', border: '1px solid #ef444440', color: '#fca5a5', fontSize: '12px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button onClick={resetForm}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>
              Reset
            </button>
            <button onClick={() => void handleSubmit()} disabled={hasEmptyLine || !balanced || submitting}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                background: hasEmptyLine || !balanced ? '#334155' : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                color: hasEmptyLine || !balanced ? '#64748b' : '#fff',
                cursor: hasEmptyLine || !balanced ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {submitting ? 'Creating...' : formPostNow ? 'Create & Post' : 'Create Draft'}
            </button>
          </div>
        </div>
      )}

      {/* Entries Table */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2" style={{ minHeight: '30vh', color: '#64748b', textAlign: 'center' }}>
          <BookOpen size={40} strokeWidth={1.2} />
          <p style={{ fontSize: '14px' }}>No journal entries yet</p>
          <p style={{ fontSize: '12px' }}>Create your first entry to populate the general ledger.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Entry #</th>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Memo</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Debit</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Credit</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '10px 8px', fontWeight: 600, color: '#f1f5f9', fontFamily: 'monospace', fontSize: '12px' }}>{entry.entryNumber}</td>
                  <td style={{ padding: '10px 8px', color: '#94a3b8', fontSize: '12px' }}>{formatDate(entry.transactionDate)}</td>
                  <td style={{ padding: '10px 8px', color: '#cbd5e1', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.memo || '—'}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: '#22c55e', fontSize: '12px', fontFamily: 'monospace' }}>{formatCurrency(entry.totalDebit)}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: '#f59e0b', fontSize: '12px', fontFamily: 'monospace' }}>{formatCurrency(entry.totalCredit)}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      ...(STATUS_STYLES[entry.status] ?? { bg: '#1e293b', color: '#94a3b8' }),
                      background: STATUS_STYLES[entry.status]?.bg ?? '#1e293b',
                      color: STATUS_STYLES[entry.status]?.color ?? '#94a3b8',
                    }}>
                      {entry.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    {entry.status === 'APPROVED' && (
                      <button onClick={() => void handlePost(entry.id)} disabled={postingId === entry.id}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#22c55e24', color: '#22c55e', cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {postingId === entry.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Post
                      </button>
                    )}
                    {entry.status === 'DRAFT' && (
                      <span style={{ fontSize: '11px', color: '#64748b' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
