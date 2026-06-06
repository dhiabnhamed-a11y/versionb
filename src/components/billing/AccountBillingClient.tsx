'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Calendar, CreditCard, Download, Loader2, Receipt, RotateCcw, Users, X } from 'lucide-react'
import {
  WORKSPACES,
  calculateWorkspacePrice,
  formatUsd,
  formatWorkspacePrice,
  getWorkspaceById,
  type BillingInterval,
  type WorkspacePricing,
} from '@/lib/pricing'

type BillingSubscription = {
  id: string
  workspaceId: string
  interval: BillingInterval
  seatCount: number
  status: string
  currentPeriodEnd: string | null
  dodoCustomerId: string | null
  dodoSubscriptionId: string | null
}

type PaymentMethod = {
  brand: string | null
  expiry: string | null
  last4: string | null
}

type InvoiceRow = {
  amount: string
  date: string
  description: string
  id: string
  invoiceUrl: string | null
  status: string
}

function displayDate(value: string | null) {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function modelLabel(workspace: WorkspacePricing) {
  if (workspace.billingModel === 'per_seat') return 'Per seat'
  if (workspace.billingModel === 'per_workspace') return 'Per workspace'
  return 'Per system'
}

function statusLabel(status: string) {
  if (status === 'past_due') return 'Past due'
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'trialing') return 'Trialing'
  return 'Active'
}

function statusClass(status: string) {
  if (status === 'past_due') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === 'cancelled') return 'border-red-200 bg-red-50 text-red-700'
  if (status === 'trialing') return 'border-blue-200 bg-blue-50 text-blue-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

export default function AccountBillingClient({
  initialSubscription,
  paymentMethod,
}: {
  initialSubscription: BillingSubscription | null
  paymentMethod: PaymentMethod | null
}) {
  const router = useRouter()
  const [subscription, setSubscription] = useState(initialSubscription)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(initialSubscription?.workspaceId ?? 'enterprise_ops')
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>(initialSubscription?.interval ?? 'monthly')
  const [seatCount, setSeatCount] = useState(initialSubscription?.seatCount ?? 1)
  const [modal, setModal] = useState<'plan' | 'interval' | 'seats' | 'cancel' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [invoicePage, setInvoicePage] = useState(1)

  const workspace = getWorkspaceById(subscription?.workspaceId ?? selectedWorkspaceId) ?? WORKSPACES[0]
  const previewWorkspace = getWorkspaceById(selectedWorkspaceId) ?? workspace
  const currentPrice = useMemo(() => {
    if (!subscription) return null
    return calculateWorkspacePrice({
      interval: subscription.interval,
      quantity: subscription.seatCount,
      workspaceId: subscription.workspaceId,
    })
  }, [subscription])
  const previewPrice = formatWorkspacePrice(previewWorkspace, selectedInterval, seatCount)
  const lifetime = subscription?.interval === 'lifetime'

  useEffect(() => {
    let alive = true
    async function loadInvoices() {
      setInvoiceError(null)
      try {
        const response = await fetch('/api/billing/invoices')
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error ?? 'Unable to load billing info')
        if (alive) setInvoices(data.invoices ?? [])
      } catch (error) {
        if (alive) setInvoiceError(error instanceof Error ? error.message : 'Unable to load billing info')
      }
    }
    void loadInvoices()
    return () => {
      alive = false
    }
  }, [])

  async function refreshSubscription() {
    const response = await fetch('/api/billing/subscription')
    const data = await response.json().catch(() => ({}))
    if (response.ok && data.subscription) {
      setSubscription({
        currentPeriodEnd: data.subscription.currentPeriodEnd,
        dodoCustomerId: data.subscription.dodoCustomerId,
        dodoSubscriptionId: data.subscription.dodoSubscriptionId,
        id: subscription?.id ?? 'current',
        interval: data.subscription.interval,
        seatCount: data.subscription.seatCount,
        status: data.subscription.status,
        workspaceId: data.subscription.workspace.id,
      })
    }
  }

  async function runAction(name: string, path: string, body?: Record<string, unknown>) {
    setBusy(name)
    setMessage(null)
    try {
      const response = await fetch(path, {
        body: body ? JSON.stringify(body) : undefined,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        method: path.endsWith('/portal') ? 'GET' : 'POST',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Billing action failed.')
      if (data.url) {
        router.push(data.url)
        return
      }
      await refreshSubscription()
      setModal(null)
      setMessage('Billing settings updated.')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Billing action failed.')
    } finally {
      setBusy(null)
    }
  }

  async function createCheckoutForPlan() {
    await runAction('plan', '/api/billing/checkout', {
      cancelUrl: '/account/billing',
      interval: selectedInterval,
      quantity: seatCount,
      successUrl: `/onboarding/success?workspace=${encodeURIComponent(selectedWorkspaceId)}`,
      workspaceId: selectedWorkspaceId,
    })
  }

  const shownInvoices = invoices.slice(0, invoicePage * 12)

  if (!subscription) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
        <section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-7 shadow-sm">
          <h1 className="text-2xl font-bold">Choose a billing plan</h1>
          <p className="mt-2 text-sm text-slate-600">No active billing selection is attached to this account yet.</p>
          <button
            className="mt-5 h-11 rounded-md bg-slate-950 px-5 text-sm font-bold text-white"
            onClick={() => router.push('/onboarding/workspace')}
          >
            Select workspace
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-emerald-700">Account settings</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Billing</h1>
          </div>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold shadow-sm"
            onClick={() => void runAction('portal', '/api/billing/portal')}
          >
            {busy === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Update payment method
          </button>
        </div>

        {subscription.status === 'past_due' && (
          <div className="mb-5 flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold">Payment failed. Update your payment method to keep access active.</span>
            <button className="h-9 rounded-md bg-amber-700 px-4 text-sm font-bold text-white" onClick={() => void runAction('portal', '/api/billing/portal')}>
              Retry payment
            </button>
          </div>
        )}

        {lifetime && (
          <div className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
            Lifetime access - no recurring charges.
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${statusClass(subscription.status)}`}>
                  {statusLabel(subscription.status)}
                </span>
                <h2 className="mt-3 text-2xl font-bold">{workspace.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{modelLabel(workspace)} · {subscription.interval}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">{workspace.billingModel === 'per_seat' ? 'Seats' : 'Included'}</p>
                  <p className="mt-2 text-xl font-bold">
                    {workspace.billingModel === 'per_seat'
                      ? subscription.seatCount
                      : workspace.includedSeats === 'unlimited'
                        ? 'Unlimited'
                        : `${workspace.includedSeats} seats`}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">{lifetime ? 'Paid' : 'Next bill'}</p>
                  <p className="mt-2 text-xl font-bold">{lifetime ? 'Once' : displayDate(subscription.currentPeriodEnd)}</p>
                </div>
              </div>
            </div>
            <p className="mt-5 text-sm font-semibold text-slate-700">
              Amount: {currentPrice ? formatUsd(currentPrice.total) : '-'} {lifetime ? 'one-time' : subscription.interval === 'annual' ? 'billed annually' : 'per month'}
            </p>
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold"><CreditCard className="h-5 w-5" /> Payment method</h2>
            <p className="mt-4 text-sm text-slate-600">
              Current card:{' '}
              <strong className="text-slate-950">
                {paymentMethod?.last4 ? `${paymentMethod.brand ?? 'Card'} ending ${paymentMethod.last4}${paymentMethod.expiry ? ` · exp ${paymentMethod.expiry}` : ''}` : 'No card on file'}
              </strong>
            </p>
            <button className="mt-4 h-10 rounded-md bg-slate-950 px-4 text-sm font-bold text-white" onClick={() => void runAction('portal', '/api/billing/portal')}>
              Open billing portal
            </button>
          </aside>
        </section>

        <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Manage subscription</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-bold text-white" onClick={() => setModal('plan')}>
              <RotateCcw className="h-4 w-4" /> Change plan
            </button>
            <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold" onClick={() => setModal('interval')}>
              <Calendar className="h-4 w-4" /> Change billing interval
            </button>
            {workspace.billingModel === 'per_seat' && (
              <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold" onClick={() => setModal('seats')}>
                <Users className="h-4 w-4" /> Add/remove seats
              </button>
            )}
            {!lifetime && (
              <button className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700" onClick={() => setModal('cancel')}>
                <X className="h-4 w-4" /> Cancel subscription
              </button>
            )}
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Receipt className="h-5 w-5" /> Invoices</h2>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-bold" onClick={() => router.refresh()}>
              <RotateCcw className="h-4 w-4" /> Retry
            </button>
          </div>
          {invoiceError ? (
            <div className="p-5 text-sm font-semibold text-red-700">Unable to load billing info. {invoiceError}</div>
          ) : shownInvoices.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No invoices yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shownInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="px-5 py-3">{displayDate(invoice.date)}</td>
                      <td className="px-5 py-3">{invoice.description}</td>
                      <td className="px-5 py-3">{invoice.amount}</td>
                      <td className="px-5 py-3">{invoice.status}</td>
                      <td className="px-5 py-3">
                        {invoice.invoiceUrl ? <a className="inline-flex items-center gap-1 font-bold text-blue-700" href={invoice.invoiceUrl}><Download className="h-4 w-4" /> PDF</a> : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {shownInvoices.length < invoices.length && (
            <button className="m-5 h-10 rounded-md border border-slate-300 px-4 text-sm font-bold" onClick={() => setInvoicePage((page) => page + 1)}>
              Load more
            </button>
          )}
        </section>

        {message && (
          <div className="fixed bottom-5 right-5 z-40 flex max-w-sm gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold shadow-lg">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            {message}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <section className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {modal === 'plan' ? 'Change plan' : modal === 'interval' ? 'Change billing interval' : modal === 'seats' ? 'Add/remove seats' : 'Cancel subscription'}
              </h2>
              <button aria-label="Close modal" className="grid h-9 w-9 place-items-center rounded-md border border-slate-200" onClick={() => setModal(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {modal === 'plan' && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {WORKSPACES.map((item) => (
                  <button
                    key={item.id}
                    className={`rounded-lg border p-4 text-left ${selectedWorkspaceId === item.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}
                    onClick={() => setSelectedWorkspaceId(item.id)}
                  >
                    <p className="font-bold">{item.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{formatWorkspacePrice(item, selectedInterval, seatCount).primary}</p>
                    <p className="mt-3 text-xs font-bold uppercase text-slate-500">{modelLabel(item)}</p>
                  </button>
                ))}
              </div>
            )}

            {modal === 'interval' && (
              <div className="grid gap-3 sm:grid-cols-3">
                {(['monthly', 'annual', 'lifetime'] as BillingInterval[]).map((item) => (
                  <button
                    key={item}
                    className={`rounded-lg border p-4 text-left ${selectedInterval === item ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}
                    onClick={() => setSelectedInterval(item)}
                  >
                    <p className="font-bold capitalize">{item}</p>
                    <p className="mt-1 text-sm text-slate-600">{formatWorkspacePrice(workspace, item, seatCount).primary}</p>
                  </button>
                ))}
              </div>
            )}

            {modal === 'seats' && (
              <div>
                <p className="text-sm text-slate-600">Live preview: {previewPrice.detail}</p>
                <div className="mt-4 flex items-center gap-3">
                  <input className="h-11 w-28 rounded-md border border-slate-300 px-3 text-sm font-bold" min={1} max={500} type="number" value={seatCount} onChange={(event) => setSeatCount(Math.max(1, Math.min(500, Number(event.target.value || 1))))} />
                  <span className="text-sm font-semibold text-slate-700">seats</span>
                </div>
              </div>
            )}

            {modal === 'cancel' && (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                Access remains available until {displayDate(subscription.currentPeriodEnd)}.
              </div>
            )}

            {modal !== 'cancel' && <p className="mt-4 text-sm font-bold text-slate-800">Price preview: {previewPrice.primary} · {previewPrice.detail}</p>}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button className="h-10 rounded-md border border-slate-300 px-4 text-sm font-bold" onClick={() => setModal(null)}>
                {modal === 'cancel' ? 'Keep plan' : 'Close'}
              </button>
              {modal === 'plan' && (
                <button className="h-10 rounded-md bg-slate-950 px-4 text-sm font-bold text-white" disabled={busy === 'plan'} onClick={() => void createCheckoutForPlan()}>
                  {busy === 'plan' ? 'Working...' : 'Confirm plan'}
                </button>
              )}
              {modal === 'interval' && (
                <button className="h-10 rounded-md bg-slate-950 px-4 text-sm font-bold text-white" disabled={busy === 'interval'} onClick={() => void runAction('interval', '/api/billing/change-interval', { interval: selectedInterval })}>
                  Confirm interval
                </button>
              )}
              {modal === 'seats' && (
                <button className="h-10 rounded-md bg-slate-950 px-4 text-sm font-bold text-white" disabled={busy === 'seats'} onClick={() => void runAction('seats', '/api/billing/update-seats', { quantity: seatCount })}>
                  Update seats
                </button>
              )}
              {modal === 'cancel' && (
                <button className="h-10 rounded-md bg-red-600 px-4 text-sm font-bold text-white" disabled={busy === 'cancel'} onClick={() => void runAction('cancel', '/api/billing/cancel')}>
                  Confirm cancel
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
