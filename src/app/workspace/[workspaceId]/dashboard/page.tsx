import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getWorkspaceHomePath } from '@/lib/workspace-routing'

export default async function WorkspaceDashboardRedirectPage(props: PageProps<'/workspace/[workspaceId]/dashboard'>) {
  const { workspaceId } = await props.params
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  if (session.user.companyId !== workspaceId) redirect('/dashboard')

  const company = await prisma.company.findUnique({
    where: { id: workspaceId },
    select: { companyType: true },
  })

  redirect(getWorkspaceHomePath({ role: session.user.role, companyType: company?.companyType }))
}
