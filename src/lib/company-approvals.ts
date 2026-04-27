import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { normalizeCompanyStatus, type CompanyStatus } from '@/lib/security'

export type SuperAdminCompanyStatusFilter = CompanyStatus | 'ALL'

export type SerializedSuperAdminCompany = {
  id: string
  name: string
  emailDomain: string | null
  companyType: string
  country: string | null
  industry: string | null
  registrationNumber: string | null
  status: string
  reviewNote: string | null
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
  owner: {
    id: string
    name: string
    email: string
    accountStatus: string
    createdAt: string
  }
  reviewedBy: {
    id: string
    name: string
    email: string
  } | null
}

type SuperAdminCompanyRecord = {
  id: string
  name: string
  emailDomain: string | null
  companyType: string
  country: string | null
  industry: string | null
  registrationNumber: string | null
  status: string
  reviewNote: string | null
  createdAt: Date
  updatedAt: Date
  reviewedAt: Date | null
  owner: {
    id: string
    name: string
    email: string
    accountStatus: string
    createdAt: Date
  }
  reviewedBy: {
    id: string
    name: string
    email: string
  } | null
}

function serializeCompany(company: SuperAdminCompanyRecord): SerializedSuperAdminCompany {
  return {
    id: company.id,
    name: company.name,
    emailDomain: company.emailDomain,
    companyType: company.companyType,
    country: company.country,
    industry: company.industry,
    registrationNumber: company.registrationNumber,
    status: company.status,
    reviewNote: company.reviewNote,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
    reviewedAt: company.reviewedAt?.toISOString() ?? null,
    owner: {
      id: company.owner.id,
      name: company.owner.name,
      email: company.owner.email,
      accountStatus: company.owner.accountStatus,
      createdAt: company.owner.createdAt.toISOString(),
    },
    reviewedBy: company.reviewedBy
      ? {
          id: company.reviewedBy.id,
          name: company.reviewedBy.name,
          email: company.reviewedBy.email,
        }
      : null,
  }
}

function buildCompanyFilter(status: SuperAdminCompanyStatusFilter, query: string): Prisma.CompanyWhereInput {
  const normalizedQuery = query.trim()

  return {
    ...(status !== 'ALL' ? { status } : {}),
    ...(normalizedQuery
      ? {
          OR: [
            { name: { contains: normalizedQuery, mode: 'insensitive' } },
            { registrationNumber: { contains: normalizedQuery, mode: 'insensitive' } },
            { emailDomain: { contains: normalizedQuery, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
}

function normalizeStatusFilter(value?: string | null): SuperAdminCompanyStatusFilter {
  const normalized = value?.trim().toUpperCase() ?? ''
  if (normalized === 'ALL') {
    return 'ALL'
  }

  const companyStatus = normalizeCompanyStatus(normalized)
  if (companyStatus === normalized) {
    return companyStatus
  }

  return 'PENDING'
}

export async function listSuperAdminCompanies(input: { status?: string; query?: string }) {
  const status = normalizeStatusFilter(input.status)
  const query = input.query?.trim() ?? ''
  const where = buildCompanyFilter(status, query)

  const [companies, pendingCount, approvedCount, rejectedCount, disabledCount] = await Promise.all([
    prisma.company.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            accountStatus: true,
            createdAt: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    }),
    prisma.company.count({ where: { status: 'PENDING' } }),
    prisma.company.count({ where: { status: 'ACTIVE' } }),
    prisma.company.count({ where: { status: 'REJECTED' } }),
    prisma.company.count({ where: { status: 'DISABLED' } }),
  ])

  return {
    status,
    query,
    counts: {
      PENDING: pendingCount,
      ACTIVE: approvedCount,
      REJECTED: rejectedCount,
      DISABLED: disabledCount,
    },
    companies: companies.map((company) => serializeCompany(company)),
  }
}

export async function reviewCompanyRegistration(input: {
  companyId: string
  reviewerId: string
  action: 'APPROVE' | 'REJECT' | 'DISABLE'
  note?: string
}) {
  const action = input.action
  const note = input.note?.trim() || null

  if (!input.companyId.trim()) {
    throw new Error('Company id is required.')
  }

  if (!['APPROVE', 'REJECT', 'DISABLE'].includes(action)) {
    throw new Error('Invalid review action.')
  }

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: {
      id: true,
      status: true,
    },
  })

  if (!company) {
    throw new Error('Company registration was not found.')
  }

  if (action === 'REJECT' && company.status !== 'PENDING') {
    throw new Error('Only pending company requests can be rejected.')
  }

  if (action === 'DISABLE' && company.status !== 'ACTIVE') {
    throw new Error('Only active companies can be disabled.')
  }

  const nextStatus = action === 'APPROVE' ? 'ACTIVE' : action === 'REJECT' ? 'REJECTED' : 'DISABLED'
  const nextAccountStatus = action === 'APPROVE' ? 'ACTIVE' : action === 'REJECT' ? 'REJECTED' : 'DISABLED'

  const updatedCompany = await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: {
        companyId: company.id,
      },
      data: {
        accountStatus: nextAccountStatus,
      },
    })

    return tx.company.update({
      where: { id: company.id },
      data: {
        status: nextStatus,
        reviewNote: note,
        reviewedAt: new Date(),
        reviewedById: input.reviewerId,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            accountStatus: true,
            createdAt: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
  })

  return serializeCompany(updatedCompany)
}
