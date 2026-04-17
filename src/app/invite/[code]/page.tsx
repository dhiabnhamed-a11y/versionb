import { redirect } from 'next/navigation'

export default async function InviteLinkPage({ params }: PageProps<'/invite/[code]'>) {
  const { code } = await params
  redirect(`/signup?invite=${encodeURIComponent(code)}`)
}
