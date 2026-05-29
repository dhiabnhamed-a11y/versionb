'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { downloadPdfFromApi } from '@/lib/download-response'
import { formatInvoiceMoney, getInvoiceStatusLabel, INVOICE_STATUSES, type InvoiceStatus } from '@/lib/invoices'

type Locale = 'en' | 'ar'

type InvoiceItem = {
  id?: string
  description: string
  quantity: number
  unitPrice: number
}

type Invoice = {
  id: string
  clientId?: string | null
  invoiceNumber: string
  clientName: string
  clientEmail?: string | null
  clientAddress?: string | null
  status: InvoiceStatus
  currency: string
  locale: Locale
  issueDate: string
  dueDate?: string | null
  notes?: string | null
  taxRate: number
  subtotal: number
  taxTotal: number
  total: number
  createdAt: string
  items: InvoiceItem[]
}

type InvoiceForm = {
  clientId: string
  clientName: string
  clientEmail: string
  clientAddress: string
  currency: string
  locale: Locale
  issueDate: string
  dueDate: string
  notes: string
  taxRate: number
  items: InvoiceItem[]
}

type ClientOption = {
  id: string
  companyName: string
  contactPerson?: string | null
  email?: string | null
  address?: string | null
}

const INVOICE_REALTIME_EVENTS = ['invoice_created', 'invoice_updated', 'invoice_deleted'] as const

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function emptyForm(locale: Locale, client?: ClientOption | null): InvoiceForm {
  return {
    clientId: client?.id ?? '',
    clientName: client?.companyName ?? '',
    clientEmail: client?.email ?? '',
    clientAddress: client?.address ?? '',
    currency: 'USD',
    locale,
    issueDate: todayInput(),
    dueDate: '',
    notes: '',
    taxRate: 0,
    items: [{ description: '', quantity: 1, unitPrice: 0 }],
  }
}

function dateInput(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : ''
}

function calculateTotals(items: InvoiceItem[], taxRate: number) {
  const subtotal = items.reduce((s, i) => s + Math.max(Number(i.quantity) || 0, 0) * Math.max(Number(i.unitPrice) || 0, 0), 0)
  const taxTotal = subtotal * (Math.max(Number(taxRate) || 0, 0) / 100)
  return { subtotal, taxTotal, total: subtotal + taxTotal }
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280', sent: '#3b82f6', paid: '#10b981', overdue: '#ef4444',
  refunded: '#8b5cf6', archived: '#6b7280',
}

const STATUS_BG: Record<string, string> = {
  draft: 'rgba(107,114,128,0.1)', sent: 'rgba(59,130,246,0.1)', paid: 'rgba(16,185,129,0.1)',
  overdue: 'rgba(239,68,68,0.1)', refunded: 'rgba(139,92,246,0.1)', archived: 'rgba(107,114,128,0.1)',
}

const s = {
  page: { padding: '0 4px' },
  headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' as const },
  headerLeft: {},
  title: { fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' },
  subtitle: { fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' },
  headerActions: { display: 'flex', gap: '8px', alignItems: 'center' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' },
  statCard: {
    background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px 20px',
    transition: 'box-shadow 0.15s',
  },
  statLabel: { fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  statValue: { fontSize: '22px', fontWeight: 700, color: '#0f172a', marginTop: '4px' },
  statSub: { fontSize: '12px', color: '#94a3b8', marginTop: '2px' },
  filterRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' as const, marginBottom: '16px' },
  filterBtn: (active: boolean) => ({
    padding: '6px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', background: active ? '#3b82f6' : '#fff',
    color: active ? '#fff' : '#475569', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
    transition: 'all 0.12s',
  }),
  errorBar: {
    padding: '10px 16px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
    color: '#ef4444', fontSize: '13px', fontWeight: 600, marginBottom: '16px',
  },
  invoiceCard: {
    background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px 20px',
    transition: 'box-shadow 0.15s', marginBottom: '8px',
  },
  invoiceTop: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' as const,
  },
  invoiceMeta: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' as const },
  invoiceNum: { fontSize: '14px', fontWeight: 700, color: '#0f172a' },
  statusBadge: (status: string) => ({
    fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '5px',
    color: STATUS_COLORS[status] || '#6b7280', background: STATUS_BG[status] || 'rgba(107,114,128,0.1)',
  }),
  invoiceClient: { fontSize: '13px', fontWeight: 500, color: '#475569', marginTop: '4px' },
  invoiceDue: { fontSize: '12px', color: '#94a3b8', marginTop: '2px' },
  invoiceActions: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' as const },
  actionBtn: (color = '#475569') => ({
    padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff',
    color, fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex',
    alignItems: 'center', gap: '5px', transition: 'all 0.12s',
  }),
  amount: { textAlign: 'right' as const },
  amountValue: (status: string) => ({
    fontSize: '16px', fontWeight: 700, color: status === 'overdue' ? '#ef4444' : status === 'paid' ? '#10b981' : '#0f172a',
  }),
  amountItems: { fontSize: '11px', color: '#94a3b8', fontWeight: 500, marginTop: '1px' },
  empty: {
    textAlign: 'center' as const, padding: '60px 20px', background: '#fff', borderRadius: '10px',
    border: '1px solid #e2e8f0',
  },
  emptyIcon: { color: '#cbd5e1', marginBottom: '12px' },
  emptyTitle: { fontSize: '15px', fontWeight: 600, color: '#475569', marginBottom: '4px' },
  emptyHint: { fontSize: '13px', color: '#94a3b8', maxWidth: '360px', margin: '0 auto 20px' },
  overlay: {
    position: 'fixed' as const, inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px',
  },
  modal: {
    background: '#fff', borderRadius: '12px', width: 'min(96vw, 920px)', maxHeight: '90vh',
    overflowY: 'auto' as const, boxShadow: '0 25px 50px rgba(0,0,0,0.2)', padding: '24px',
  },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '20px' },
  modalTitle: { fontSize: '16px', fontWeight: 700, color: '#0f172a' },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '6px', borderRadius: '6px',
  },
  formGrid: { display: 'grid', gap: '14px', gridTemplateColumns: '1fr 1fr', marginBottom: '20px' },
  formFull: { gridColumn: '1 / -1' },
  label: { display: 'grid', gap: '5px', fontSize: '11px', fontWeight: 600, color: '#475569' },
  labelSpan: { fontSize: '11px', fontWeight: 600, color: '#475569' },
  input: {
    padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px',
    color: '#0f172a', background: '#fff', fontFamily: 'inherit', outline: 'none',
  },
  select: {
    padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px',
    color: '#0f172a', background: '#fff', fontFamily: 'inherit', outline: 'none',
  },
  textarea: {
    padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px',
    color: '#0f172a', background: '#fff', fontFamily: 'inherit', outline: 'none', resize: 'vertical' as const, minHeight: '60px',
  },
  itemsSection: {
    borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '16px',
  },
  itemsHeader: {
    display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 36px', gap: '8px',
    padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
    fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.04em',
  },
  itemsBody: { padding: '10px 14px', display: 'grid', gap: '8px' },
  itemRow: {
    display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 36px', gap: '8px', alignItems: 'center',
  },
  itemTotal: {
    padding: '8px 10px', fontSize: '13px', fontWeight: 700, color: '#0f172a',
    background: '#f8fafc', borderRadius: '6px', textAlign: 'right' as const,
  },
  removeBtn: {
    padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff',
    cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  itemsFooter: { padding: '10px 14px', borderTop: '1px solid #e2e8f0' },
  addItemBtn: {
    padding: '6px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff',
    color: '#3b82f6', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex',
    alignItems: 'center', gap: '5px',
  },
  totalsGrid: { display: 'grid', gap: '16px', gridTemplateColumns: '1fr 280px', alignItems: 'start', marginBottom: '20px' },
  totalsBox: {
    borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px', background: '#f8fafc',
  },
  taxLabel: { display: 'grid', gap: '5px', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '12px' },
  totalRow: { display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px', padding: '4px 0' },
  totalValue: { fontWeight: 600, color: '#0f172a' },
  grandTotal: {
    display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '16px', fontWeight: 700,
    color: '#0f172a', borderTop: '1px solid #e2e8f0', marginTop: '8px', paddingTop: '8px',
  },
  modalActions: {
    display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #e2e8f0',
    paddingTop: '16px',
  },
  btnPrimary: {
    padding: '9px 20px', borderRadius: '6px', border: 'none', background: '#3b82f6',
    color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex',
    alignItems: 'center', gap: '6px',
  },
  btnSecondary: {
    padding: '9px 20px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff',
    color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  btnDanger: {
    padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)', background: '#fff',
    color: '#ef4444', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex',
    alignItems: 'center', gap: '5px',
  },
  btnDisabled: {
    padding: '9px 20px', borderRadius: '6px', border: 'none', background: '#94a3b8',
    color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'not-allowed', opacity: 0.6,
  },
  shimmer: {
    background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', height: '72px',
    marginBottom: '8px', animation: 'pulse 1.5s ease-in-out infinite',
  },
  ltr: { direction: 'ltr' as const },
  rtl: { direction: 'rtl' as const },
}

export default function ErpInvoicesPage() {
  const [locale, setLocale] = useState<Locale>('en')
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloadId, setDownloadId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Invoice | null>(null)
  const [form, setForm] = useState<InvoiceForm>(emptyForm('en'))
  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  const loadInvoices = useCallback(async () => {
    const res = await fetch(filter === 'all' ? '/api/invoices' : `/api/invoices?status=${filter}`, { cache: 'no-store' })
    if (!res.ok) return
    const body = await res.json()
    setInvoices(Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [])
  }, [filter])

  const loadClients = useCallback(async () => {
    const res = await fetch('/api/clients?pageSize=100', { cache: 'no-store' })
    if (!res.ok) return
    const body = await res.json()
    setClients(Array.isArray(body?.items) ? body.items : [])
  }, [])

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      Promise.all([loadInvoices(), loadClients()]).catch(() => {
        if (active) setError('Invoices could not be loaded.')
      }).finally(() => { if (active) setLoading(false) })
    }, 0)
    return () => { active = false; clearTimeout(timer) }
  }, [loadClients, loadInvoices])

  useRealtimeSubscription(INVOICE_REALTIME_EVENTS, () => { loadInvoices().catch(() => {}) }, 300)

  const totals = useMemo(() => calculateTotals(form.items, form.taxRate), [form.items, form.taxRate])
  const paidTotal = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const outstandingTotal = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total, 0)
  const currency = invoices[0]?.currency ?? form.currency

  function openCreate() {
    setEditing(null); setForm(emptyForm(locale)); setError(null); setModalOpen(true)
  }

  function openEdit(invoice: Invoice) {
    setEditing(invoice)
    setForm({
      clientName: invoice.clientName, clientId: invoice.clientId ?? '',
      clientEmail: invoice.clientEmail ?? '', clientAddress: invoice.clientAddress ?? '',
      currency: invoice.currency, locale: invoice.locale,
      issueDate: dateInput(invoice.issueDate), dueDate: dateInput(invoice.dueDate),
      notes: invoice.notes ?? '', taxRate: invoice.taxRate,
      items: invoice.items.length ? invoice.items : [{ description: '', quantity: 1, unitPrice: 0 }],
    })
    setError(null); setModalOpen(true)
  }

  function selectClient(id: string) {
    const c = clients.find((x) => x.id === id)
    setForm((f) => ({ ...f, clientId: id, clientName: c?.companyName ?? f.clientName, clientEmail: c?.email ?? f.clientEmail, clientAddress: c?.address ?? f.clientAddress }))
  }

  function updateItem(index: number, patch: Partial<InvoiceItem>) {
    setForm((f) => ({ ...f, items: f.items.map((item, i) => i === index ? { ...item, ...patch } : item) }))
  }

  function addItem() { setForm((f) => ({ ...f, items: [...f.items, { description: '', quantity: 1, unitPrice: 0 }] })) }
  function removeItem(index: number) { setForm((f) => ({ ...f, items: f.items.length === 1 ? f.items : f.items.filter((_, i) => i !== index) })) }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null)
    const res = await fetch(editing ? `/api/invoices/${editing.id}` : '/api/invoices', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const body = await res.json()
    setSaving(false)
    if (!res.ok) { setError(body?.error || 'Could not save invoice.'); return }
    setModalOpen(false); await loadInvoices()
  }

  async function updateStatus(invoice: Invoice, status: InvoiceStatus) {
    await fetch(`/api/invoices/${invoice.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    await loadInvoices()
  }

  async function deleteInvoice(invoice: Invoice) {
    const confirm = window.prompt(`Type "delete" to permanently remove ${invoice.invoiceNumber}.`)
    if (confirm?.trim().toLowerCase() !== 'delete') { setError('Type "delete" to confirm.'); return }
    setError(null)
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: confirm }),
    })
    if (!res.ok) { const b = await res.json().catch(() => ({})); setError(b?.error || 'Could not delete.'); return }
    await loadInvoices()
  }

  async function downloadPdf(invoice: Invoice) {
    setDownloadId(invoice.id); setError(null)
    try {
      await downloadPdfFromApi(`/api/invoices/${invoice.id}/pdf`, invoice.invoiceNumber, { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'PDF download failed.')
    } finally { setDownloadId(null) }
  }

  return (
    <div style={{ ...s.page, ...(dir === 'rtl' ? s.rtl : s.ltr) }}>
      {/* Header */}
      <div style={s.headerRow}>
        <div style={s.headerLeft}>
          <h1 style={s.title}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Invoices
          </h1>
          <p style={s.subtitle}>Create, manage, and download professional invoices for your clients.</p>
        </div>
        <div style={s.headerActions}>
          <button onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')} style={s.actionBtn()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
            </svg>
            {locale === 'en' ? 'العربية' : 'English'}
          </button>
          <button onClick={openCreate} style={s.btnPrimary}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New Invoice
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statLabel}>Total Invoices</div>
          <div style={s.statValue}>{invoices.length}</div>
          <div style={s.statSub}>All time</div>
        </div>
        <div style={s.statCard} onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(16,185,129,0.1)'}
          onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}>
          <div style={s.statLabel}>Paid</div>
          <div style={{ ...s.statValue, color: '#10b981' }}>{formatInvoiceMoney(paidTotal, currency, locale)}</div>
          <div style={s.statSub}>Collected revenue</div>
        </div>
        <div style={s.statCard} onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(245,158,11,0.1)'}
          onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}>
          <div style={s.statLabel}>Outstanding</div>
          <div style={{ ...s.statValue, color: '#f59e0b' }}>{formatInvoiceMoney(outstandingTotal, currency, locale)}</div>
          <div style={s.statSub}>Sent / Overdue</div>
        </div>
      </div>

      {/* Filter */}
      <div style={s.filterRow}>
        {(['all', ...INVOICE_STATUSES] as Array<InvoiceStatus | 'all'>).map((status) => (
          <button key={status} onClick={() => setFilter(status)} style={s.filterBtn(filter === status)}>
            {status === 'all' ? 'All' : getInvoiceStatusLabel(status, locale)}
          </button>
        ))}
      </div>

      {error && <div style={s.errorBar}>{error}</div>}

      {/* List */}
      {loading ? (
        <div>{[0, 1, 2].map((i) => <div key={i} style={s.shimmer} />)}</div>
      ) : invoices.length === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyIcon}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div style={s.emptyTitle}>No invoices yet</div>
          <div style={s.emptyHint}>Create your first invoice and send it to a client. All invoices can be downloaded as PDF.</div>
          <button onClick={openCreate} style={s.btnPrimary}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Create Invoice
          </button>
        </div>
      ) : (
        <div>
          {invoices.map((invoice) => (
            <div key={invoice.id} style={s.invoiceCard}
              onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
              onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={s.invoiceTop}>
                <div>
                  <div style={s.invoiceMeta}>
                    <span style={s.invoiceNum}>{invoice.invoiceNumber}</span>
                    <span style={s.statusBadge(invoice.status)}>
                      {getInvoiceStatusLabel(invoice.status, locale)}
                    </span>
                  </div>
                  <div style={s.invoiceClient}>{invoice.clientName}</div>
                  <div style={s.invoiceDue}>
                    {invoice.dueDate ? `Due ${new Date(invoice.dueDate).toLocaleDateString(locale === 'ar' ? 'ar-TN' : 'en-US')}` : 'No due date'}
                  </div>
                </div>
                <div style={s.invoiceActions}>
                  <div style={s.amount}>
                    <div style={s.amountValue(invoice.status)}>{formatInvoiceMoney(invoice.total, invoice.currency, locale)}</div>
                    <div style={s.amountItems}>{invoice.items.length} item{invoice.items.length !== 1 ? 's' : ''}</div>
                  </div>
                  {invoice.status === 'draft' && (
                    <button onClick={() => updateStatus(invoice, 'sent')} style={s.actionBtn('#3b82f6')}
                      onMouseOver={(e) => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff' }}
                      onMouseOut={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#3b82f6' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                      Send
                    </button>
                  )}
                  {invoice.status !== 'paid' && invoice.status !== 'archived' && (
                    <button onClick={() => updateStatus(invoice, 'paid')} style={s.actionBtn('#10b981')}
                      onMouseOver={(e) => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#fff' }}
                      onMouseOut={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#10b981' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Paid
                    </button>
                  )}
                  <button onClick={() => downloadPdf(invoice)} disabled={downloadId === invoice.id} style={s.actionBtn()}
                    onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc' }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#fff' }}
                  >
                    {downloadId === invoice.id ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                        <path d="M12 2a10 10 0 019.95 9" />
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    )}
                    PDF
                  </button>
                  <button onClick={() => openEdit(invoice)} style={s.actionBtn()}
                    onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc' }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#fff' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                  </button>
                  <button onClick={() => deleteInvoice(invoice)} style={s.btnDanger}
                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#fff' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div style={s.modal} dir={dir}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>{editing ? 'Edit Invoice' : 'Create Invoice'}</h2>
              <button onClick={() => setModalOpen(false)} style={s.closeBtn}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={save}>
              <div style={s.formGrid}>
                <div style={s.formFull}>
                  <label style={s.label}>
                    Client account
                    <select style={s.select} value={form.clientId} onChange={(e) => selectClient(e.target.value)}>
                      <option value="">Unlinked invoice</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                    </select>
                  </label>
                </div>
                <label style={s.label}>
                  Client name
                  <input style={s.input} value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} required />
                </label>
                <label style={s.label}>
                  Client email
                  <input type="email" style={s.input} value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} />
                </label>
                <div style={s.formFull}>
                  <label style={s.label}>
                    Client address
                    <textarea style={s.textarea} rows={2} value={form.clientAddress} onChange={(e) => setForm({ ...form, clientAddress: e.target.value })} />
                  </label>
                </div>
                <label style={s.label}>
                  Issue date
                  <input type="date" style={s.input} value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
                </label>
                <label style={s.label}>
                  Due date
                  <input type="date" style={s.input} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </label>
                <label style={s.label}>
                  Currency
                  <input style={{ ...s.input, textTransform: 'uppercase' }} value={form.currency} maxLength={3}
                    onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
                </label>
                <label style={s.label}>
                  Language
                  <select style={s.select} value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value as Locale })}>
                    <option value="en">English</option>
                    <option value="ar">العربية</option>
                  </select>
                </label>
              </div>

              {/* Line Items */}
              <div style={s.itemsSection}>
                <div style={s.itemsHeader}>
                  <span>Description</span><span>Qty</span><span>Unit Price</span><span>Amount</span><span />
                </div>
                <div style={s.itemsBody}>
                  {form.items.map((item, index) => {
                    const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
                    return (
                      <div key={index} style={s.itemRow}>
                        <input style={s.input} placeholder="Item description" value={item.description}
                          onChange={(e) => updateItem(index, { description: e.target.value })} required />
                        <input type="number" step="0.01" min="0" style={s.input} value={item.quantity}
                          onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })} />
                        <input type="number" step="0.01" min="0" style={s.input} value={item.unitPrice}
                          onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })} />
                        <div style={s.itemTotal}>{formatInvoiceMoney(lineTotal, form.currency, form.locale)}</div>
                        <button type="button" onClick={() => removeItem(index)} style={s.removeBtn}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div style={s.itemsFooter}>
                  <button type="button" onClick={addItem} style={s.addItemBtn}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add item
                  </button>
                </div>
              </div>

              {/* Totals */}
              <div style={s.totalsGrid}>
                <label style={s.label}>
                  Notes
                  <textarea style={s.textarea} rows={3} value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Payment terms, thank you note, etc..." />
                </label>
                <div style={s.totalsBox}>
                  <div style={s.taxLabel}>
                    Tax rate (%)
                    <input type="number" step="0.01" min="0" max="100" style={s.input} value={form.taxRate}
                      onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })} />
                  </div>
                  <div style={s.totalRow}><span style={{ color: '#64748b' }}>Subtotal</span><span style={s.totalValue}>{formatInvoiceMoney(totals.subtotal, form.currency, form.locale)}</span></div>
                  <div style={s.totalRow}><span style={{ color: '#64748b' }}>Tax</span><span style={s.totalValue}>{formatInvoiceMoney(totals.taxTotal, form.currency, form.locale)}</span></div>
                  <div style={s.grandTotal}><span>Total</span><span>{formatInvoiceMoney(totals.total, form.currency, form.locale)}</span></div>
                </div>
              </div>

              {/* Actions */}
              <div style={s.modalActions}>
                <button type="button" onClick={() => setModalOpen(false)} style={s.btnSecondary}>Cancel</button>
                <button type="submit" disabled={saving} style={saving ? s.btnDisabled : s.btnPrimary}>
                  {saving && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                      <path d="M12 2a10 10 0 019.95 9" />
                    </svg>
                  )}
                  {editing ? 'Save Changes' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
