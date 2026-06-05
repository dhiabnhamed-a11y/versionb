import type { Metadata } from 'next'
import SignupOnboardingClient from '@/components/auth/SignupOnboardingClient'
import { getCompanyTypeFromSlug } from '@/lib/company-types'

export const metadata: Metadata = {
  title: 'Create Workspace',
  description: 'Create your TASKIT workspace. Start managing projects, clients, billing, and team collaboration in one platform.',
  robots: { index: false, follow: false },
}

export default async function SignupPage(props: PageProps<'/signup'>) {
  const params = await props.searchParams
  const invite = Array.isArray(params.invite) ? params.invite[0] : params.invite
  const companyTypeParam = Array.isArray(params.companyType) ? params.companyType[0] : params.companyType
  const initialCompanyType = getCompanyTypeFromSlug(companyTypeParam) ?? 'OTHER'

  return <SignupOnboardingClient initialInviteCode={invite ?? ''} initialCompanyType={initialCompanyType} />
}
