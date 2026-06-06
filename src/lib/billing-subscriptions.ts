import { prisma } from '@/lib/db'
import {
  calculateWorkspacePrice,
  getDodoProductId,
  getWorkspaceById,
  type BillingInterval,
  type BillingModel,
} from '@/lib/pricing'

export type WorkspaceSubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled'

export function absoluteAppUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  return `${appUrl}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`
}

export async function getCurrentWorkspaceSubscription(userId: string) {
  return prisma.workspaceSubscription.findFirst({
    orderBy: { createdAt: 'desc' },
    where: { userId },
  })
}

export async function getOrCreatePendingWorkspaceSubscription(input: {
  userId: string
  workspaceId: string
  interval: BillingInterval
  quantity: number
}) {
  const workspace = getWorkspaceById(input.workspaceId)
  if (!workspace) throw new Error('Invalid workspace.')
  const price = calculateWorkspacePrice({
    interval: input.interval,
    quantity: input.quantity,
    workspaceId: input.workspaceId,
  })

  const existing = await getCurrentWorkspaceSubscription(input.userId)
  if (existing && existing.status !== 'cancelled') {
    return prisma.workspaceSubscription.update({
      where: { id: existing.id },
      data: {
        billingModel: workspace.billingModel,
        interval: input.interval,
        seatCount: price.displayQuantity,
        status: existing.status === 'active' ? existing.status : 'trialing',
        workspaceId: input.workspaceId,
      },
    })
  }

  return prisma.workspaceSubscription.create({
    data: {
      billingModel: workspace.billingModel,
      interval: input.interval,
      seatCount: price.displayQuantity,
      status: 'trialing',
      userId: input.userId,
      workspaceId: input.workspaceId,
    },
  })
}

export async function syncCompanyBillingFromSubscription(input: {
  userId: string
  workspaceId: string
  billingModel: BillingModel
  interval: BillingInterval
  seatCount: number
  status: WorkspaceSubscriptionStatus
  dodoCustomerId?: string | null
  dodoSubscriptionId?: string | null
  currentPeriodEnd?: Date | null
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { companyId: true } })
  if (!user?.companyId) return

  await prisma.company.update({
    where: { id: user.companyId },
    data: {
      billingInterval: input.interval === 'annual' ? 'YEARLY' : input.interval === 'lifetime' ? 'LIFETIME' : 'MONTHLY',
      billingType: input.billingModel,
      currentPeriodEnd: input.currentPeriodEnd ?? undefined,
      planId: getDodoProductId(input.workspaceId, input.interval),
      planType: input.interval === 'lifetime' ? 'LIFETIME' : input.status === 'trialing' ? 'FREE_TRIAL' : 'STARTER',
      seatCount: input.seatCount,
      stripeCustomerId: input.dodoCustomerId ?? undefined,
      stripeSubscriptionId: input.dodoSubscriptionId ?? undefined,
      subscriptionId: input.dodoSubscriptionId ?? undefined,
      subscriptionStatus:
        input.status === 'active'
          ? 'ACTIVE'
          : input.status === 'past_due'
            ? 'PAST_DUE'
            : input.status === 'cancelled'
              ? 'CANCELED'
              : 'TRIAL',
    },
  })
}

export function parseDodoDate(value: unknown) {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function mapDodoSubscriptionStatus(status: string | undefined): WorkspaceSubscriptionStatus {
  if (status === 'active') return 'active'
  if (status === 'failed' || status === 'on_hold' || status === 'expired') return 'past_due'
  if (status === 'cancelled') return 'cancelled'
  return 'trialing'
}
