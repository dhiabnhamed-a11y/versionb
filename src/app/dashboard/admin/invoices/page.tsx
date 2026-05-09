'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Download,
  FileText,
  Loader2,
  Plus,
  ReceiptText,
  Send,
  Trash2,
  CheckCircle2,
  Pencil,
  Languages,
  X,
} from 'lucide-react'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { formatInvoiceMoney, getInvoiceStatusLabel, INVOICE_STATUSES, type InvoiceStatus } from '@/lib/invoices'

type Locale = 'en' | 'ar'

type InvoiceItem = {
  id?: string
  description: string
  quantity: number
  unitPrice: number
  lineTotal?: number
}

type Invoice = {
  id: string
  clientId?: string | null
  campaignId?: string | null
  briefId?: string | null
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
  client?: {
    id: string
    companyName: string
    contactPerson?: string | null
    email?: string | null
    address?: string | null
    avatarUrl?: string | null
  } | null
  campaign?: { id: string; title: string } | null
  brief?: { id: string; title: string } | null
  items: InvoiceItem[]
}

type InvoiceForm = {
  clientId: string
  campaignId: string
  briefId: string
  clientName: string
  clientEmail: string
  clientAddress: string
  status: InvoiceStatus
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

const copy = {
  en: {
    title: 'Invoices',
    subtitle: 'Create, send, and download professional client invoices.',
    newInvoice: 'New invoice',
    client: 'Client',
    total: 'Total',
    due: 'Due',
    status: 'Status',
    items: 'Items',
    edit: 'Edit',
    download: 'PDF',
    markSent: 'Mark sent',
    markPaid: 'Mark paid',
    empty: 'No invoices yet',
    emptyHint: 'Create your first client invoice and download it as a PDF.',
    createTitle: 'Create invoice',
    editTitle: 'Edit invoice',
    save: 'Save invoice',
    create: 'Create invoice',
    cancel: 'Cancel',
    clientName: 'Client name',
    clientEmail: 'Client email',
    clientAddress: 'Client address',
    issueDate: 'Issue date',
    dueDate: 'Due date',
    currency: 'Currency',
    language: 'Language',
    taxRate: 'Tax rate',
    notes: 'Notes',
    description: 'Description',
    quantity: 'Quantity',
    unitPrice: 'Unit price',
    amount: 'Amount',
    addItem: 'Add item',
    subtotal: 'Subtotal',
    tax: 'Tax',
    grandTotal: 'Grand total',
    delete: 'Delete',
    all: 'All',
  },
  ar: {
    title: 'الفواتير',
    subtitle: 'أنشئ وأرسل وحمّل فواتير احترافية للعملاء.',
    newInvoice: 'فاتورة جديدة',
    client: 'العميل',
    total: 'الإجمالي',
    due: 'الاستحقاق',
    status: 'الحالة',
    items: 'العناصر',
    edit: 'تعديل',
    download: 'PDF',
    markSent: 'تحديد كمرسلة',
    markPaid: 'تحديد كمدفوعة',
    empty: 'لا توجد فواتير بعد',
    emptyHint: 'أنشئ أول فاتورة للعميل وحمّلها كملف PDF.',
    createTitle: 'إنشاء فاتورة',
    editTitle: 'تعديل فاتورة',
    save: 'حفظ الفاتورة',
    create: 'إنشاء الفاتورة',
    cancel: 'إلغاء',
    clientName: 'اسم العميل',
    clientEmail: 'بريد العميل',
    clientAddress: 'عنوان العميل',
    issueDate: 'تاريخ الإصدار',
    dueDate: 'تاريخ الاستحقاق',
    currency: 'العملة',
    language: 'اللغة',
    taxRate: 'نسبة الضريبة',
    notes: 'ملاحظات',
    description: 'الوصف',
    quantity: 'الكمية',
    unitPrice: 'سعر الوحدة',
    amount: 'المبلغ',
    addItem: 'إضافة عنصر',
    subtotal: 'المجموع الفرعي',
    tax: 'الضريبة',
    grandTotal: 'الإجمالي النهائي',
    delete: 'حذف',
    all: 'الكل',
  },
} as const

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function emptyForm(locale: Locale, client?: ClientOption | null): InvoiceForm {
  return {
    clientId: client?.id ?? '',
    campaignId: '',
    briefId: '',
    clientName: client?.companyName ?? '',
    clientEmail: client?.email ?? '',
    clientAddress: client?.address ?? '',
    status: 'draft',
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

function calculateLocalTotals(items: InvoiceItem[], taxRate: number) {
  const subtotal = items.reduce((sum, item) => sum + Math.max(Number(item.quantity) || 0, 0) * Math.max(Number(item.unitPrice) || 0, 0), 0)
  const taxTotal = subtotal * (Math.max(Number(taxRate) || 0, 0) / 100)
  return { subtotal, taxTotal, total: subtotal + taxTotal }
}

function InvoicesPageContent() {
  const searchParams = useSearchParams()
  const [locale, setLocale] = useState<Locale>('en')
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [form, setForm] = useState<InvoiceForm>(() => emptyForm('en'))
  const [openedFromClientLink, setOpenedFromClientLink] = useState(false)
  const t = copy[locale]

  const loadInvoices = useCallback(async () => {
    const response = await fetch(filter === 'all' ? '/api/invoices' : `/api/invoices?status=${filter}`, { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) throw new Error(body?.error || 'Invoices could not be loaded.')
    setInvoices(Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [])
  }, [filter])

  const loadClients = useCallback(async () => {
    const response = await fetch('/api/clients?pageSize=100', { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) return
    setClients(Array.isArray(body?.items) ? body.items : [])
  }, [])

  useEffect(() => {
    let active = true

    const timer = window.setTimeout(() => {
      void Promise.all([loadInvoices(), loadClients()])
        .catch((reason) => {
          if (active) setError(reason instanceof Error ? reason.message : 'Invoices could not be loaded.')
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [loadClients, loadInvoices])

  useEffect(() => {
    const clientId = searchParams.get('clientId')
    const campaignId = searchParams.get('campaignId') ?? ''
    const briefId = searchParams.get('briefId') ?? ''
    if ((!clientId && !campaignId && !briefId) || openedFromClientLink) return
    if (clientId && clients.length === 0) return
    const client = clientId ? clients.find((item) => item.id === clientId) : null
    if (clientId && !client) return

    const timer = window.setTimeout(() => {
      setLocale('en')
      setEditingInvoice(null)
      setForm({ ...emptyForm('en', client), campaignId, briefId })
      setError(null)
      setModalOpen(true)
      setOpenedFromClientLink(true)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [clients, openedFromClientLink, searchParams])

  useRealtimeSubscription(INVOICE_REALTIME_EVENTS, () => {
    void loadInvoices().catch(() => undefined)
  }, 300)

  const totals = useMemo(() => calculateLocalTotals(form.items, form.taxRate), [form.items, form.taxRate])
  const paidTotal = invoices.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.total, 0)
  const outstandingTotal = invoices
    .filter((invoice) => invoice.status === 'sent' || invoice.status === 'overdue')
    .reduce((sum, invoice) => sum + invoice.total, 0)
  const currency = invoices[0]?.currency ?? form.currency

  function openCreateModal() {
    setEditingInvoice(null)
    const clientId = searchParams.get('clientId')
    setForm({
      ...emptyForm(locale, clients.find((client) => client.id === clientId) ?? null),
      campaignId: searchParams.get('campaignId') ?? '',
      briefId: searchParams.get('briefId') ?? '',
    })
    setError(null)
    setModalOpen(true)
  }

  function openEditModal(invoice: Invoice) {
    setEditingInvoice(invoice)
    setForm({
      clientName: invoice.clientName,
      clientId: invoice.clientId ?? '',
      campaignId: invoice.campaignId ?? '',
      briefId: invoice.briefId ?? '',
      clientEmail: invoice.clientEmail ?? '',
      clientAddress: invoice.clientAddress ?? '',
      status: invoice.status,
      currency: invoice.currency,
      locale: invoice.locale,
      issueDate: dateInput(invoice.issueDate),
      dueDate: dateInput(invoice.dueDate),
      notes: invoice.notes ?? '',
      taxRate: invoice.taxRate,
      items: invoice.items.length ? invoice.items : [{ description: '', quantity: 1, unitPrice: 0 }],
    })
    setError(null)
    setModalOpen(true)
  }

  function selectClient(clientId: string) {
    const client = clients.find((item) => item.id === clientId)
    setForm((current) => ({
      ...current,
      clientId,
      clientName: client?.companyName ?? current.clientName,
      clientEmail: client?.email ?? current.clientEmail,
      clientAddress: client?.address ?? current.clientAddress,
    }))
  }

  function updateItem(index: number, patch: Partial<InvoiceItem>) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }))
  }

  function addItem() {
    setForm((current) => ({ ...current, items: [...current.items, { description: '', quantity: 1, unitPrice: 0 }] }))
  }

  function removeItem(index: number) {
    setForm((current) => ({
      ...current,
      items: current.items.length === 1 ? current.items : current.items.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  async function saveInvoice(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const response = await fetch(editingInvoice ? `/api/invoices/${editingInvoice.id}` : '/api/invoices', {
      method: editingInvoice ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const body = await response.json()
    setSaving(false)

    if (!response.ok) {
      setError(body?.error || 'Invoice could not be saved.')
      return
    }

    setModalOpen(false)
    await loadInvoices()
  }

  async function updateStatus(invoice: Invoice, status: InvoiceStatus) {
    await fetch(`/api/invoices/${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await loadInvoices()
  }

  async function deleteInvoice(invoice: Invoice) {
    if (!confirm(`Delete ${invoice.invoiceNumber}?`)) return
    await fetch(`/api/invoices/${invoice.id}`, { method: 'DELETE' })
    await loadInvoices()
  }

  function getDownloadFilename(disposition: string | null, fallback: string) {
    const match = disposition?.match(/filename="?([^";]+)"?/i)
    return match?.[1] || `${fallback.replace(/[^a-zA-Z0-9._-]/g, '_') || 'invoice'}.pdf`
  }

  async function downloadInvoicePdf(invoice: Invoice) {
    setDownloadingInvoiceId(invoice.id)
    setError(null)

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
      setError(reason instanceof Error ? reason.message : 'Invoice PDF could not be downloaded.')
    } finally {
      setDownloadingInvoiceId(null)
    }
  }

  return (
    <div className="dashboard-page" dir={locale === 'ar' ? 'rtl' : 'ltr'} style={{ maxWidth: '1180px' }}>
      <div className="dashboard-header-row">
        <div>
          <h1 className="page-heading flex items-center gap-2.5">
            <ReceiptText size={25} strokeWidth={1.85} style={{ color: 'var(--accent)' }} />
            {t.title}
          </h1>
          <p className="page-sub">{t.subtitle}</p>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')} className="btn-secondary">
            <Languages size={16} />
            {locale === 'en' ? 'العربية' : 'English'}
          </button>
          <button type="button" onClick={openCreateModal} className="btn-primary">
            <Plus size={16} />
            {t.newInvoice}
          </button>
        </div>
      </div>

      <div className="dashboard-stat-grid">
        <article className="stat-card">
          <span className="stat-card-label">{t.total}</span>
          <strong className="stat-card-value">{invoices.length}</strong>
          <span className="stat-card-delta">{t.items}</span>
        </article>
        <article className="stat-card">
          <span className="stat-card-label">Paid</span>
          <strong className="stat-card-value text-[var(--success)]">{formatInvoiceMoney(paidTotal, currency, locale)}</strong>
          <span className="stat-card-delta">{getInvoiceStatusLabel('paid', locale)}</span>
        </article>
        <article className="stat-card">
          <span className="stat-card-label">Outstanding</span>
          <strong className="stat-card-value text-[var(--warning)]">{formatInvoiceMoney(outstandingTotal, currency, locale)}</strong>
          <span className="stat-card-delta">{getInvoiceStatusLabel('sent', locale)} / {getInvoiceStatusLabel('overdue', locale)}</span>
        </article>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', ...INVOICE_STATUSES] as Array<InvoiceStatus | 'all'>).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`filter-chip ${filter === status ? 'filter-chip-active' : ''}`}
          >
            {status === 'all' ? t.all : getInvoiceStatusLabel(status, locale)}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="card loading-shimmer h-24" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="card py-14 text-center">
          <FileText size={34} className="mx-auto mb-3 text-[var(--text-light)]" />
          <p className="font-semibold text-[var(--text-primary)]">{t.empty}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-muted)]">{t.emptyHint}</p>
          <button type="button" onClick={openCreateModal} className="btn-primary mt-5">
            <Plus size={16} />
            {t.newInvoice}
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {invoices.map((invoice) => (
            <article key={invoice.id} className="card">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-[var(--text-primary)]">{invoice.invoiceNumber}</span>
                    <span className={`badge ${invoice.status === 'paid' ? 'badge-employee' : invoice.status === 'overdue' ? 'priority-critical' : 'badge-manager'}`}>
                      {getInvoiceStatusLabel(invoice.status, locale)}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">{invoice.clientName}</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    {t.due}: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString(locale === 'ar' ? 'ar-TN' : 'en-US') : '-'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <div className="me-2 text-right">
                    <div className="text-lg font-black text-[var(--text-primary)]">{formatInvoiceMoney(invoice.total, invoice.currency, locale)}</div>
                    <div className="text-[11px] font-semibold text-[var(--text-muted)]">{invoice.items.length} {t.items}</div>
                  </div>
                  {invoice.status === 'draft' && (
                    <button type="button" onClick={() => updateStatus(invoice, 'sent')} className="btn-secondary btn-sm">
                      <Send size={14} />
                      {t.markSent}
                    </button>
                  )}
                  {invoice.status !== 'paid' && (
                    <button type="button" onClick={() => updateStatus(invoice, 'paid')} className="btn-secondary btn-sm">
                      <CheckCircle2 size={14} />
                      {t.markPaid}
                    </button>
                  )}
                  <button type="button" onClick={() => downloadInvoicePdf(invoice)} disabled={downloadingInvoiceId === invoice.id} className="btn-secondary btn-sm">
                    {downloadingInvoiceId === invoice.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    {t.download}
                  </button>
                  <button type="button" onClick={() => openEditModal(invoice)} className="btn-secondary btn-sm">
                    <Pencil size={14} />
                    {t.edit}
                  </button>
                  {invoice.status !== 'paid' && (
                    <button type="button" onClick={() => deleteInvoice(invoice)} className="btn-danger btn-sm">
                      <Trash2 size={14} />
                      {t.delete}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setModalOpen(false)}>
          <div className="modal max-h-[92vh] w-[min(96vw,920px)] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold tracking-tight">{editingInvoice ? t.editTitle : t.createTitle}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-full p-2 hover:bg-[var(--bg-elevated)]" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveInvoice} className="grid gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)] md:col-span-2">
                  Client account
                  <select className="input" value={form.clientId} onChange={(event) => selectClient(event.target.value)}>
                    <option value="">Unlinked invoice</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.companyName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                  {t.clientName}
                  <input className="input" value={form.clientName} onChange={(event) => setForm({ ...form, clientName: event.target.value })} required />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                  {t.clientEmail}
                  <input type="email" className="input" value={form.clientEmail} onChange={(event) => setForm({ ...form, clientEmail: event.target.value })} />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)] md:col-span-2">
                  {t.clientAddress}
                  <textarea className="input" rows={2} value={form.clientAddress} onChange={(event) => setForm({ ...form, clientAddress: event.target.value })} />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                  {t.issueDate}
                  <input type="date" className="input" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                  {t.dueDate}
                  <input type="date" className="input" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                  {t.currency}
                  <input className="input uppercase" value={form.currency} maxLength={3} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                  {t.language}
                  <select className="input" value={form.locale} onChange={(event) => setForm({ ...form, locale: event.target.value as Locale })}>
                    <option value="en">English</option>
                    <option value="ar">العربية</option>
                  </select>
                </label>
              </div>

              <section className="rounded-[var(--radius-md)] border border-[var(--border)]">
                <div className="grid grid-cols-[1fr_82px_110px_110px_40px] gap-2 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)] max-md:hidden">
                  <span>{t.description}</span>
                  <span>{t.quantity}</span>
                  <span>{t.unitPrice}</span>
                  <span>{t.amount}</span>
                  <span />
                </div>
                <div className="grid gap-3 p-3">
                  {form.items.map((item, index) => {
                    const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
                    return (
                      <div key={index} className="grid gap-2 md:grid-cols-[1fr_82px_110px_110px_40px] md:items-center">
                        <input className="input" placeholder={t.description} value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} required />
                        <input type="number" step="0.01" min="0" className="input" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} />
                        <input type="number" step="0.01" min="0" className="input" value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })} />
                        <div className="rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] px-3 py-3 text-sm font-bold text-[var(--text-primary)]">
                          {formatInvoiceMoney(lineTotal, form.currency, form.locale)}
                        </div>
                        <button type="button" onClick={() => removeItem(index)} className="btn-secondary !h-10 !min-h-10 !px-2" aria-label="Remove item">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="border-t border-[var(--border)] p-3">
                  <button type="button" onClick={addItem} className="btn-secondary btn-sm">
                    <Plus size={14} />
                    {t.addItem}
                  </button>
                </div>
              </section>

              <div className="grid gap-4 md:grid-cols-[1fr_320px] md:items-start">
                <label className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                  {t.notes}
                  <textarea className="input" rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
                </label>
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                  <label className="mb-3 grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                    {t.taxRate}
                    <input type="number" step="0.01" min="0" max="100" className="input bg-white" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: Number(event.target.value) })} />
                  </label>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between gap-3"><span>{t.subtotal}</span><strong>{formatInvoiceMoney(totals.subtotal, form.currency, form.locale)}</strong></div>
                    <div className="flex justify-between gap-3"><span>{t.tax}</span><strong>{formatInvoiceMoney(totals.taxTotal, form.currency, form.locale)}</strong></div>
                    <div className="mt-2 flex justify-between gap-3 border-t border-[var(--border)] pt-3 text-lg font-black text-[var(--text-primary)]">
                      <span>{t.grandTotal}</span>
                      <span>{formatInvoiceMoney(totals.total, form.currency, form.locale)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">{t.cancel}</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {editingInvoice ? t.save : t.create}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="dashboard-page"><div className="card loading-shimmer h-40" /></div>}>
      <InvoicesPageContent />
    </Suspense>
  )
}
