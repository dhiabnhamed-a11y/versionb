import crypto from 'node:crypto'
import { LegalConsentType as PrismaLegalConsentType, Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { getAuthSecret } from '@/lib/env'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import { badRequest } from '@/modules/shared/errors'
import { toJsonValue } from '@/modules/shared/json'
import { logger } from '@/modules/shared/logger'

export const LEGAL_DOCUMENT_VERSION = '2026.05'

export const LEGAL_CONSENT_TYPES = [
  'TERMS_OF_SERVICE',
  'PRIVACY_POLICY',
  'COOKIE_POLICY',
  'MARKETING_EMAILS',
  'AI_USAGE_DISCLOSURE',
] as const

export type LegalConsentTypeValue = (typeof LEGAL_CONSENT_TYPES)[number]

export const REQUIRED_SIGNUP_LEGAL_CONSENTS = ['TERMS_OF_SERVICE', 'PRIVACY_POLICY'] as const satisfies readonly LegalConsentTypeValue[]

export type LegalDocumentDefault = {
  documentType: LegalConsentTypeValue
  title: string
  version: string
  lastUpdated: string
  path: string
  summary: string
}

export const LEGAL_DOCUMENT_DEFAULTS: Record<LegalConsentTypeValue, LegalDocumentDefault> = {
  TERMS_OF_SERVICE: {
    documentType: 'TERMS_OF_SERVICE',
    title: 'Terms of Service',
    version: LEGAL_DOCUMENT_VERSION,
    lastUpdated: 'May 16, 2026',
    path: '/terms',
    summary: 'Commercial SaaS terms for TASKIT workspaces, subscriptions, AI features, files, integrations, and acceptable use.',
  },
  PRIVACY_POLICY: {
    documentType: 'PRIVACY_POLICY',
    title: 'Privacy Policy',
    version: LEGAL_DOCUMENT_VERSION,
    lastUpdated: 'May 16, 2026',
    path: '/privacy',
    summary: 'Privacy notice covering account data, workspace content, AI processing, integrations, analytics, retention, and rights.',
  },
  COOKIE_POLICY: {
    documentType: 'COOKIE_POLICY',
    title: 'Cookie Policy',
    version: LEGAL_DOCUMENT_VERSION,
    lastUpdated: 'May 16, 2026',
    path: '/cookies',
    summary: 'Cookie and similar technology disclosures for authentication, security, preferences, analytics, and integrations.',
  },
  MARKETING_EMAILS: {
    documentType: 'MARKETING_EMAILS',
    title: 'Marketing Email Consent',
    version: LEGAL_DOCUMENT_VERSION,
    lastUpdated: 'May 16, 2026',
    path: '/privacy#marketing-communications',
    summary: 'Optional consent for product updates, education, events, and promotional communications.',
  },
  AI_USAGE_DISCLOSURE: {
    documentType: 'AI_USAGE_DISCLOSURE',
    title: 'AI Usage and AI Transparency Policy',
    version: LEGAL_DOCUMENT_VERSION,
    lastUpdated: 'May 16, 2026',
    path: '/ai-transparency',
    summary: 'Disclosure for AI assistants, generated content, automation, human review, limitations, and customer responsibilities.',
  },
}

export type SignupLegalAcceptance = {
  termsAccepted: boolean
  privacyAccepted: boolean
  marketingEmailsAccepted: boolean
  aiUsageDisclosureAcknowledged: boolean
}

export type LegalRequestContext = {
  ipAddress: string | null
  userAgent: string | null
  locale: string | null
  requestId: string | null
}

type LegalVersionRecord = {
  documentType: LegalConsentTypeValue
  version: string
  title: string
  contentHash: string
  requiresReacceptance: boolean
  effectiveAt: Date
}

type LegalPrismaClient = typeof prisma | Prisma.TransactionClient

function isLegalConsentType(value: unknown): value is LegalConsentTypeValue {
  return typeof value === 'string' && LEGAL_CONSENT_TYPES.includes(value as LegalConsentTypeValue)
}

function normalizeBoolean(value: unknown) {
  return value === true || value === 'true' || value === 'on'
}

export function parseSignupLegalAcceptance(payload: unknown): SignupLegalAcceptance {
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const legal = body.legalConsent && typeof body.legalConsent === 'object' ? (body.legalConsent as Record<string, unknown>) : body

  return {
    termsAccepted: normalizeBoolean(legal.termsAccepted),
    privacyAccepted: normalizeBoolean(legal.privacyAccepted),
    marketingEmailsAccepted: normalizeBoolean(legal.marketingEmailsAccepted),
    aiUsageDisclosureAcknowledged: normalizeBoolean(legal.aiUsageDisclosureAcknowledged),
  }
}

export function assertSignupLegalAcceptance(payload: unknown) {
  const acceptance = parseSignupLegalAcceptance(payload)

  if (!acceptance.termsAccepted || !acceptance.privacyAccepted) {
    throw badRequest('You must accept the Terms of Service and Privacy Policy before creating an account.', {
      termsAccepted: acceptance.termsAccepted,
      privacyAccepted: acceptance.privacyAccepted,
    })
  }

  return acceptance
}

export function getClientIpFromHeaders(headers: Headers) {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return headers.get('cf-connecting-ip')?.trim() || headers.get('x-real-ip')?.trim() || forwarded || null
}

export function getLegalRequestContext(req: Request, requestId?: string | null, locale?: string | null): LegalRequestContext {
  const acceptLanguage = req.headers.get('accept-language')?.split(',')[0]?.trim() || null

  return {
    ipAddress: getClientIpFromHeaders(req.headers),
    userAgent: req.headers.get('user-agent'),
    locale: locale?.trim() || acceptLanguage,
    requestId: requestId ?? null,
  }
}

function hashLegalDocumentDefault(document: LegalDocumentDefault) {
  return crypto
    .createHash('sha256')
    .update(`${document.documentType}:${document.version}:${document.title}:${document.summary}`)
    .digest('hex')
}

export function getDefaultLegalVersions(): Record<LegalConsentTypeValue, LegalVersionRecord> {
  return Object.fromEntries(
    LEGAL_CONSENT_TYPES.map((documentType) => {
      const document = LEGAL_DOCUMENT_DEFAULTS[documentType]
      return [
        documentType,
        {
          documentType,
          version: document.version,
          title: document.title,
          contentHash: hashLegalDocumentDefault(document),
          requiresReacceptance: false,
          effectiveAt: new Date(`${document.lastUpdated} 00:00:00 UTC`),
        },
      ]
    })
  ) as Record<LegalConsentTypeValue, LegalVersionRecord>
}

export async function getActiveLegalVersions(client: LegalPrismaClient = prisma) {
  const fallback = getDefaultLegalVersions()
  const active = await client.legalDocumentVersion
    .findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
    })
    .catch((error) => {
      if (!isMissingDatabaseObjectError(error)) throw error
      logger.warn('legal.active_versions_missing_schema_fallback')
      return []
    })

  for (const version of active) {
    if (!isLegalConsentType(version.documentType)) continue
    fallback[version.documentType] = {
      documentType: version.documentType,
      version: version.version,
      title: version.title,
      contentHash: version.contentHash,
      requiresReacceptance: version.requiresReacceptance,
      effectiveAt: version.effectiveAt,
    }
  }

  return fallback
}

function getConsentSigningSecret() {
  const configured = process.env.LEGAL_CONSENT_SIGNING_SECRET?.trim()
  if (configured) return configured
  if (process.env.NODE_ENV === 'production') {
    throw new Error('LEGAL_CONSENT_SIGNING_SECRET is required in production.')
  }
  const fallback = getAuthSecret('legal-consent')
  if (fallback) return fallback
  throw new Error('LEGAL_CONSENT_SIGNING_SECRET is not configured.')
}

export function buildConsentHash(input: {
  acceptedAt: Date
  companyId: string | null
  consentType: LegalConsentTypeValue
  documentVersion: string
  ipAddress: string | null
  locale: string | null
  requestId: string | null
  userAgent: string | null
  userId: string
}) {
  const payload = [
    input.userId,
    input.companyId ?? '',
    input.consentType,
    input.documentVersion,
    input.acceptedAt.toISOString(),
    input.ipAddress ?? '',
    input.userAgent ?? '',
    input.locale ?? '',
    input.requestId ?? '',
  ].join('|')

  return crypto.createHmac('sha256', getConsentSigningSecret()).update(payload).digest('hex')
}

export async function persistSignupLegalConsents(
  tx: Prisma.TransactionClient,
  input: {
    acceptance: SignupLegalAcceptance
    companyId: string | null
    context: LegalRequestContext
    userId: string
  }
) {
  const activeVersions = await getActiveLegalVersions(tx)
  const acceptedAt = new Date()
  const acceptedTypes: LegalConsentTypeValue[] = [...REQUIRED_SIGNUP_LEGAL_CONSENTS]

  if (input.acceptance.marketingEmailsAccepted) {
    acceptedTypes.push('MARKETING_EMAILS')
  }

  if (input.acceptance.aiUsageDisclosureAcknowledged) {
    acceptedTypes.push('AI_USAGE_DISCLOSURE')
  }

  const consentRecords = acceptedTypes.map((consentType) => {
    const activeVersion = activeVersions[consentType]

    return {
      userId: input.userId,
      companyId: input.companyId,
      consentType,
      documentVersion: activeVersion.version,
      acceptedAt,
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      locale: input.context.locale,
      requestId: input.context.requestId,
      source: 'SIGNUP',
      consentHash: buildConsentHash({
        acceptedAt,
        companyId: input.companyId,
        consentType,
        documentVersion: activeVersion.version,
        ipAddress: input.context.ipAddress,
        locale: input.context.locale,
        requestId: input.context.requestId,
        userAgent: input.context.userAgent,
        userId: input.userId,
      }),
    }
  })

  await tx.legalConsent
    .createMany({
      data: consentRecords,
    })
    .catch((error) => {
      if (!isMissingDatabaseObjectError(error)) throw error
      logger.warn('legal.signup_consent_records_skipped_missing_schema', {
        companyId: input.companyId,
        userId: input.userId,
        consentTypes: consentRecords.map((record) => record.consentType),
      })
    })

  await tx.auditLog
    .create({
      data: {
        action: 'legal.signup_consent_accepted',
        actorId: input.userId,
        companyId: input.companyId,
        entityId: input.userId,
        entityType: 'legal_consent',
        after: toJsonValue({
          consentTypes: consentRecords.map((record) => record.consentType),
          documentVersions: Object.fromEntries(consentRecords.map((record) => [record.consentType, record.documentVersion])),
          hashes: consentRecords.map((record) => record.consentHash),
        }),
        metadata: toJsonValue({
          source: 'SIGNUP',
          ipAddressCaptured: Boolean(input.context.ipAddress),
          userAgentCaptured: Boolean(input.context.userAgent),
        }),
        requestId: input.context.requestId,
        ipAddress: input.context.ipAddress,
        userAgent: input.context.userAgent,
      },
    })
    .catch((error) => {
      if (!isMissingDatabaseObjectError(error)) throw error
      logger.warn('legal.signup_consent_audit_skipped_missing_schema', {
        companyId: input.companyId,
        userId: input.userId,
      })
    })

  return consentRecords
}

export async function listLegalAdminSnapshot() {
  const activeVersions = await getActiveLegalVersions()
  const [recentConsents, consentCounts] = await Promise.all([
    prisma.legalConsent.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { acceptedAt: 'desc' },
      take: 50,
    }),
    Promise.all(
      LEGAL_CONSENT_TYPES.map(async (consentType) => [
        consentType,
        await prisma.legalConsent.count({
          where: {
            consentType,
          },
        }),
      ])
    ),
  ])

  return {
    activeVersions: Object.values(activeVersions).map((version) => ({
      ...version,
      effectiveAt: version.effectiveAt.toISOString(),
    })),
    counts: Object.fromEntries(consentCounts),
    recentConsents: recentConsents.map((consent) => ({
      id: consent.id,
      userId: consent.userId,
      userName: consent.user.name,
      userEmail: consent.user.email,
      companyId: consent.companyId,
      companyName: consent.company?.name ?? null,
      consentType: consent.consentType,
      documentVersion: consent.documentVersion,
      acceptedAt: consent.acceptedAt.toISOString(),
      ipAddress: consent.ipAddress,
      userAgent: consent.userAgent,
      locale: consent.locale,
      consentHash: consent.consentHash,
      source: consent.source,
    })),
  }
}

export async function publishLegalDocumentVersion(input: {
  contentHash?: string
  documentType: string
  publishedById: string
  requiresReacceptance: boolean
  summary?: string | null
  title?: string
  version: string
}) {
  if (!isLegalConsentType(input.documentType)) {
    throw badRequest('Choose a valid legal document type.')
  }
  const documentType = input.documentType as PrismaLegalConsentType

  const version = input.version.trim()
  if (!/^\d{4}\.\d{2}(?:\.[a-z0-9-]+)?$/i.test(version)) {
    throw badRequest('Use a document version like 2026.05 or 2026.05.patch-1.')
  }

  const defaultDocument = LEGAL_DOCUMENT_DEFAULTS[input.documentType]
  const title = input.title?.trim() || defaultDocument.title
  const contentHash =
    input.contentHash?.trim() ||
    crypto.createHash('sha256').update(`${input.documentType}:${version}:${title}:${input.summary ?? ''}`).digest('hex')

  return prisma.$transaction(async (tx) => {
    await tx.legalDocumentVersion.updateMany({
      where: {
        documentType,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    })

    const legalVersion = await tx.legalDocumentVersion.upsert({
      where: {
        documentType_version: {
          documentType,
          version,
        },
      },
      create: {
        documentType,
        version,
        title,
        summary: input.summary?.trim() || null,
        contentHash,
        isActive: true,
        requiresReacceptance: input.requiresReacceptance,
        publishedAt: new Date(),
        publishedById: input.publishedById,
      },
      update: {
        title,
        summary: input.summary?.trim() || null,
        contentHash,
        isActive: true,
        requiresReacceptance: input.requiresReacceptance,
        publishedAt: new Date(),
        publishedById: input.publishedById,
      },
    })

    await tx.auditLog.create({
      data: {
        action: 'legal.document_version_published',
        actorId: input.publishedById,
        entityId: legalVersion.id,
        entityType: 'legal_document_version',
        after: toJsonValue({
          documentType: legalVersion.documentType,
          version: legalVersion.version,
          requiresReacceptance: legalVersion.requiresReacceptance,
        }),
      },
    })

    return legalVersion
  })
}

export async function getUsersMissingRequiredLegalAcceptance(companyId?: string | null) {
  const activeVersions = await getActiveLegalVersions()
  const users = await prisma.user.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      accountStatus: {
        in: ['ACTIVE', 'PENDING'],
      },
    },
    select: {
      id: true,
      email: true,
      companyId: true,
      legalConsents: {
        where: {
          consentType: {
            in: [...REQUIRED_SIGNUP_LEGAL_CONSENTS],
          },
        },
        select: {
          consentType: true,
          documentVersion: true,
        },
      },
    },
  })

  return users
    .map((user) => {
      const missing = REQUIRED_SIGNUP_LEGAL_CONSENTS.filter((consentType) => {
        const activeVersion = activeVersions[consentType]
        return !user.legalConsents.some(
          (consent) => consent.consentType === consentType && consent.documentVersion === activeVersion.version
        )
      })

      return {
        userId: user.id,
        email: user.email,
        companyId: user.companyId,
        missing,
      }
    })
    .filter((user) => user.missing.length > 0)
}

export function getMissingRequiredConsentTypes(
  acceptedConsents: Array<{ consentType: string; documentVersion: string }>,
  activeVersions: Pick<Record<LegalConsentTypeValue, LegalVersionRecord>, 'TERMS_OF_SERVICE' | 'PRIVACY_POLICY'>
) {
  return REQUIRED_SIGNUP_LEGAL_CONSENTS.filter((consentType) => {
    const activeVersion = activeVersions[consentType]
    return !acceptedConsents.some(
      (consent) => consent.consentType === consentType && consent.documentVersion === activeVersion.version
    )
  })
}

export async function exportLegalConsentRows() {
  const consents = await prisma.legalConsent.findMany({
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      company: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { acceptedAt: 'desc' },
    take: 10_000,
  })

  return consents.map((consent) => ({
    id: consent.id,
    userId: consent.userId,
    userEmail: consent.user.email,
    userName: consent.user.name,
    companyId: consent.companyId ?? '',
    companyName: consent.company?.name ?? '',
    consentType: consent.consentType,
    documentVersion: consent.documentVersion,
    acceptedAt: consent.acceptedAt.toISOString(),
    ipAddress: consent.ipAddress ?? '',
    userAgent: consent.userAgent ?? '',
    locale: consent.locale ?? '',
    source: consent.source,
    consentHash: consent.consentHash,
    requestId: consent.requestId ?? '',
    createdAt: consent.createdAt.toISOString(),
  }))
}
