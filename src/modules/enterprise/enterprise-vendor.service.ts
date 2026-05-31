import { Prisma } from '@prisma/client'
import { enterpriseRepositoryPrisma, enterpriseRepositoryTransaction } from '@/modules/enterprise/enterprise.repository'
import { recordEnterpriseAuditTx } from '@/modules/enterprise/enterprise-audit'
import { assertCan, canManageWorkspace } from '@/modules/permissions/permissions'
import { badRequest, forbidden, notFound } from '@/modules/shared/errors'
import { publishDomainEvent } from '@/modules/events/event-bus'
import type { SessionUser } from '@/modules/shared/session'

function requireCompany(user: SessionUser) {
  if (!user.companyId) throw badRequest('No company found.')
  return user.companyId
}

// ── Vendors ──────────────────────────────────────────────────────

export async function listVendors(user: SessionUser) {
  const companyId = requireCompany(user)
  assertCan(user, 'read', 'asset', { companyId })
  return enterpriseRepositoryPrisma.enterpriseVendor.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { assets: true, contracts: true } } },
  })
}

export async function getVendor(user: SessionUser, id: string) {
  const companyId = requireCompany(user)
  assertCan(user, 'read', 'asset', { companyId })
  const vendor = await enterpriseRepositoryPrisma.enterpriseVendor.findFirst({
    where: { id, companyId },
    include: {
      assets: { select: { id: true, name: true, assetTag: true, lifecycleState: true }, take: 50 },
      contracts: { select: { id: true, title: true, contractNumber: true, type: true, status: true, startDate: true, endDate: true }, take: 50 },
    },
  })
  if (!vendor) throw notFound('Vendor not found.')
  return vendor
}

export async function createVendor(user: SessionUser, input: {
  name: string
  code?: string
  category?: string
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  notes?: string | null
}) {
  const companyId = requireCompany(user)
  assertCan(user, 'create', 'asset', { companyId })

  const vendor = await enterpriseRepositoryPrisma.enterpriseVendor.create({
    data: {
      companyId,
      name: input.name,
      code: input.code || input.name.toUpperCase().replace(/\s+/g, '_').slice(0, 20),
      category: input.category || 'HARDWARE',
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      notes: input.notes ?? null,
    },
  })

  await publishDomainEvent({
    type: 'enterprise.vendor.created', companyId, actorId: user.id,
    entityType: 'enterprise_vendor', entityId: vendor.id,
    action: 'Enterprise vendor created', payload: { vendor },
    after: vendor,
  })

  return vendor
}

export async function updateVendor(user: SessionUser, id: string, input: {
  name?: string
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  rating?: number | null
  notes?: string | null
  status?: string
}) {
  const companyId = requireCompany(user)
  const existing = await enterpriseRepositoryPrisma.enterpriseVendor.findFirst({ where: { id, companyId } })
  if (!existing) throw notFound('Vendor not found.')
  assertCan(user, 'update', 'asset', { companyId })

  const updated = await enterpriseRepositoryPrisma.enterpriseVendor.update({
    where: { id },
    data: {
      name: input.name,
      contactName: input.contactName === undefined ? undefined : input.contactName,
      contactEmail: input.contactEmail === undefined ? undefined : input.contactEmail,
      contactPhone: input.contactPhone === undefined ? undefined : input.contactPhone,
      rating: input.rating === undefined ? undefined : input.rating,
      notes: input.notes === undefined ? undefined : input.notes,
      status: input.status?.toUpperCase(),
    },
  })

  await publishDomainEvent({
    type: 'enterprise.vendor.updated', companyId, actorId: user.id,
    entityType: 'enterprise_vendor', entityId: id,
    action: 'Enterprise vendor updated', payload: { vendor: updated },
    before: existing, after: updated,
  })

  return updated
}

// ── Contracts ────────────────────────────────────────────────────

export async function listContracts(user: SessionUser, vendorId?: string) {
  const companyId = requireCompany(user)
  assertCan(user, 'read', 'asset', { companyId })
  return enterpriseRepositoryPrisma.enterpriseContract.findMany({
    where: { companyId, ...(vendorId ? { vendorId } : {}) },
    orderBy: { startDate: 'desc' },
    include: { vendor: { select: { id: true, name: true } }, _count: { select: { assets: true } } },
  })
}

export async function getContract(user: SessionUser, id: string) {
  const companyId = requireCompany(user)
  assertCan(user, 'read', 'asset', { companyId })
  const contract = await enterpriseRepositoryPrisma.enterpriseContract.findFirst({
    where: { id, companyId },
    include: {
      vendor: { select: { id: true, name: true } },
      assets: { select: { id: true, name: true, assetTag: true, lifecycleState: true }, take: 50 },
    },
  })
  if (!contract) throw notFound('Contract not found.')
  return contract
}

export async function createContract(user: SessionUser, input: {
  vendorId?: string | null
  contractNumber: string
  title: string
  type?: string
  startDate: string
  endDate?: string | null
  value?: number | null
  renewalDate?: string | null
  autoRenew?: boolean
  terms?: Record<string, unknown> | null
}) {
  const companyId = requireCompany(user)
  assertCan(user, 'create', 'asset', { companyId })

  if (input.vendorId) {
    const vendor = await enterpriseRepositoryPrisma.enterpriseVendor.findFirst({ where: { id: input.vendorId, companyId } })
    if (!vendor) throw badRequest('Vendor not found.')
  }

  const contract = await enterpriseRepositoryPrisma.enterpriseContract.create({
    data: {
      companyId,
      vendorId: input.vendorId ?? null,
      contractNumber: input.contractNumber,
      title: input.title,
      type: input.type || 'SERVICE',
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : null,
      value: input.value == null ? undefined : new Prisma.Decimal(input.value),
      renewalDate: input.renewalDate ? new Date(input.renewalDate) : null,
      autoRenew: input.autoRenew ?? false,
      terms: input.terms as Prisma.InputJsonValue ?? undefined,
    },
    include: { vendor: { select: { id: true, name: true } } },
  })

  await publishDomainEvent({
    type: 'enterprise.contract.created', companyId, actorId: user.id,
    entityType: 'enterprise_contract', entityId: contract.id,
    action: 'Enterprise contract created', payload: { contract },
    after: contract,
  })

  return contract
}

export async function updateContract(user: SessionUser, id: string, input: {
  title?: string
  status?: string
  endDate?: string | null
  renewalDate?: string | null
  autoRenew?: boolean
  value?: number | null
  terms?: Record<string, unknown> | null
}) {
  const companyId = requireCompany(user)
  const existing = await enterpriseRepositoryPrisma.enterpriseContract.findFirst({ where: { id, companyId } })
  if (!existing) throw notFound('Contract not found.')
  assertCan(user, 'update', 'asset', { companyId })

  const updated = await enterpriseRepositoryPrisma.enterpriseContract.update({
    where: { id },
    data: {
      title: input.title,
      status: input.status?.toUpperCase(),
      endDate: input.endDate === undefined ? undefined : (input.endDate ? new Date(input.endDate) : null),
      renewalDate: input.renewalDate === undefined ? undefined : (input.renewalDate ? new Date(input.renewalDate) : null),
      autoRenew: input.autoRenew,
      value: input.value === undefined ? undefined : input.value === null ? null : new Prisma.Decimal(input.value),
      terms: input.terms as Prisma.InputJsonValue ?? undefined,
    },
    include: { vendor: { select: { id: true, name: true } } },
  })

  await publishDomainEvent({
    type: 'enterprise.contract.updated', companyId, actorId: user.id,
    entityType: 'enterprise_contract', entityId: id,
    action: 'Enterprise contract updated', payload: { contract: updated },
    before: existing, after: updated,
  })

  return updated
}

// ── Leases ───────────────────────────────────────────────────────

export async function listLeases(user: SessionUser, assetId?: string) {
  const companyId = requireCompany(user)
  assertCan(user, 'read', 'asset', { companyId })
  return enterpriseRepositoryPrisma.enterpriseAssetLease.findMany({
    where: { companyId, ...(assetId ? { assetId } : {}) },
    orderBy: { startDate: 'desc' },
    include: { asset: { select: { id: true, name: true, assetTag: true } } },
  })
}

export async function getLease(user: SessionUser, id: string) {
  const companyId = requireCompany(user)
  assertCan(user, 'read', 'asset', { companyId })
  const lease = await enterpriseRepositoryPrisma.enterpriseAssetLease.findFirst({
    where: { id, companyId },
    include: { asset: { select: { id: true, name: true, assetTag: true, serialNumber: true } } },
  })
  if (!lease) throw notFound('Lease not found.')
  return lease
}

export async function createLease(user: SessionUser, input: {
  assetId: string
  lessor: string
  startDate: string
  endDate: string
  monthlyCost: number
  purchaseOption?: number | null
}) {
  const companyId = requireCompany(user)
  assertCan(user, 'create', 'asset', { companyId })

  const asset = await enterpriseRepositoryPrisma.enterpriseAsset.findFirst({ where: { id: input.assetId, companyId, deletedAt: null } })
  if (!asset) throw badRequest('Asset not found.')

  const lease = await enterpriseRepositoryPrisma.enterpriseAssetLease.create({
    data: {
      companyId,
      assetId: input.assetId,
      lessor: input.lessor,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      monthlyCost: new Prisma.Decimal(input.monthlyCost),
      purchaseOption: input.purchaseOption == null ? undefined : new Prisma.Decimal(input.purchaseOption),
    },
    include: { asset: { select: { id: true, name: true, assetTag: true } } },
  })

  await publishDomainEvent({
    type: 'enterprise.lease.created', companyId, actorId: user.id,
    entityType: 'enterprise_asset_lease', entityId: lease.id,
    action: 'Enterprise lease created', payload: { lease },
    after: lease,
  })

  return lease
}

export async function endLease(user: SessionUser, id: string, input: { status?: string }) {
  const companyId = requireCompany(user)
  const existing = await enterpriseRepositoryPrisma.enterpriseAssetLease.findFirst({ where: { id, companyId } })
  if (!existing) throw notFound('Lease not found.')
  assertCan(user, 'update', 'asset', { companyId })

  const updated = await enterpriseRepositoryPrisma.enterpriseAssetLease.update({
    where: { id },
    data: { status: input.status?.toUpperCase() || 'TERMINATED' },
    include: { asset: { select: { id: true, name: true, assetTag: true } } },
  })

  await publishDomainEvent({
    type: 'enterprise.lease.updated', companyId, actorId: user.id,
    entityType: 'enterprise_asset_lease', entityId: id,
    action: 'Enterprise lease ended', payload: { lease: updated },
    before: existing, after: updated,
  })

  return updated
}
