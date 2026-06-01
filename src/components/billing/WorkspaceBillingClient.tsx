'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, CreditCard, Download, Loader2, Receipt, ShieldCheck, Users } from 'lucide-react'
import {
  calculateWorkspacePlanTotal,
  getDefaultIsolation,
  getWorkspacePlan,
  getWorkspacePricing,
  type BillingCycle,
} from '@/lib/workspace-pricing'

type BillingWorkspace = {
  id: string
  name: string
  companyType: string
  planId: string | null
  billingType: string | null
  seatCount: number
  isolationEnabled: boolean
  isolationType: string | null
  subscriptionId: string | null
  subscriptionStatus: string
  trialEndsAt: string | null
  nextBillingDate: string | null
  currentPeriodEnd: string | null
  billingInterval: string | null
  hasBillingAccount: boolean
  billingEmail: string
  cardLast4: string | null
  cardExpiry: string | null
}

type BillingHistoryRow = {
  id: string
  date: string
  description: string
  amount: string
  status: 'Paid' | 'Failed' | 'Pending'
  invoiceUrl: string | null
}

function formatDate(value?: string | null) {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusClass(status: string) {
  if (status === 'Paid' || status === 'ACTIVE' || status === 'TRIAL') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'Failed' || status === 'PAST_DUE' || status === 'CANCELED') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

export default function WorkspaceBillingClient({
  workspace,
  history,
}: {
  workspace: BillingWorkspace
  history: BillingHistoryRow[]
}) {
  const router = useRouter()
  const { key, pricing } = getWorkspacePricing(workspace.companyType)
  const currentPlan = getWorkspacePlan(workspace.companyType, workspace.planId) ?? pricing.plans[0]
  const [selectedPlanId, setSelectedPlanId] = useState(currentPlan.id)
  const [seatCount, setSeatCount] = useState(workspace.seatCount || currentPlan.seats || 1)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(workspace.billingInterval === 'YEARLY' ? 'annual' : 'monthly')
  const [isolationEnabled, setIsolationEnabled] = useState(workspace.isolationEnabled)
  const [billingEmail, setBillingEmail] = useState(workspace.billingEmail)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [visibleHistory, setVisibleHistory] = useState(12)
  const selectedPlan = getWorkspacePlan(workspace.companyType, selectedPlanId) ?? currentPlan
  const totals = useMemo(
    () => calculateWorkspacePlanTotal({ billingCycle, isolationEnabled, plan: selectedPlan, pricing, seatCount }),
    [billingCycle, isolationEnabled, pricing, seatCount, selectedPlan]
  )
  const trialDaysLeft = workspace.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(workspace.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : 0
  const trialProgress = workspace.trialEndsAt ? Math.min(100, Math.max(0, ((14 - trialDaysLeft) / 14) * 100)) : 100

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action)
    setMessage(null)
    try {
      const response = await fetch('/api/workspace-billing/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          billingCycle,
          isolationEnabled,
          planId: selectedPlanId,
          seatCount,
          workspaceId: workspace.id,
          ...extra,
        }),
      })
      const json = await response.json().catch(() => ({}))
      const data = json.data ?? json
      if (!response.ok) throw new Error(data.error ?? json.error ?? 'Billing update failed.')
      if (data.url) {
        router.push(data.url)
        return
      }
      setMessage('Billing settings updated.')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Billing update failed.')
    } finally {
      setBusy(null)
    }
  }

  async function openPortal() {
    setBusy('portal')
    setMessage(null)
    try {
      const response = await fetch('/api/billing/portal')
      const json = await response.json().catch(() => ({}))
      const data = json.data ?? json
      if (!response.ok) throw new Error(data.error ?? json.error ?? 'Unable to open billing portal.')
      if (data.url) router.push(data.url)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to open billing portal.')
    } finally {
      setBusy(null)
    }
  }

  function changeIsolation(enabled: boolean) {
    if (!enabled) {
      const confirmed = window.confirm('Turning off isolation will move your data to a shared database. Are you sure?')
      if (!confirmed) return
      setIsolationEnabled(false)
      void runAction('isolation_change', { isolationEnabled: false, confirmed: true })
      return
    }
    setIsolationEnabled(true)
    void runAction('isolation_change', { isolationEnabled: true, confirmed: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 border-b border-slate-200 pb-5">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">{workspace.name} billing</p>
          <h1 className="text-3xl font-bold tracking-tight">Subscription & Billing</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">Workspace type: {key}. Plan data is loaded only from this workspace type.</p>
        </div>

        {workspace.subscriptionStatus === 'TRIAL' && workspace.trialEndsAt && (
          <section className="rounded-lg border border-blue-200 bg-blue-50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-blue-900">{trialDaysLeft} days left in your trial</p>
                <p className="mt-1 text-sm text-blue-800">When the trial ends, paid plans require an active Dodo payment method to keep billing active.</p>
              </div>
              <button onClick={openPortal} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-bold text-white">
                <CreditCard size={16} />
                Add payment method
              </button>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-blue-100">
              <div className="h-full rounded-full bg-blue-700" style={{ width: `${trialProgress}%` }} />
            </div>
          </section>
        )}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${statusClass(workspace.subscriptionStatus)}`}>
                  {workspace.subscriptionStatus}
                </span>
                <h2 className="mt-3 text-2xl font-bold">{currentPlan.name}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  ${currentPlan.price}/{currentPlan.unit} - {workspace.billingInterval === 'YEARLY' ? 'annual' : 'monthly'} billing
                </p>
              </div>
              <div className="grid gap-2 text-sm text-slate-600">
                <span>Next billing: <strong className="text-slate-950">{formatDate(workspace.nextBillingDate ?? workspace.currentPeriodEnd)}</strong></span>
                {pricing.billing === 'per-seat' && <span>Seats: <strong className="text-slate-950">{workspace.seatCount} used / {currentPlan.seats ?? workspace.seatCount} included</strong></span>}
                <span>Isolation: <strong className="text-slate-950">{workspace.isolationEnabled ? 'ON' : 'OFF'}</strong></span>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={() => runAction('change_plan')} className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-bold text-white">
                {busy === 'change_plan' ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                Change plan
              </button>
              <button onClick={() => runAction('change_plan', { planId: pricing.plans[0].id })} className="text-sm font-bold text-red-600">
                Cancel subscription
              </button>
            </div>
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold">
              <ShieldCheck size={17} className="text-emerald-600" />
              Isolation status
            </div>
            <p className="mt-3 text-sm text-slate-600">Current database type: <strong className="text-slate-950">{workspace.isolationType ?? 'shared'}</strong></p>
            <label className="mt-4 flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm font-bold">
              Enable isolation
              <input type="checkbox" checked={isolationEnabled} onChange={(event) => changeIsolation(event.target.checked)} />
            </label>
            <p className="mt-3 text-sm text-slate-600">Live price impact: ${totals.isolationMonthly.toFixed(0)}/month.</p>
          </aside>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold">Plan comparison</h2>
              <p className="text-sm text-slate-600">Only {key} plans are shown.</p>
            </div>
            <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
              <button onClick={() => setBillingCycle('monthly')} className={`rounded px-3 py-1.5 text-sm font-bold ${billingCycle === 'monthly' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Monthly</button>
              <button onClick={() => setBillingCycle('annual')} className={`rounded px-3 py-1.5 text-sm font-bold ${billingCycle === 'annual' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Annual - 20%</button>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {pricing.plans.map((plan) => {
              const selected = selectedPlanId === plan.id
              const planIsolation = selected ? isolationEnabled : getDefaultIsolation(plan)
              const planTotal = calculateWorkspacePlanTotal({ billingCycle, isolationEnabled: planIsolation, plan, pricing, seatCount: plan.seats ?? seatCount })
              const direction = plan.price > currentPlan.price ? 'Upgrade' : plan.price < currentPlan.price ? 'Downgrade' : 'Current plan'
              return (
                <article key={plan.id} className={`rounded-lg border p-4 ${plan.id === currentPlan.id ? 'border-blue-500 bg-blue-50' : selected ? 'border-slate-950 bg-white' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{plan.name}</h3>
                      <p className="text-sm text-slate-600">${plan.price}/{plan.unit}</p>
                    </div>
                    {plan.id === currentPlan.id && <CheckCircle2 size={18} className="text-blue-700" />}
                  </div>
                  <ul className="mt-4 grid gap-2 text-sm text-slate-600">
                    {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                  </ul>
                  <label className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <input type="checkbox" checked={planIsolation} disabled={plan.isolationLocked || !selected} onChange={(event) => setIsolationEnabled(event.target.checked)} />
                    Isolation {plan.isolationIncluded ? 'included' : plan.isolationCost ? `+$${plan.isolationCost}` : 'off'}
                  </label>
                  <p className="mt-3 text-sm font-bold">${planTotal.checkoutTotal.toFixed(0)} {billingCycle === 'annual' ? 'annual' : 'monthly'} estimate</p>
                  <button
                    onClick={() => {
                      setSelectedPlanId(plan.id)
                      setIsolationEnabled(getDefaultIsolation(plan))
                      if (plan.price < currentPlan.price) {
                        const confirmed = window.confirm('Downgrades take effect after confirmation. Continue?')
                        if (!confirmed) return
                      }
                      void runAction('change_plan', { planId: plan.id, isolationEnabled: getDefaultIsolation(plan) })
                    }}
                    className="mt-4 h-9 w-full rounded-md bg-slate-950 text-sm font-bold text-white"
                  >
                    {direction}
                  </button>
                </article>
              )
            })}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold"><CreditCard size={18} /> Payment method</h2>
            <p className="mt-3 text-sm text-slate-600">Current card: <strong>{workspace.cardLast4 ? `**** ${workspace.cardLast4} exp ${workspace.cardExpiry}` : 'No card on file'}</strong></p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={billingEmail} onChange={(event) => setBillingEmail(event.target.value)} />
              <button onClick={() => runAction('billing_email', { billingEmail })} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-bold">Update billing email</button>
            </div>
            <button onClick={openPortal} className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-bold text-white">
              <CreditCard size={16} />
              Update payment method
            </button>
          </div>

          {pricing.billing === 'per-seat' && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-bold"><Users size={18} /> Usage</h2>
              <p className="mt-3 text-sm text-slate-600">Current seat count: {seatCount}. Additional seats cost ${currentPlan.price}/seat plus isolation when enabled.</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, (seatCount / Math.max(seatCount, currentPlan.seats ?? seatCount)) * 100)}%` }} />
              </div>
              <div className="mt-4 flex gap-2">
                <input type="number" min={1} className="h-10 w-24 rounded-md border border-slate-300 px-3 text-sm" value={seatCount} onChange={(event) => setSeatCount(Math.max(1, Number(event.target.value || 1)))} />
                <button onClick={() => runAction('seat_change')} className="h-10 rounded-md bg-slate-950 px-4 text-sm font-bold text-white">Add seats</button>
                <button onClick={() => runAction('seat_change')} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-bold">Remove seats next cycle</button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Receipt size={18} /> Billing history</h2>
            <span className="text-xs font-bold text-slate-500">Last 12 months</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.slice(0, visibleHistory).map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-3">{formatDate(row.date)}</td>
                    <td className="px-5 py-3">{row.description}</td>
                    <td className="px-5 py-3">{row.amount}</td>
                    <td className="px-5 py-3"><span className={`rounded-md border px-2 py-1 text-xs font-bold ${statusClass(row.status)}`}>{row.status}</span></td>
                    <td className="px-5 py-3">
                      {row.invoiceUrl ? <a href={row.invoiceUrl} className="inline-flex items-center gap-1 font-bold text-blue-700"><Download size={14} /> PDF</a> : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleHistory < history.length && (
            <button onClick={() => setVisibleHistory((count) => count + 12)} className="m-5 h-10 rounded-md border border-slate-300 px-4 text-sm font-bold">Load more</button>
          )}
        </section>

        {message && (
          <div className="fixed bottom-5 right-5 flex max-w-sm items-start gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold shadow-lg">
            <AlertTriangle size={17} className="mt-0.5 text-amber-600" />
            {message}
          </div>
        )}
      </div>
    </div>
  )
}
