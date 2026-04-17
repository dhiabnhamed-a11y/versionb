import SignupInviteClient from '@/components/auth/SignupInviteClient'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[] }>
}) {
  const params = await searchParams
  const invite = Array.isArray(params.invite) ? params.invite[0] : params.invite

  return <SignupInviteClient initialInviteCode={invite ?? ''} />
}
