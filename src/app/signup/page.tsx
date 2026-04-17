import SignupOnboardingClient from '@/components/auth/SignupOnboardingClient'

export default async function SignupPage(props: PageProps<'/signup'>) {
  const params = await props.searchParams
  const invite = Array.isArray(params.invite) ? params.invite[0] : params.invite

  return <SignupOnboardingClient initialInviteCode={invite ?? ''} />
}
