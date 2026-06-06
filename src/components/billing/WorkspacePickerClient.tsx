'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Minus, Plus, Sparkles } from 'lucide-react'
import {
  WORKSPACES,
  formatUsd,
  formatWorkspacePrice,
  getAnnualSavings,
  type BillingInterval,
  type WorkspacePricing,
} from '@/lib/pricing'

function billingLabel(workspace: WorkspacePricing) {
  if (workspace.billingModel === 'per_seat') return 'Per seat'
  if (workspace.billingModel === 'per_system') return 'Per system'
  return 'Per workspace'
}

function includedSeatsLabel(workspace: WorkspacePricing) {
  return workspace.includedSeats === 'unlimited' ? 'Unlimited seats' : `Includes ${workspace.includedSeats} seats`
}

export default function WorkspacePickerClient() {
  const router = useRouter()
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('enterprise_ops')
  const [seatCounts, setSeatCounts] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedWorkspace = WORKSPACES.find((workspace) => workspace.id === selectedWorkspaceId) ?? WORKSPACES[0]
  const selectedQuantity = seatCounts[selectedWorkspace.id] ?? 1
  const selectedPrice = formatWorkspacePrice(selectedWorkspace, interval, selectedQuantity)

  function getSeatCount(workspaceId: string) {
    return seatCounts[workspaceId] ?? 1
  }

  function updateSeatCount(workspaceId: string, nextSeatCount: number) {
    setSeatCounts((current) => ({
      ...current,
      [workspaceId]: Math.min(500, Math.max(1, Math.floor(nextSeatCount || 1))),
    }))
  }

  async function continueToCheckout(workspaceId = selectedWorkspaceId) {
    const workspace = WORKSPACES.find((item) => item.id === workspaceId)
    if (!workspace) return
    const quantity = getSeatCount(workspace.id)
    setBusy(true)
    setError(null)
    localStorage.setItem('taskit_workspace_selection', JSON.stringify({ interval, quantity, workspaceId: workspace.id }))

    try {
      const response = await fetch('/api/billing/checkout', {
        body: JSON.stringify({
          cancelUrl: '/signup?step=workspace',
          interval,
          quantity,
          successUrl: `/onboarding/success?workspace=${encodeURIComponent(workspace.id)}`,
          workspaceId: workspace.id,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Unable to start checkout.')
      if (data.url) router.push(data.url)
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Unable to start checkout.')
    } finally {
      setBusy(false)
    }
  }

  const cards = WORKSPACES.map((workspace) => {
        const quantity = getSeatCount(workspace.id)
        const price = formatWorkspacePrice(workspace, interval, quantity)
        const selected = selectedWorkspaceId === workspace.id
        return (
          <article
            key={workspace.id}
            className={`flex min-h-[430px] flex-col rounded-lg border bg-white p-5 shadow-sm transition ${
              selected ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">{workspace.category}</p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">{workspace.name}</h2>
              </div>
              {workspace.badge && (
                <span className="shrink-0 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  {workspace.badge}
                </span>
              )}
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600">{workspace.description}</p>
            <ul className="mt-4 grid gap-2 text-sm text-slate-700">
              {workspace.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-5">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-2xl font-bold text-slate-950">{price.primary}</p>
                  <span className="text-xs font-bold uppercase text-slate-500">{billingLabel(workspace)}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-600">{price.detail}</p>
                {interval === 'annual' && (
                  <p className="mt-2 text-sm font-bold text-emerald-700">
                    Save {formatUsd(getAnnualSavings(workspace, quantity))}/yr vs monthly
                  </p>
                )}
              </div>

              {workspace.billingModel === 'per_seat' ? (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-700">Seats</span>
                  <div className="flex h-10 items-center overflow-hidden rounded-md border border-slate-300 bg-white">
                    <button
                      aria-label="Remove seat"
                      className="grid h-10 w-10 place-items-center text-slate-600 hover:bg-slate-50"
                      onClick={() => updateSeatCount(workspace.id, quantity - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      className="h-10 w-16 border-x border-slate-200 text-center text-sm font-bold outline-none"
                      max={500}
                      min={1}
                      type="number"
                      value={quantity}
                      onChange={(event) => updateSeatCount(workspace.id, Number(event.target.value))}
                    />
                    <button
                      aria-label="Add seat"
                      className="grid h-10 w-10 place-items-center text-slate-600 hover:bg-slate-50"
                      onClick={() => updateSeatCount(workspace.id, quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm font-semibold text-slate-700">{includedSeatsLabel(workspace)}</p>
              )}

              {workspace.billingModel === 'per_system' && workspace.extraSeatMonthly && (
                <p className="mt-2 text-xs font-medium text-slate-500">+ {formatUsd(workspace.extraSeatMonthly)}/seat/mo for additional users</p>
              )}

              <button
                className={`mt-5 h-11 w-full rounded-md text-sm font-bold transition ${
                  selected ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-950 text-white hover:bg-slate-800'
                }`}
                disabled={busy}
                onClick={() => {
                  setSelectedWorkspaceId(workspace.id)
                  void continueToCheckout(workspace.id)
                }}
              >
                {selected ? 'Continue' : 'Select plan'}
              </button>
            </div>
          </article>
        )
      })

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-950 md:pb-12">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              TASKIT workspace setup
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Choose your workspace</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Pick the operating model that matches your team. Pricing comes from the shared TASKIT workspace catalog.
            </p>
          </div>

          <div className="inline-flex w-full rounded-md border border-slate-200 bg-white p-1 shadow-sm sm:w-auto">
            {[
              ['monthly', 'Monthly'],
              ['annual', 'Annual (save ~22%)'],
              ['lifetime', 'Lifetime'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`min-h-10 flex-1 rounded px-3 text-sm font-bold sm:flex-none ${
                  interval === value ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
                onClick={() => setInterval(value as BillingInterval)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cards}</section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white p-3 shadow-lg md:hidden">
        <button
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-md bg-slate-950 px-4 text-left text-white"
          disabled={busy}
          onClick={() => void continueToCheckout()}
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{selectedWorkspace.name}</span>
            <span className="block truncate text-xs text-slate-300">{selectedPrice.primary}</span>
          </span>
          <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
        </button>
      </div>
    </main>
  )
}
