import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { normalizeCompanyType } from '@/lib/company-types'
import { getEnterpriseOperationsDashboard } from '@/modules/enterprise/enterprise.service'
import type { SessionUser } from '@/modules/shared/session'
import {
  Siren,
  AlertCircle,
  AlertTriangle,
  Phone,
  Users,
  Clock,
  MapPin,
  Radio,
  CheckCircle,
  XCircle,
  ArrowRight,
  Filter,
  RefreshCw,
  Bell,
  Megaphone,
  FireExtinguisher,
  HeartPulse,
  ShieldAlert,
  UserX,
  Droplets,
  Wind,
  Zap,
  Building,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

function formatDate(value?: Date | string | null) {
  if (!value) return '--:--'
  return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatTimeAgo(value?: Date | string | null) {
  if (!value) return ''
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// Emergency code configurations
const EMERGENCY_CODES = {
  'Code Blue': { color: 'blue', icon: HeartPulse, description: 'Cardiac/Medical Emergency' },
  'Code Red': { color: 'red', icon: FireExtinguisher, description: 'Fire Emergency' },
  'Code Pink': { color: 'pink', icon: UserX, description: 'Infant/Child Abduction' },
  'Code Silver': { color: 'gray', icon: ShieldAlert, description: 'Active Shooter/Hostage' },
  'Code Orange': { color: 'orange', icon: Droplets, description: 'Hazardous Material Spill' },
  'Code Yellow': { color: 'yellow', icon: UserX, description: 'Missing Person' },
  'Code Green': { color: 'green', icon: Building, description: 'Evacuation' },
  'Code White': { color: 'white', icon: ShieldAlert, description: 'Violent Person' },
  'Code Black': { color: 'black', icon: Zap, description: 'Bomb Threat' },
  'Code Gray': { color: 'gray', icon: ShieldAlert, description: 'Security Threat' },
}

function EmergencyCodeCard({ incident }: { incident: any }) {
  const codeInfo = EMERGENCY_CODES[incident.priority as keyof typeof EMERGENCY_CODES] || { color: 'red', icon: AlertCircle, description: 'Emergency' }
  const Icon = codeInfo.icon

  const colorStyles = {
    red: { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-800' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
    pink: { bg: 'bg-pink-50', border: 'border-pink-500', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-800' },
    gray: { bg: 'bg-gray-50', border: 'border-gray-500', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-800' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-500', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-500', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' },
    green: { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-700', badge: 'bg-green-100 text-green-800' },
    white: { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-800' },
    black: { bg: 'bg-gray-900', border: 'border-gray-900', text: 'text-white', badge: 'bg-gray-800 text-white' },
  }

  const styles = colorStyles[codeInfo.color as keyof typeof colorStyles]

  return (
    <div className={`rounded-xl border-l-4 ${styles.border} ${styles.bg} p-4 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${styles.badge}`}>
            <Icon size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${styles.text}`}>{incident.priority}</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {incident.status}
              </span>
            </div>
            <h3 className="mt-1 font-semibold text-gray-900">{incident.title}</h3>
            <div className="mt-2 space-y-1 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <MapPin size={14} />
                {incident.department?.name || incident.asset?.name || 'Location unknown'}
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} />
                Reported {formatTimeAgo(incident.createdAt)} ({formatDate(incident.createdAt)})
              </div>
              {incident.assignedTeam && (
                <div className="flex items-center gap-2">
                  <Users size={14} />
                  {incident.assignedTeam.name}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
            Respond
          </button>
          <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Details
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, trend, color = 'blue' }: any) {
  const colorStyles = {
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    gray: 'bg-gray-50 text-gray-600',
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {trend && <p className="mt-1 text-xs text-gray-500">{trend}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorStyles[color as keyof typeof colorStyles]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

export default async function EmergencyCenterPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser
  const companyType = normalizeCompanyType(user.companyType)
  const isHealthcareWorkspace = ['HEALTHCARE', 'CLINIC_HOSPITAL'].includes(companyType)

  if (!isHealthcareWorkspace) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md text-center">
          <Siren size={48} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-bold text-gray-900">Emergency Operations Center</h2>
          <p className="mt-2 text-gray-600">
            This workspace is using the standard TASKIT mode. Create a Healthcare or Clinic/Hospital workspace
            to access emergency operations, code alerts, and incident response.
          </p>
        </div>
      </div>
    )
  }

  const data = await getEnterpriseOperationsDashboard(user)

  // Filter for active incidents
  const activeIncidents = data.incidents.filter((incident) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(incident.status))
  const criticalIncidents = activeIncidents.filter((incident) => incident.priority === 'CRITICAL')
  const highPriorityIncidents = activeIncidents.filter((incident) => incident.priority === 'HIGH')

  // Mock emergency codes data
  const emergencyCodes = [
    {
      id: '1',
      priority: 'Code Blue',
      title: 'Cardiac Arrest - Room 304',
      location: 'ICU - Room 304',
      status: 'Active',
      createdAt: new Date(Date.now() - 120000),
      assignedTeam: { name: 'Code Blue Team Alpha' },
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-semibold uppercase tracking-wide text-red-600">Live Operations</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Emergency Operations Center</h1>
          <p className="mt-2 text-gray-600">
            Real-time emergency response, code alerts, and incident coordination.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">
            <RefreshCw size={18} />
            Refresh
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700">
            <Megaphone size={18} />
            Broadcast Alert
          </button>
        </div>
      </div>

      {/* Emergency Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Active Incidents"
          value={activeIncidents.length}
          icon={AlertTriangle}
          trend={`${criticalIncidents.length} critical`}
          color="red"
        />
        <StatCard
          label="Critical Codes"
          value={criticalIncidents.length}
          icon={Siren}
          trend="Requires immediate response"
          color="red"
        />
        <StatCard
          label="High Priority"
          value={highPriorityIncidents.length}
          icon={AlertCircle}
          trend="Escalated incidents"
          color="yellow"
        />
        <StatCard
          label="Avg Response Time"
          value="12 min"
          icon={Clock}
          trend="Within SLA target"
          color="green"
        />
        <StatCard
          label="Teams On Duty"
          value={data.teams.filter((t) => t._count.assignedIncidents > 0).length}
          icon={Users}
          trend="Active response teams"
          color="blue"
        />
      </div>

      {/* Active Emergency Codes */}
      {emergencyCodes.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Active Emergency Codes</h2>
              <p className="text-sm text-gray-600">Critical situations requiring immediate response</p>
            </div>
            <button className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Filter size={14} />
              Filter
            </button>
          </div>
          <div className="space-y-4">
            {emergencyCodes.map((code) => (
              <EmergencyCodeCard key={code.id} incident={code} />
            ))}
          </div>
        </section>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Incident Queue */}
        <section className="lg:col-span-2">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Incident Queue</h3>
                <p className="text-sm text-gray-600">All active and pending incidents</p>
              </div>
              <Link href="/dashboard/admin/incidents" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                View all →
              </Link>
            </div>
            <div className="space-y-3">
              {activeIncidents.slice(0, 6).map((incident) => (
                <div
                  key={incident.id}
                  className="flex items-center justify-between rounded-lg border p-3 transition hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        incident.priority === 'CRITICAL'
                          ? 'bg-red-100 text-red-600'
                          : incident.priority === 'HIGH'
                          ? 'bg-orange-100 text-orange-600'
                          : 'bg-yellow-100 text-yellow-600'
                      }`}
                    >
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{incident.title}</div>
                      <div className="text-sm text-gray-600">
                        {incident.department?.name || incident.asset?.name || 'Location unknown'} • {incident.incidentNumber}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        incident.priority === 'CRITICAL'
                          ? 'bg-red-100 text-red-700'
                          : incident.priority === 'HIGH'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {incident.priority}
                    </span>
                    <span className="text-sm text-gray-500">{formatTimeAgo(incident.createdAt)}</span>
                    <ArrowRight size={16} className="text-gray-400" />
                  </div>
                </div>
              ))}
              {activeIncidents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle size={48} className="mb-4 text-green-500" />
                  <h3 className="text-lg font-semibold text-gray-900">All Clear</h3>
                  <p className="text-gray-600">No active incidents in the queue</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-semibold text-gray-900">Quick Actions</h3>
            <div className="space-y-2">
              <button className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-gray-50">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
                  <Siren size={20} />
                </div>
                <div>
                  <div className="font-medium text-gray-900">Trigger Code Blue</div>
                  <div className="text-sm text-gray-600">Cardiac arrest emergency</div>
                </div>
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-gray-50">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                  <FireExtinguisher size={20} />
                </div>
                <div>
                  <div className="font-medium text-gray-900">Trigger Code Red</div>
                  <div className="text-sm text-gray-600">Fire emergency</div>
                </div>
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-gray-50">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <div className="font-medium text-gray-900">Security Alert</div>
                  <div className="text-sm text-gray-600">Security incident response</div>
                </div>
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-gray-50">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Megaphone size={20} />
                </div>
                <div>
                  <div className="font-medium text-gray-900">Broadcast Message</div>
                  <div className="text-sm text-gray-600">Send facility-wide alert</div>
                </div>
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-gray-50">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                  <Building size={20} />
                </div>
                <div>
                  <div className="font-medium text-gray-900">Initiate Evacuation</div>
                  <div className="text-sm text-gray-600">Code Green - Full evacuation</div>
                </div>
              </button>
            </div>
          </div>

          {/* Emergency Contacts */}
          <div className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-semibold text-gray-900">Emergency Contacts</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">Emergency Hotline</div>
                  <div className="text-sm text-gray-600">24/7 Internal Emergency</div>
                </div>
                <a href="tel:2222" className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700">
                  <Phone size={14} />
                  Ext. 2222
                </a>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">Security Desk</div>
                  <div className="text-sm text-gray-600">24/7 Security Operations</div>
                </div>
                <a href="tel:3333" className="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-900">
                  <Phone size={14} />
                  Ext. 3333
                </a>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">Facilities</div>
                  <div className="text-sm text-gray-600">Utilities & Maintenance</div>
                </div>
                <a href="tel:4444" className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
                  <Phone size={14} />
                  Ext. 4444
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}