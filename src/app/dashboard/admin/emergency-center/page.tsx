import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { normalizeCompanyType } from '@/lib/company-types'
import { getEnterpriseOperationsDashboard } from '@/modules/enterprise/enterprise.service'
import type { SessionUser } from '@/modules/shared/session'
import { Siren } from 'lucide-react'
import EmergencyCenterClient from '@/components/healthcare/EmergencyCenterClient'

export const dynamic = 'force-dynamic'

export default async function EmergencyCenterPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser
  const companyType = normalizeCompanyType(user.companyType)
  const isHealthcareWorkspace = ['HEALTHCARE', 'CLINIC_HOSPITAL'].includes(companyType)

  if (!isHealthcareWorkspace) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <section className="max-w-md text-center">
          <Siren size={48} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-bold text-gray-900">Emergency Operations Center</h2>
          <p className="mt-2 text-gray-600">
            This workspace is using the standard TASKIT mode. Create a Healthcare or Clinic/Hospital workspace
            to access emergency operations, code alerts, and incident response.
          </p>
        </section>
      </section>
    )
  }

  const data = await getEnterpriseOperationsDashboard(user)
  const initialIncidents = data.incidents.map((incident) => ({
    ...incident,
    createdAt: incident.createdAt.toISOString(),
  }))
  const teamsOnDuty = data.teams.filter((team) => team._count.assignedIncidents > 0).length

  return <EmergencyCenterClient initialIncidents={initialIncidents} teamsOnDuty={teamsOnDuty} />
}
