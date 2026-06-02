import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiData, handleApiRoute, validateJson, type ApiParams } from '@/lib/api'
import { prisma } from '@/lib/db'
import { createCompanyInvite, getInviteTtlHours } from '@/lib/invites'

export const runtime = 'nodejs'

const createEmployeeSchema = z.object({
  email: z.string().email(),
  role: z.string().optional().default('EMPLOYEE'),
  ttlHours: z.coerce.number().int().positive().optional(),
})

export async function GET(req: NextRequest) {
  return handleApiRoute<ApiParams, unknown>(
    req,
    undefined,
    async ({ user }) => {
      if (user.role === 'EMPLOYEE') {
        return apiData({ error: 'Forbidden' }, { status: 403 })
      }
      if (!user.companyId) return apiData([])

      const employees = await prisma.user.findMany({
        where: { companyId: user.companyId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatar: true,
          assignedTasks: {
            select: { id: true, stage: true, priority: true, deadline: true },
          },
          activities: {
            select: { id: true, action: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })
      return apiData(employees)
    },
    {
      auth: 'required',
      rateLimit: { max: 30, namespace: 'employees.list', windowMs: 60_000 },
      responseMode: 'canonical',
      route: '/api/employees',
    }
  )
}

export async function POST(req: NextRequest) {
  return handleApiRoute<ApiParams, unknown>(
    req,
    undefined,
    async ({ user }) => {
      if (!user.companyId) {
        return apiData({ error: 'No company found for this account' }, { status: 400 })
      }
      if (user.role === 'EMPLOYEE') {
        return apiData({ error: 'Forbidden' }, { status: 403 })
      }

      const TRIAL_SEAT_LIMIT = 5
      const [companyBilling, activeUserCount] = await Promise.all([
        prisma.company.findUnique({
          where: { id: user.companyId },
          select: { seatCount: true, subscriptionStatus: true },
        }),
        prisma.user.count({
          where: { companyId: user.companyId, accountStatus: 'ACTIVE' },
        }),
      ])

      if (!companyBilling) {
        return apiData({ error: 'No billing account found. Please subscribe to add team members.', upgradeUrl: '/billing/upgrade' }, { status: 402 })
      }

      const status = companyBilling.subscriptionStatus as string
      if (status === 'ACTIVE' && activeUserCount >= companyBilling.seatCount) {
        return apiData({ error: 'You have reached your seat limit. Please upgrade your plan to add more team members.', upgradeUrl: '/billing/upgrade' }, { status: 402 })
      }
      if (status === 'TRIAL' && activeUserCount >= TRIAL_SEAT_LIMIT) {
        return apiData({ error: `Free trial is limited to ${TRIAL_SEAT_LIMIT} users. Upgrade to add more team members.`, upgradeUrl: '/billing/upgrade' }, { status: 402 })
      }
      if (status === 'PAST_DUE') {
        return apiData({ error: 'Your subscription is past due. Please update your billing to add team members.', upgradeUrl: '/billing/upgrade' }, { status: 402 })
      }
      if (status === 'CANCELED') {
        return apiData({ error: 'Your subscription has been canceled. Please subscribe to add team members.', upgradeUrl: '/billing/upgrade' }, { status: 402 })
      }
      if (status === 'PAUSED') {
        return apiData({ error: 'Your subscription is paused. Please resume your subscription to add team members.', upgradeUrl: '/billing/upgrade' }, { status: 402 })
      }

      const parsed = await validateJson(req, createEmployeeSchema)
      const invite = await createCompanyInvite({
        companyId: user.companyId,
        companyAdminId: user.id,
        companyAdminRole: user.role ?? 'EMPLOYEE',
        email: parsed.email,
        role: parsed.role,
        ttlHours: parsed.ttlHours ?? getInviteTtlHours(),
      })
      return apiData(invite, { status: 201 })
    },
    {
      auth: 'required',
      idempotency: true,
      rateLimit: { max: 10, namespace: 'employees.create', windowMs: 60_000 },
      responseMode: 'canonical',
      route: '/api/employees',
    }
  )
}
