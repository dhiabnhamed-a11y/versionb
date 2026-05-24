import 'server-only'

import { prisma } from '@/lib/db'

export async function getVendorMapping(workspaceId: string, vendorName: string) {
  const mapping = await prisma.eRPVendorCategoryMapping.findUnique({
    where: {
      workspaceId_vendorName: { workspaceId, vendorName: vendorName.toLowerCase().trim() },
    },
  })
  return mapping
}

export async function learnVendorMapping(
  workspaceId: string,
  vendorName: string,
  accountCode: string,
) {
  const normalized = vendorName.toLowerCase().trim()

  const existing = await prisma.eRPVendorCategoryMapping.findUnique({
    where: { workspaceId_vendorName: { workspaceId, vendorName: normalized } },
  })

  if (existing) {
    if (existing.accountCode === accountCode) {
      // Same mapping — increase confidence
      return prisma.eRPVendorCategoryMapping.update({
        where: { id: existing.id },
        data: { confidence: Math.min(1.0, existing.confidence + 0.05) },
      })
    }
    // Different mapping — overwrite (user correction is authoritative)
    return prisma.eRPVendorCategoryMapping.update({
      where: { id: existing.id },
      data: { accountCode, confidence: 0.95 },
    })
  }

  return prisma.eRPVendorCategoryMapping.create({
    data: {
      workspaceId,
      vendorName: normalized,
      accountCode,
      confidence: 0.9,
    },
  })
}

export async function listVendorMappings(workspaceId: string) {
  return prisma.eRPVendorCategoryMapping.findMany({
    where: { workspaceId },
    orderBy: { confidence: 'desc' },
  })
}
