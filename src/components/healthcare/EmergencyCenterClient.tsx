'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Building,
  CheckCircle,
  Clock,
  Filter,
  FireExtinguisher,
  MapPin,
  Megaphone,
  RefreshCw,
  ShieldAlert,
  Siren,
  Users,
} from 'lucide-react'
import { enterpriseApi, type EnterpriseIncident } from '@/lib/api-client/enterprise'
import { getApiErrorMessage } from '@/lib/api-client'

const CODE_ACTIONS = [
  { key: 'code-blue', label: 'Trigger Code Blue', detail: 'Cardiac arrest emergency', icon: Siren, priority: 'P1', type: 'EMERGENCY', title: 'Code Blue — Cardiac Emergency' },
  { key: 'code-red', label: 'Trigger Code Red', detail: 'Fire emergency', icon: FireExtinguisher, priority: 'P1', type: 'EMERGENCY', title: 'Code Red — Fire Emergency' },
  { key: 'security', label: 'Security Alert', detail: 'Security incident response', icon: ShieldAlert, priority: 'P2', type: 'SECURITY', title: 'Security Alert' },
  { key: 'broadcast', label: 'Broadcast Message', detail: 'Send facility-wide alert', icon: Megaphone, href: '/dashboard/admin/alerts' as const },
  { key: 'evacuation', label: 'Initiate Evacuation', detail: 'Code Green — Full evacuation', icon: Building, priority: 'P1', type: 'EVACUATION', title: 'Code Green — Evacuation' },
]

function formatTimeAgo(value?: string | null) {
  if (!value) return ''
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function priorityTone(priority: string) {
  if (priority === 'P1') return { row: 'bg-red-100 text-red-600', badge: 'bg-red-100 text-red-700' }
  if (priority === 'P2') return { row: 'bg-orange-100 text-orange-600', badge: 'bg-orange-100 text-orange-700' }
  return { row: 'bg-yellow-100 text-yellow-600', badge: 'bg-yellow-100 text-yellow-700' }
}

function StatCard({ label, value, detail, color, icon: Icon }: { label: string; value: number | string; detail: string; color: string; icon: typeof AlertTriangle }) {
  const colors: Record<string, string> = { red: 'bg-red-50 text-red-600', blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', yellow: 'bg-yellow-50 text-yellow-600' }
  return (
    <article className="rounded-xl border bg-white p-4 shadow-sm">
      <section className="flex items-center justify-between">
        <section>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{detail}</p>
        </section>
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors[color]}`}><Icon size={20} /></span>
      </section>
    </article>
  )
}

export default function EmergencyCenterClient({ initialIncidents, teamsOnDuty }: { initialIncidents: EnterpriseIncident[]; teamsOnDuty: number }) {
  const router = useRouter()
  const [incidents, setIncidents] = useState(initialIncidents)
  const [filter, setFilter] = useState<'all' | 'P1' | 'P2'>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const activeIncidents = useMemo(() => incidents.filter((i) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(i.status)), [incidents])
  const criticalIncidents = activeIncidents.filter((i) => i.priority === 'P1')
  const highPriorityIncidents = activeIncidents.filter((i) => i.priority === 'P2')
  const filtered = filter === 'all' ? activeIncidents : activeIncidents.filter((i) => i.priority === filter)
  const codeAlerts = criticalIncidents.slice(0, 3)

  async function reload() {
    setIncidents(await enterpriseApi.listIncidents())
    router.refresh()
  }

  async function respond(incident: EnterpriseIncident) {
    setBusyId(incident.id)
    setMessage(null)
    try {
      const updated = await enterpriseApi.updateIncident(incident.id, { status: 'IN_PROGRESS', firstRespondedAt: new Date().toISOString() })
      setIncidents((c) => c.map((row) => (row.id === updated.id ? updated : row)))
      setMessage(`Responded to ${incident.incidentNumber}`)
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'Failed to respond'))
    } finally {
      setBusyId(null)
    }
  }

  async function triggerIncident(action: (typeof CODE_ACTIONS)[number]) {
    if ('href' in action && action.href) return router.push(action.href)
    setMessage(null)
    try {
      const created = await enterpriseApi.createIncident({
        title: action.title,
        description: action.detail,
        type: action.type,
        priority: action.priority,
        severity: action.priority === 'P1' ? 'CRITICAL' : 'HIGH',
        impact: 'HIGH',
        urgency: 'HIGH',
        source: 'EMERGENCY_CONSOLE',
      })
      setIncidents((c) => [created, ...c])
      setMessage(`${action.label} logged`)
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'Failed to create incident'))
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <section>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-red-600">
            <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
            Live Operations
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Emergency Operations Center</h1>
          <p className="mt-2 text-gray-600">Real-time emergency response, code alerts, and incident coordination.</p>
        </section>
        <section className="flex items-center gap-3">
          <button type="button" disabled={pending} onClick={() => startTransition(() => void reload())} className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            <RefreshCw size={18} className={pending ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link href="/dashboard/admin/alerts" className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700">
            <Megaphone size={18} />
            Broadcast Alert
          </Link>
        </section>
      </header>

      {message && <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">{message}</p>}

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Active Incidents" value={activeIncidents.length} detail={`${criticalIncidents.length} P1`} color="red" icon={AlertTriangle} />
        <StatCard label="P1 Critical" value={criticalIncidents.length} detail="Requires immediate response" color="red" icon={Siren} />
        <StatCard label="P2 High" value={highPriorityIncidents.length} detail="Escalated incidents" color="yellow" icon={AlertCircle} />
        <StatCard label="Open Queue" value={activeIncidents.length} detail="Awaiting resolution" color="green" icon={Clock} />
        <StatCard label="Teams On Duty" value={teamsOnDuty} detail="Active response teams" color="blue" icon={Users} />
      </section>

      {codeAlerts.length > 0 && (
        <section>
          <header className="mb-4 flex items-center justify-between">
            <section>
              <h2 className="text-lg font-semibold text-gray-900">Active Emergency Codes</h2>
              <p className="text-sm text-gray-600">P1 incidents requiring immediate response</p>
            </section>
            <button type="button" onClick={() => setFilter((f) => (f === 'P1' ? 'all' : 'P1'))} className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Filter size={14} />
              {filter === 'P1' ? 'Show all' : 'P1 only'}
            </button>
          </header>
          <section className="space-y-4">
            {codeAlerts.map((incident) => (
              <article key={incident.id} className="rounded-xl border-l-4 border-red-500 bg-red-50 p-4 shadow-sm">
                <section className="flex items-start justify-between gap-4">
                  <section>
                    <p className="flex items-center gap-2">
                      <span className="text-lg font-bold text-red-700">{incident.priority}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{incident.status}</span>
                    </p>
                    <h3 className="mt-1 font-semibold text-gray-900">{incident.title}</h3>
                    <p className="mt-2 flex items-center gap-2 text-sm text-gray-600"><MapPin size={14} />{incident.department?.name || incident.asset?.name || 'Location unknown'}</p>
                    <p className="flex items-center gap-2 text-sm text-gray-600"><Clock size={14} />Reported {formatTimeAgo(incident.createdAt)}</p>
                  </section>
                  <section className="flex flex-col gap-2">
                    <button type="button" disabled={busyId === incident.id} onClick={() => void respond(incident)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">Respond</button>
                    <Link href={`/dashboard/admin/requests?incident=${incident.id}`} className="rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50">Details</Link>
                  </section>
                </section>
              </article>
            ))}
          </section>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-xl border bg-white p-5 shadow-sm">
          <header className="mb-4 flex items-center justify-between">
            <section>
              <h3 className="font-semibold text-gray-900">Incident Queue</h3>
              <p className="text-sm text-gray-600">All active and pending incidents</p>
            </section>
            <Link href="/dashboard/admin/requests" className="text-sm font-medium text-blue-600 hover:text-blue-700">View all →</Link>
          </header>
          <section className="space-y-3">
            {filtered.slice(0, 6).map((incident) => {
              const tone = priorityTone(incident.priority)
              return (
                <Link key={incident.id} href={`/dashboard/admin/requests?incident=${incident.id}`} className="flex items-center justify-between rounded-lg border p-3 transition hover:bg-gray-50">
                  <section className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-full ${tone.row}`}><AlertTriangle size={18} /></span>
                    <section>
                      <p className="font-medium text-gray-900">{incident.title}</p>
                      <p className="text-sm text-gray-600">{incident.department?.name || incident.asset?.name || 'Location unknown'} • {incident.incidentNumber}</p>
                    </section>
                  </section>
                  <section className="flex items-center gap-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone.badge}`}>{incident.priority}</span>
                    <span className="text-sm text-gray-500">{formatTimeAgo(incident.createdAt)}</span>
                  </section>
                </Link>
              )
            })}
            {filtered.length === 0 && (
              <section className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle size={48} className="mb-4 text-green-500" />
                <h3 className="text-lg font-semibold text-gray-900">All Clear</h3>
                <p className="text-gray-600">No active incidents in the queue</p>
              </section>
            )}
          </section>
        </section>

        <section>
          <article className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-semibold text-gray-900">Quick Actions</h3>
            <section className="space-y-2">
              {CODE_ACTIONS.map((action) => {
                const Icon = action.icon
                return (
                  <button key={action.key} type="button" disabled={pending} onClick={() => startTransition(() => void triggerIncident(action))} className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-gray-50 disabled:opacity-60">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700"><Icon size={20} /></span>
                    <section>
                      <p className="font-medium text-gray-900">{action.label}</p>
                      <p className="text-sm text-gray-600">{action.detail}</p>
                    </section>
                  </button>
                )
              })}
            </section>
          </article>
        </section>
      </section>
    </section>
  )
}
