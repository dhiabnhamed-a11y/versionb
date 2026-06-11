import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createTenantAuditExtension } from '@/lib/prisma-tenant'
import { runWithPrismaTenantContext, runWithSystemBypass, getPrismaTenantContext } from '@/lib/tenant/prisma-context'

const mockPrismaBase = new PrismaClient()
const prisma = mockPrismaBase.$extends(createTenantAuditExtension())

describe('Tenant Context Security Enforcement', () => {
  it('throws an error when executing tenant query without context', async () => {
    await expect(prisma.user.findMany()).rejects.toThrow(/SECURITY: Missing tenant context/)
  })

  it('injects companyId automatically when context is present', async () => {
    // We mock Prisma's findMany underneath to assert args
    const mockFindMany = vi.spyOn(mockPrismaBase.user, 'findMany').mockResolvedValue([])
    
    await runWithPrismaTenantContext({ companyId: 'company_123', role: 'EMPLOYEE' }, async () => {
      await prisma.user.findMany({ where: { role: 'MANAGER' } })
    })

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { role: 'MANAGER', companyId: 'company_123' },
    })
    
    mockFindMany.mockRestore()
  })

  it('allows unscoped queries when using explicit system bypass', async () => {
    const mockFindMany = vi.spyOn(mockPrismaBase.user, 'findMany').mockResolvedValue([])
    
    await runWithSystemBypass('Admin background sync', async () => {
      await prisma.user.findMany()
    })

    expect(mockFindMany).toHaveBeenCalledWith({})
    mockFindMany.mockRestore()
  })
})
