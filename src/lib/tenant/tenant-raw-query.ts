import { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getPrismaTenantContext } from './prisma-context'

function assertTenantContext(operation: string): void {
  const ctx = getPrismaTenantContext()
  if (!ctx) {
    throw new Error(`SECURITY: Missing tenant context — ${operation} blocked. Wrap entry point in runWithPrismaTenantContext.`)
  }
}

// Support both tagged template literal and Prisma.Sql argument
export function tenantQueryRaw<T = unknown>(sqlOrStrings: Prisma.Sql | TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  assertTenantContext('raw query')
  const client = prisma as unknown as PrismaClient
  if (typeof (sqlOrStrings as TemplateStringsArray).raw !== 'undefined') {
    // Tagged template literal: tenantQueryRaw`SELECT ...`
    // eslint-disable-next-line no-restricted-syntax
    return client.$queryRaw<T[]>(sqlOrStrings as TemplateStringsArray, ...values)
  }
  // Prisma.Sql object: tenantQueryRaw(Prisma.sql`SELECT ...`)
  // eslint-disable-next-line no-restricted-syntax
  return client.$queryRaw<T[]>(sqlOrStrings as Prisma.Sql)
}

export function tenantExecuteRaw(sqlOrStrings: Prisma.Sql | TemplateStringsArray, ...values: unknown[]): Promise<number> {
  assertTenantContext('raw execution')
  const client = prisma as unknown as PrismaClient
  if (typeof (sqlOrStrings as TemplateStringsArray).raw !== 'undefined') {
    // eslint-disable-next-line no-restricted-syntax
    return client.$executeRaw(sqlOrStrings as TemplateStringsArray, ...values)
  }
  // eslint-disable-next-line no-restricted-syntax
  return client.$executeRaw(sqlOrStrings as Prisma.Sql)
}

