import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import WorkspaceBillingClient from '@/components/billing/WorkspaceBillingClient'

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function historyStatus(event: string): 'Paid' | 'Failed' | 'Pending' {
  if (event.includes('failed')) return 'Failed'
  if (event.includes('created') || event.includes('renewed') || event.includes('succeeded')) return 'Paid'
  return 'Pending'
}

export default async function WorkspaceBillingPage(props: PageProps<'/workspace/[workspaceId]/settings/billing'>) {
  const { workspaceId } = await props.params
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  if (session.user.companyId !== workspaceId) redirect('/dashboard')

  const [workspace, events] = await Promise.all([
    prisma.company.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        companyType: true,
        planId: true,
        billingType: true,
        seatCount: true,
        isolationEnabled: true,
        isolationType: true,
        subscriptionId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        nextBillingDate: true,
        currentPeriodEnd: true,
        billingInterval: true,
        stripeCustomerId: true,
        metadata: true,
        owner: { select: { email: true } },
      },
    }),
    prisma.subscriptionEvent.findMany({
      where: { companyId: workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 36,
      select: { id: true, event: true, payload: true, createdAt: true },
    }),
  ])

  if (!workspace) redirect('/login')
  const metadata = asObject(workspace.metadata)
  const billingEmail = typeof metadata.billingEmail === 'string' ? metadata.billingEmail : workspace.owner.email

  return (
    <WorkspaceBillingClient
      workspace={{
        id: workspace.id,
        name: workspace.name,
        companyType: workspace.companyType,
        planId: workspace.planId,
        billingType: workspace.billingType,
        seatCount: workspace.seatCount,
        isolationEnabled: workspace.isolationEnabled,
        isolationType: workspace.isolationType,
        subscriptionId: workspace.subscriptionId ?? workspace.stripeSubscriptionId,
        subscriptionStatus: workspace.subscriptionStatus as string,
        trialEndsAt: workspace.trialEndsAt?.toISOString() ?? null,
        nextBillingDate: workspace.nextBillingDate?.toISOString() ?? null,
        currentPeriodEnd: workspace.currentPeriodEnd?.toISOString() ?? null,
        billingInterval: (workspace.billingInterval as string | null) ?? null,
        hasBillingAccount: Boolean(workspace.stripeCustomerId),
        billingEmail,
        cardLast4: typeof metadata.cardLast4 === 'string' ? metadata.cardLast4 : null,
        cardExpiry: typeof metadata.cardExpiry === 'string' ? metadata.cardExpiry : null,
      }}
      history={events.map((event) => {
        const payload = asObject(event.payload)
        const amount = typeof payload.amount === 'string' || typeof payload.amount === 'number' ? `$${payload.amount}` : '-'
        return {
          id: event.id,
          date: event.createdAt.toISOString(),
          description: event.event.replace(/_/g, ' '),
          amount,
          status: historyStatus(event.event),
          invoiceUrl: typeof payload.invoiceUrl === 'string' ? payload.invoiceUrl : null,
        }
      })}
    />
  )
}
