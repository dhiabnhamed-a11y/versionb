import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiData, handleApiRoute, validateJson, type ApiParams } from '@/lib/api'
import { createCompanyInvite, getInviteTtlHours, listCompanyInvites } from '@/lib/invites'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import { prisma } from '@/lib/db'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

const inviteCreateSchema = z.object({
  email: z.string().email().optional(),
  role: z.string().optional(),
  ttlHours: z.coerce.number().int().positive().optional(),
})

function checkSeatLimit(status: string, activeUserCount: number, seatCount: number): { error: string; upgradeUrl: string } | null {
  const TRIAL_SEAT_LIMIT = 5
  if (status === 'ACTIVE' && activeUserCount >= seatCount) {
    return { error: 'You have reached your seat limit. Please upgrade your plan to add more team members.', upgradeUrl: '/billing/upgrade' }
  }
  if (status === 'TRIAL' && activeUserCount >= TRIAL_SEAT_LIMIT) {
    return { error: `Free trial is limited to ${TRIAL_SEAT_LIMIT} users. Upgrade to add more team members.`, upgradeUrl: '/billing/upgrade' }
  }
  if (status === 'PAST_DUE') {
    return { error: 'Your subscription is past due. Please update your billing to add team members.', upgradeUrl: '/billing/upgrade' }
  }
  if (status === 'CANCELED') {
    return { error: 'Your subscription has been canceled. Please subscribe to add team members.', upgradeUrl: '/billing/upgrade' }
  }
  if (status === 'PAUSED') {
    return { error: 'Your subscription is paused. Please resume your subscription to add team members.', upgradeUrl: '/billing/upgrade' }
  }
  return null
}

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute<ApiParams, unknown>(
req,
undefined,
async ({ user }) => {
  if (!user.companyId) {
    return apiData([])
  }
  if (user.role === 'EMPLOYEE') {
    return apiData({ error: 'Forbidden' }, { status: 403 }) as never
  }

  const invites = await listCompanyInvites(user.companyId)
  return apiData(invites)
},
{
  auth: 'required',
  rateLimit: { max: 30, namespace: 'invites.list', windowMs: 60_000 },
  responseMode: 'canonical',
  route: '/api/invites',
}
)
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute<ApiParams, unknown>(
req,
undefined,
async ({ user }) => {
  if (!user.companyId) {
    return apiData({ error: 'No company found for this account.' }, { status: 400 }) as never
  }
  if (!user.id || user.role === 'EMPLOYEE') {
    return apiData({ error: 'Forbidden' }, { status: 403 }) as never
  }

  const parsed = await validateJson(req, inviteCreateSchema)

  const [companyBilling, activeUserCount] = await Promise.all([
    prisma.company.findUnique({
      where: { id: user.companyId },
      select: { seatCount: true, subscriptionStatus: true, planType: true },
    }),
    prisma.user.count({
      where: { companyId: user.companyId, accountStatus: 'ACTIVE' },
    }),
  ])

  if (!companyBilling) {
    return apiData({ error: 'No billing account found. Please subscribe to add team members.', upgradeUrl: '/billing/upgrade' }, { status: 402 }) as never
  }

  const status = companyBilling.subscriptionStatus as string
  const seatLimit = checkSeatLimit(status, activeUserCount, companyBilling.seatCount)
  if (seatLimit) {
    return apiData(seatLimit, { status: 402 })
  }

  const invite = await createCompanyInvite({
    companyId: user.companyId,
    companyAdminId: user.id,
    companyAdminRole: user.role ?? 'EMPLOYEE',
    email: parsed.email ?? '',
    role: parsed.role ?? 'EMPLOYEE',
    ttlHours: parsed.ttlHours ?? getInviteTtlHours(),
  })

  emitCompanyRealtime(user.companyId, 'employee_invited', { invite })

  return apiData(invite, { status: 201 })
},
{
  auth: 'required',
  idempotency: true,
  rateLimit: { max: 10, namespace: 'invites.create', windowMs: 60_000 },
  responseMode: 'canonical',
  route: '/api/invites',
}
)
}, { auth: 'required' });
