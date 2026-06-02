import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiData, handleApiRoute, validateJson, type ApiParams } from '@/lib/api'

import { isAgencyCompanyType, normalizeCompanyType } from '@/lib/company-types'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import {
  createProjectCategory,
  findProjectCategories,
  getProjectCategorySupport,
} from '@/lib/project-category-support'

export const runtime = 'nodejs'

const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

export async function GET(req: NextRequest) {
  return handleApiRoute<ApiParams, unknown>(
    req,
    undefined,
    async ({ user }) => {
      if (!user.companyId) {
        return apiData([])
      }
      if (!isAgencyCompanyType(normalizeCompanyType(user.companyType))) {
        return apiData([])
      }

      const categories = await findProjectCategories(user.companyId)
      return apiData(categories)
    },
    {
      auth: 'required',
      rateLimit: { max: 30, namespace: 'categories.list', windowMs: 60_000 },
      responseMode: 'canonical',
      route: '/api/project-categories',
    }
  )
}

export async function POST(req: NextRequest) {
  return handleApiRoute<ApiParams, unknown>(
    req,
    undefined,
    async ({ user }) => {
      if (!user.companyId) {
        return apiData({ error: 'No company found for this account.' }, { status: 400 })
      }
      if (user.role === 'EMPLOYEE') {
        return apiData({ error: 'Forbidden' }, { status: 403 })
      }
      if (!isAgencyCompanyType(normalizeCompanyType(user.companyType))) {
        return apiData({ error: 'Categories are only available for agency workspaces.' }, { status: 403 })
      }

      const support = await getProjectCategorySupport()
      if (!support.hasCategoryTable || !support.hasProjectCategoryColumns) {
        return apiData({ error: 'Project categories are not ready. Apply the latest database migration first.' }, { status: 503 })
      }

      const parsed = await validateJson(req, createCategorySchema)
      const name = parsed.name.trim()
      const description = parsed.description?.trim() || null

      const category = await createProjectCategory({
        companyId: user.companyId,
        name,
        description,
      })

      emitCompanyRealtime(user.companyId, 'project_category_created', { category })

      return apiData(category, { status: 201 })
    },
    {
      auth: 'required',
      idempotency: true,
      rateLimit: { max: 20, namespace: 'categories.create', windowMs: 60_000 },
      responseMode: 'canonical',
      route: '/api/project-categories',
    }
  )
}
