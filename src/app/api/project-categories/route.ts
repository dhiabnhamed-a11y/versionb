import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { isAgencyCompanyType, normalizeCompanyType } from '@/lib/company-types'
import { emitCompanyRealtime } from '@/lib/realtime-server'
import {
  createProjectCategory,
  findProjectCategories,
  getProjectCategorySupport,
} from '@/lib/project-category-support'

type SessionUser = {
  companyId?: string | null
  role?: string
  companyType?: string | null
}

export async function GET() {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const typedUser = user as SessionUser
  if (!user.companyId) {
    return NextResponse.json([])
  }

  if (!isAgencyCompanyType(normalizeCompanyType(user.companyType))) {
    return NextResponse.json([])
  }

  try {
    return NextResponse.json(await findProjectCategories(user.companyId))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load categories.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const typedUser = user as SessionUser
  if (!user.companyId) {
    return NextResponse.json({ error: 'No company found for this account.' }, { status: 400 })
  }

  if (user.role === 'EMPLOYEE') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isAgencyCompanyType(normalizeCompanyType(user.companyType))) {
    return NextResponse.json({ error: 'Categories are only available for agency workspaces.' }, { status: 403 })
  }

  const support = await getProjectCategorySupport()
  if (!support.hasCategoryTable || !support.hasProjectCategoryColumns) {
    return NextResponse.json(
      { error: 'Project categories are not ready. Apply the latest database migration first.' },
      { status: 503 }
    )
  }

  try {
    const body = (await req.json()) as {
      name?: string
      description?: string
    }

    const name = body.name?.trim()
    const description = body.description?.trim()

    if (!name) {
      return NextResponse.json({ error: 'Category name is required.' }, { status: 400 })
    }

    const category = await createProjectCategory({
        companyId: user.companyId,
        name,
        description: description || null,
      })

    emitCompanyRealtime(user.companyId, 'project_category_created', { category })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error(error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'A category with this name already exists.' }, { status: 409 })
    }

    return NextResponse.json({ error: 'Failed to create category.' }, { status: 500 })
  }
}
