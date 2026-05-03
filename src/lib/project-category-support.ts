import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'

type ProjectCategorySupport = {
  hasCategoryTable: boolean
  hasProjectCategoryColumns: boolean
}

export type ProjectCategoryDto = {
  id: string
  name: string
  description: string | null
  projectCount: number
}

type ProjectAgencyFieldRow = {
  id: string
  clientName: string | null
  categoryId: string | null
  categoryName: string | null
  categoryDescription: string | null
}

const globalForProjectCategorySupport = globalThis as typeof globalThis & {
  projectCategorySupportPromise?: Promise<ProjectCategorySupport>
}

export async function getProjectCategorySupport(): Promise<ProjectCategorySupport> {
  if (!globalForProjectCategorySupport.projectCategorySupportPromise) {
    globalForProjectCategorySupport.projectCategorySupportPromise = (async () => {
      const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('ProjectCategory')
      `
      const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Project'
          AND column_name IN ('categoryId', 'clientName')
      `

      return {
        hasCategoryTable: tables.some((table) => table.table_name === 'ProjectCategory'),
        hasProjectCategoryColumns: ['categoryId', 'clientName'].every((column) =>
          columns.some((row) => row.column_name === column)
        ),
      }
    })()
  }

  return globalForProjectCategorySupport.projectCategorySupportPromise
}

export async function findProjectCategories(companyId: string): Promise<ProjectCategoryDto[]> {
  const support = await getProjectCategorySupport()
  if (!support.hasCategoryTable) return []

  const rows = await prisma.$queryRaw<
    Array<{
      id: string
      name: string
      description: string | null
      projectCount: bigint | number
    }>
  >`
    SELECT
      c."id",
      c."name",
      c."description",
      COUNT(p."id") AS "projectCount"
    FROM "ProjectCategory" c
    LEFT JOIN "Project" p ON p."categoryId" = c."id"
    WHERE c."companyId" = ${companyId}
    GROUP BY c."id", c."name", c."description", c."createdAt"
    ORDER BY c."createdAt" ASC
  `

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    projectCount: Number(row.projectCount),
  }))
}

export async function createProjectCategory(input: {
  companyId: string
  name: string
  description?: string | null
}) {
  const id = `cat_${randomUUID()}`
  const now = new Date()
  const rows = await prisma.$queryRaw<
    Array<{
      id: string
      name: string
      description: string | null
      createdAt: Date
      updatedAt: Date
    }>
  >`
    INSERT INTO "ProjectCategory" (
      "id",
      "name",
      "description",
      "companyId",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${input.name},
      ${input.description ?? null},
      ${input.companyId},
      ${now},
      ${now}
    )
    RETURNING "id", "name", "description", "createdAt", "updatedAt"
  `

  const category = rows[0]
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    projectCount: 0,
  }
}

export async function findProjectCategory(companyId: string, categoryId: string) {
  const support = await getProjectCategorySupport()
  if (!support.hasCategoryTable) return null

  const rows = await prisma.$queryRaw<Array<{ id: string; name: string; description: string | null }>>`
    SELECT "id", "name", "description"
    FROM "ProjectCategory"
    WHERE "id" = ${categoryId}
      AND "companyId" = ${companyId}
    LIMIT 1
  `

  return rows[0] ?? null
}

export async function attachProjectAgencyFields<T extends { id: string }>(
  projects: T[],
  companyId: string
): Promise<Array<T & { clientName: string | null; categoryId: string | null; category: { id: string; name: string; description: string | null } | null }>> {
  const withDefaults = projects.map((project) => ({
    ...project,
    clientName: null,
    categoryId: null,
    category: null,
  }))

  const support = await getProjectCategorySupport()
  if (!support.hasCategoryTable || !support.hasProjectCategoryColumns || projects.length === 0) {
    return withDefaults
  }

  const rows = await prisma.$queryRaw<ProjectAgencyFieldRow[]>`
    SELECT
      p."id",
      p."clientName",
      p."categoryId",
      c."name" AS "categoryName",
      c."description" AS "categoryDescription"
    FROM "Project" p
    LEFT JOIN "ProjectCategory" c ON c."id" = p."categoryId"
    WHERE p."companyId" = ${companyId}
      AND p."id" IN (${Prisma.join(projects.map((project) => project.id))})
  `
  const agencyFieldsById = new Map(rows.map((row) => [row.id, row]))

  return projects.map((project) => {
    const fields = agencyFieldsById.get(project.id)
    return {
      ...project,
      clientName: fields?.clientName ?? null,
      categoryId: fields?.categoryId ?? null,
      category:
        fields?.categoryId && fields.categoryName
          ? {
              id: fields.categoryId,
              name: fields.categoryName,
              description: fields.categoryDescription,
            }
          : null,
    }
  })
}

export async function updateProjectAgencyFields(input: {
  projectId: string
  companyId: string
  categoryId: string
  clientName?: string | null
}) {
  await prisma.$executeRaw`
    UPDATE "Project"
    SET
      "categoryId" = ${input.categoryId},
      "clientName" = ${input.clientName ?? null},
      "updatedAt" = ${new Date()}
    WHERE "id" = ${input.projectId}
      AND "companyId" = ${input.companyId}
  `
}
