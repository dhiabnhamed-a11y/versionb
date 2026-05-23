import { redirect } from 'next/navigation'
import { auth, getSessionHomePath } from '@/lib/auth'
import { prisma } from '@/lib/db'
import ProfileClient from './profile-client'

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')
  if (!session.user.id) redirect(getSessionHomePath(session))

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
    },
  })

  if (!user) redirect(getSessionHomePath(session))

  return <ProfileClient initialProfile={user} />
}
