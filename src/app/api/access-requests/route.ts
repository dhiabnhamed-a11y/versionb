import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiData, handleApiRoute, validateJson, type ApiParams } from '@/lib/api'

import { listCompanyAccessRequests, reviewCompanyAccessRequest, submitDomainAccessRequest } from '@/lib/onboarding'

const accessRequestCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().optional().default(''),
})

const accessRequestReviewSchema = z.object({
  requestId: z.string().min(1),
  action: z.enum(['APPROVE', 'REJECT']).optional().default('REJECT'),
  ttlHours: z.coerce.number().int().positive().optional(),
})

export async function GET(req: NextRequest) {
  return handleApiRoute<ApiParams, unknown>(
    req,
    undefined,
    async ({ user }) => {
      if (!user.companyId) {
        return apiData([])
      }
      if (!user.id || user.role === 'EMPLOYEE') {
        return apiData({ error: 'Forbidden' }, { status: 403 })
      }

      const requests = await listCompanyAccessRequests(user.companyId)
      return apiData(requests)
    },
    {
      auth: 'required',
      rateLimit: { max: 30, namespace: 'access-requests.list', windowMs: 60_000 },
      responseMode: 'canonical',
      route: '/api/access-requests',
    }
  )
}

export async function POST(req: NextRequest) {
  return handleApiRoute<ApiParams, unknown>(
    req,
    undefined,
    async () => {
      const parsed = await validateJson(req, accessRequestCreateSchema)

      const request = await submitDomainAccessRequest({
        name: parsed.name,
        email: parsed.email,
        role: parsed.role,
      })

      return apiData(request, { status: 201 })
    },
    {
      auth: 'none',
      rateLimit: { max: 5, namespace: 'access-requests.create', windowMs: 60_000 },
      responseMode: 'canonical',
      route: '/api/access-requests',
    }
  )
}

export async function PATCH(req: NextRequest) {
  return handleApiRoute<ApiParams, unknown>(
    req,
    undefined,
    async ({ user }) => {
      if (!user.companyId || !user.id || user.role === 'EMPLOYEE') {
        return apiData({ error: 'Forbidden' }, { status: 403 })
      }

      const parsed = await validateJson(req, accessRequestReviewSchema)

      const result = await reviewCompanyAccessRequest({
        requestId: parsed.requestId,
        action: parsed.action,
        reviewerId: user.id,
        reviewerRole: user.role ?? 'EMPLOYEE',
        companyId: user.companyId,
        ttlHours: parsed.ttlHours,
      })

      return apiData(result)
    },
    {
      auth: 'required',
      idempotency: true,
      rateLimit: { max: 20, namespace: 'access-requests.review', windowMs: 60_000 },
      responseMode: 'canonical',
      route: '/api/access-requests',
    }
  )
}
