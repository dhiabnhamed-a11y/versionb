import SignupOnboardingClient from '@/components/auth/SignupOnboardingClient'
import { getCompanyTypeFromSlug } from '@/lib/company-types'

export default async function SignupPage(props: PageProps<'/signup'>) {
  const params = await props.searchParams
  const invite = Array.isArray(params.invite) ? params.invite[0] : params.invite
  const companyTypeParam = Array.isArray(params.companyType) ? params.companyType[0] : params.companyType
  const initialCompanyType = getCompanyTypeFromSlug(companyTypeParam) ?? 'OTHER'

  return <SignupOnboardingClient initialInviteCode={invite ?? ''} initialCompanyType={initialCompanyType} />
}
