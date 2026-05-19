import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { normalizeCompanyType } from '@/lib/company-types'
import { getEnterpriseOperationsDashboard } from '@/modules/enterprise/enterprise.service'
import type { SessionUser } from '@/modules/shared/session'
import {
  Activity,
  AlertTriangle,
  BedDouble,
  HeartPulse,
  Hospital,
  Users,
  Wrench,
  ShieldCheck,
  Clock,
  TrendingUp,
  Stethoscope,
  FileText,
  ArrowRight,
  Siren,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

function pct(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`
}

function formatDate(value?: Date | string | null) {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function HealthcareStatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
  trend,
}: {
  label: string
  value: string | number
  detail: string
  icon: React.ElementType
  tone?: 'neutral' | 'good' | 'warning' | 'critical'
  trend?: { value: number; direction: 'up' | 'down' }
}) {
  const toneColors = {
    neutral: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600' },
    good: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600' },
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600' },
    critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600' },
  }
  const colors = toneColors[tone]

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{value}</div>
          <div className="mt-1 text-sm text-gray-600">{detail}</div>
          {trend && (
            <div className={`mt-2 flex items-center gap-1 text-sm font-medium ${trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp size={14} className={trend.direction === 'down' ? 'rotate-180' : ''} />
              {trend.value}% vs last week
            </div>
          )}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colors.bg} border ${colors.border}`}>
          <Icon size={22} className={colors.text} />
        </div>
      </div>
    </div>
  )
}

export default async function HealthcareDashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser
  const companyType = normalizeCompanyType(user.companyType)
  const isHealthcareWorkspace = ['HEALTHCARE', 'CLINIC_HOSPITAL'].includes(companyType)

  if (!isHealthcareWorkspace) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md text-center">
          <Hospital size={48} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-bold text-gray-900">Healthcare Operations</h2>
          <p className="mt-2 text-gray-600">
            This workspace is using the standard TASKIT mode. Create a Healthcare or Clinic/Hospital workspace
            during signup to access patient management, biomedical assets, and clinical operations.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
          >
            Create Healthcare Workspace
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    )
  }

  const data = await getEnterpriseOperationsDashboard(user)

  // Healthcare-specific metrics (mock data for demo)
  const healthcareMetrics = {
    totalPatients: 1247,
    admittedPatients: 186,
    edVisits: 42,
    bedOccupancy: 78,
    onDutyStaff: 145,
    staffPatientRatio: 0.32,
    activeAssets: 892,
    assetsInMaintenance: 12,
    criticalAssetsDown: 1,
    assetUptime: 96.8,
    openIncidents: 8,
    criticalIncidents: 1,
    avgResponseTime: 12,
    complianceScore: 97,
    trainingCompliance: 94,
  }

  const recentActivities = [
    { type: 'admission', title: 'Ahmed Al-Mansoori', detail: 'Emergency Department', time: '5 min ago', status: 'critical' },
    { type: 'asset', title: 'MRI Scanner #2', detail: 'Maintenance completed', time: '12 min ago', status: 'good' },
    { type: 'incident', title: 'Equipment malfunction', detail: 'Radiology Department', time: '18 min ago', status: 'warning' },
    { type: 'staff', title: 'Dr. Fatima Hassan', detail: 'Shift started - ICU', time: '25 min ago', status: 'neutral' },
    { type: 'compliance', title: 'JCI Documentation Review', detail: 'Due: Tomorrow', time: '30 min ago', status: 'warning' },
  ]

  const getIcon = (type: string) => {
    switch (type) {
      case 'admission': return BedDouble
      case 'asset': return HeartPulse
      case 'incident': return AlertTriangle
      case 'staff': return Users
      case 'compliance': return ShieldCheck
      default: return Activity
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-red-100 text-red-600'
      case 'warning': return 'bg-yellow-100 text-yellow-600'
      case 'good': return 'bg-green-100 text-green-600'
      default: return 'bg-blue-100 text-blue-600'
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">Hospital Command Center</div>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Healthcare Operations Overview</h1>
          <p className="mt-2 text-gray-600">
            Real-time view of patient care, clinical operations, asset health, and compliance status.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/admin/emergency-center"
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
          >
            <Siren size={18} />
            Emergency Center
          </Link>
          <Link
            href="/dashboard/admin/patients"
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Users size={18} />
            Patient List
          </Link>
        </div>
      </div>

      {/* Clinical KPIs */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Clinical Operations</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <HealthcareStatCard
            label="Total Patients"
            value={healthcareMetrics.totalPatients.toLocaleString()}
            detail="Active patient records"
            icon={Users}
            tone="neutral"
            trend={{ value: 5.2, direction: 'up' }}
          />
          <HealthcareStatCard
            label="Admitted Patients"
            value={healthcareMetrics.admittedPatients}
            detail="Currently admitted"
            icon={BedDouble}
            tone="warning"
          />
          <HealthcareStatCard
            label="ED Visits (24h)"
            value={healthcareMetrics.edVisits}
            detail="Emergency department"
            icon={Activity}
            tone="neutral"
          />
          <HealthcareStatCard
            label="Bed Occupancy"
            value={pct(healthcareMetrics.bedOccupancy)}
            detail="Current occupancy rate"
            icon={Hospital}
            tone={healthcareMetrics.bedOccupancy > 90 ? 'critical' : 'good'}
          />
        </div>
      </section>

      {/* Staff & Asset KPIs */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Staff & Resources</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <HealthcareStatCard
            label="Staff On Duty"
            value={healthcareMetrics.onDutyStaff}
            detail="Currently on shift"
            icon={Stethoscope}
            tone="good"
          />
          <HealthcareStatCard
            label="Staff-Patient Ratio"
            value={healthcareMetrics.staffPatientRatio.toFixed(2)}
            detail="Active ratio"
            icon={Users}
            tone={healthcareMetrics.staffPatientRatio < 0.25 ? 'warning' : 'good'}
          />
          <HealthcareStatCard
            label="Asset Uptime"
            value={pct(healthcareMetrics.assetUptime)}
            detail="Medical equipment availability"
            icon={HeartPulse}
            tone={healthcareMetrics.assetUptime < 95 ? 'warning' : 'good'}
          />
          <HealthcareStatCard
            label="Assets in Maintenance"
            value={healthcareMetrics.assetsInMaintenance}
            detail={`${healthcareMetrics.criticalAssetsDown} critical`}
            icon={Wrench}
            tone={healthcareMetrics.criticalAssetsDown > 0 ? 'critical' : 'neutral'}
          />
        </div>
      </section>

      {/* Incident & Compliance KPIs */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Incidents & Compliance</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <HealthcareStatCard
            label="Open Incidents"
            value={healthcareMetrics.openIncidents}
            detail={`${healthcareMetrics.criticalIncidents} critical`}
            icon={AlertTriangle}
            tone={healthcareMetrics.criticalIncidents > 0 ? 'critical' : 'warning'}
          />
          <HealthcareStatCard
            label="Avg Response Time"
            value={`${healthcareMetrics.avgResponseTime} min`}
            detail="Incident response"
            icon={Clock}
            tone="good"
          />
          <HealthcareStatCard
            label="Compliance Score"
            value={pct(healthcareMetrics.complianceScore)}
            detail="Overall compliance"
            icon={ShieldCheck}
            tone={healthcareMetrics.complianceScore < 95 ? 'warning' : 'good'}
          />
          <HealthcareStatCard
            label="Training Compliance"
            value={pct(healthcareMetrics.trainingCompliance)}
            detail="Staff training completion"
            icon={FileText}
            tone={healthcareMetrics.trainingCompliance < 95 ? 'warning' : 'good'}
          />
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <section className="lg:col-span-2">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Recent Activity</h3>
              <Link href="/dashboard/admin/reports" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                View all →
              </Link>
            </div>
            <div className="space-y-3">
              {recentActivities.map((activity, idx) => {
                const Icon = getIcon(activity.type)
                return (
                  <div key={idx} className="flex items-center gap-4 rounded-lg border p-3 transition hover:bg-gray-50">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${getStatusColor(activity.status)}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{activity.title}</div>
                      <div className="text-sm text-gray-600">{activity.detail}</div>
                    </div>
                    <div className="text-sm text-gray-500">{activity.time}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Department Status */}
        <section>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Department Status</h3>
              <Link href="/dashboard/admin/departments" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                Manage →
              </Link>
            </div>
            <div className="space-y-3">
              {data.departments.slice(0, 6).map((department) => (
                <div key={department.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium text-gray-900">{department.name}</div>
                    <div className="text-sm text-gray-600">
                      {department._count.assets} assets • {department._count.incidents} incidents
                    </div>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    department._count.incidents > 3 ? 'bg-red-100 text-red-700' :
                    department._count.incidents > 1 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {department._count.incidents > 3 ? 'Critical' :
                     department._count.incidents > 1 ? 'Watch' : 'Normal'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Asset Health Section */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Critical Medical Assets</h3>
            <p className="text-sm text-gray-600">Asset health and maintenance status</p>
          </div>
          <Link href="/dashboard/admin/medical-assets" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Manage Assets →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Asset</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Department</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Health</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Next Maintenance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.assets.slice(0, 5).map((asset) => (
                <tr key={asset.id} className="transition hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{asset.name}</div>
                    <div className="text-sm text-gray-500">{asset.assetTag}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{asset.category.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{asset.department?.name || 'Unassigned'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full bg-gray-200">
                        <div
                          className={`h-2 rounded-full ${asset.healthScore > 80 ? 'bg-green-500' : asset.healthScore > 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${asset.healthScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-600">{asset.healthScore}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      asset.riskScore > 70 ? 'bg-red-100 text-red-700' :
                      asset.riskScore > 40 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {asset.riskScore > 70 ? 'High Risk' : asset.riskScore > 40 ? 'Medium' : 'Low Risk'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {asset.nextMaintenanceAt ? formatDate(asset.nextMaintenanceAt) : 'Not scheduled'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}