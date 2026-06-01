import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'

import { isCompanyType, normalizeCompanyType, type CompanyType } from '@/lib/company-types'
import { prisma } from '@/lib/db'
import { persistSignupLegalConsents, type LegalRequestContext, type SignupLegalAcceptance } from '@/lib/legal'
import { isMissingDatabaseObjectError } from '@/lib/prisma-errors'
import { createSignupAuthUser, rollbackSignupAuthUser } from '@/lib/signup-auth-user'
import { provisionWorkspaceForCompany } from '@/lib/workspace-provisioning'
import {
  clampSeatCount,
  getDefaultIsolation,
  getDefaultPlanForWorkspace,
  getIsolationType,
  getWorkspacePlan,
  getWorkspacePricing,
  isFreePlan,
  type BillingCycle,
} from '@/lib/workspace-pricing'
import { logger } from '@/modules/shared/logger'
import {
  createCompanyInvite,
  getInviteTtlHours,
  InviteFlowError,
  isInvitableRole,
  normalizeEmail,
  type SerializedInvite,
} from '@/lib/invites'

export const SIGNUP_ROLES = ['OWNER', 'MANAGER', 'EMPLOYEE'] as const
export type SignupRole = (typeof SIGNUP_ROLES)[number]

const SIGNUP_TRANSACTION_MAX_WAIT_MS = 10_000
const SIGNUP_TRANSACTION_TIMEOUT_MS = 30_000

const DEFAULT_BLOCKED_OWNER_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'me.com',
  'msn.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
]

export type SerializedAccessRequest = {
  id: string
  companyId: string
  companyName: string
  email: string
  name: string
  role: string
  status: string
  createdAt: string
  reviewedAt: string | null
  invite: Pick<SerializedInvite, 'id' | 'code' | 'inviteLink' | 'expiresAt' | 'used' | 'usedAt'> | null
}

type AccessRequestRecord = {
  id: string
  companyId: string
  email: string
  name: string
  role: string
  status: string
  createdAt: Date
  reviewedAt: Date | null
  company: {
    name: string
  }
  invite: {
    id: string
    code: string
    expiresAt: Date
    used: boolean
    usedAt: Date | null
  } | null
}

type CreateOwnerSignupInput = {
  name: string
  email: string
  password: string
  companyName: string
  country: string
  industry: string
  registrationNumber: string
  companyType: CompanyType
  billingSelection?: {
    planId?: string
    seatCount?: number
    isolationEnabled?: boolean
    billingCycle?: BillingCycle
  }
  legalAcceptance: SignupLegalAcceptance
  legalContext: LegalRequestContext
}

type SubmitAccessRequestInput = {
  name: string
  email: string
  role: string
}

type ReviewAccessRequestInput = {
  requestId: string
  action: 'APPROVE' | 'REJECT'
  reviewerId: string
  reviewerRole: string
  companyId: string
  ttlHours?: number
}

export function extractEmailDomain(email: string) {
  const normalized = normalizeEmail(email)
  const [, domain = ''] = normalized.split('@')
  return domain
}

function parseCsvDomains(value: string | undefined, fallback: string[] = []) {
  const raw = value?.trim()
  if (!raw) return fallback

  return raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

export function getBlockedOwnerEmailDomains() {
  return parseCsvDomains(process.env.BLOCKED_OWNER_EMAIL_DOMAINS, DEFAULT_BLOCKED_OWNER_EMAIL_DOMAINS)
}

export function getAllowedOwnerEmailDomains() {
  return parseCsvDomains(process.env.OWNER_ALLOWED_EMAIL_DOMAINS)
}

export function isSignupRole(value: string): value is SignupRole {
  return SIGNUP_ROLES.includes(value as SignupRole)
}

function assertOwnerDomainAllowed(domain: string) {
  if (!domain) {
    throw new InviteFlowError('Company email required for Owner.')
  }

  const blockedDomains = new Set(getBlockedOwnerEmailDomains())
  if (blockedDomains.has(domain)) {
    throw new InviteFlowError('Company email required for Owner.')
  }

  const allowedDomains = getAllowedOwnerEmailDomains()
  if (allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
    throw new InviteFlowError('Owner signup is restricted to approved company domains.', 403)
  }
}

function serializeAccessRequest(request: AccessRequestRecord): SerializedAccessRequest {
  return {
    id: request.id,
    companyId: request.companyId,
    companyName: request.company.name,
    email: request.email,
    name: request.name,
    role: request.role,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    invite: request.invite
      ? {
          id: request.invite.id,
          code: request.invite.code,
          inviteLink: `${(process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/invite/${request.invite.code}`,
          expiresAt: request.invite.expiresAt.toISOString(),
          used: request.invite.used,
          usedAt: request.invite.usedAt?.toISOString() ?? null,
        }
      : null,
  }
}

export async function createOwnerSignup(input: CreateOwnerSignupInput) {
  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  const password = input.password
  const companyName = input.companyName.trim()
  const country = input.country.trim()
  const industry = input.industry.trim()
  const registrationNumber = input.registrationNumber.trim().toUpperCase()
  const companyType = normalizeCompanyType(input.companyType)
  const emailDomain = extractEmailDomain(email)
  const { pricing } = getWorkspacePricing(companyType)
  const requestedPlan = input.billingSelection?.planId ? getWorkspacePlan(companyType, input.billingSelection.planId) : null
  const selectedPlan = requestedPlan ?? getDefaultPlanForWorkspace(companyType)
  const seatCount = isFreePlan(selectedPlan)
    ? selectedPlan.seats ?? clampSeatCount(pricing, input.billingSelection?.seatCount)
    : clampSeatCount(pricing, input.billingSelection?.seatCount)
  const isolationEnabled = selectedPlan.isolationLocked
    ? false
    : input.billingSelection?.isolationEnabled ?? getDefaultIsolation(selectedPlan)
  const billingCycle = input.billingSelection?.billingCycle ?? 'monthly'

  if (!name) {
    throw new InviteFlowError('Full name is required.')
  }

  if (!email || !email.includes('@')) {
    throw new InviteFlowError('Enter a valid email address.')
  }

  if (!companyName) {
    throw new InviteFlowError('Company name is required for Owner signup.')
  }

  if (!country) {
    throw new InviteFlowError('Country is required for company registration.')
  }

  if (!industry) {
    throw new InviteFlowError('Industry is required for company registration.')
  }

  if (registrationNumber.length < 3) {
    throw new InviteFlowError('A valid company registration number is required.')
  }

  if (!isCompanyType(companyType)) {
    throw new InviteFlowError('Choose a valid company type before creating your workspace.')
  }

  assertOwnerDomainAllowed(emailDomain)

  const [existingUser, existingCompanyByDomain, existingCompanyByRegistration] = await Promise.all([
    prisma.user.findUnique({
      where: { email },
      select: { id: true },
    }),
    prisma.company.findUnique({
      where: { emailDomain },
      select: { id: true },
    }),
    prisma.company.findFirst({
      where: { registrationNumber },
      select: { id: true },
    }),
  ])

  if (existingUser) {
    throw new InviteFlowError('Email already exists.', 409)
  }

  if (existingCompanyByDomain) {
    throw new InviteFlowError('This company domain is already linked to TASKIT. Request access instead.', 409)
  }

  if (existingCompanyByRegistration) {
    throw new InviteFlowError('That company registration number is already registered.', 409)
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const { authUserId } = await createSignupAuthUser({
    email,
    password,
    source: 'owner_signup',
    metadata: {
      name,
      signup_role: 'OWNER',
      company_name: companyName,
      company_domain: emailDomain,
      company_country: country,
      company_industry: industry,
      company_registration_number: registrationNumber,
      company_type: companyType,
    },
  })

  try {
    const createdUser = await prisma.$transaction(
      async (tx) => {
        const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

        const user = await tx.user.create({
          data: {
            name,
            email,
            password: passwordHash,
            role: 'OWNER',
            accountStatus: 'ACTIVE',
            authUserId,
          },
          select: {
            id: true,
          },
        })

        const company = await tx.company.create({
          data: {
            name: companyName,
            emailDomain,
            country,
            industry,
            registrationNumber,
            companyType,
            status: 'ACTIVE',
            selfServeSignup: true,
            subscriptionStatus: 'TRIAL',
            trialEndsAt,
            planType: 'FREE_TRIAL',
            planId: selectedPlan.id,
            billingType: pricing.billing,
            seatCount,
            isolationEnabled,
            isolationType: getIsolationType(isolationEnabled),
            billingInterval: billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY',
            metadata: {
              workspaceBilling: {
                billingCycle,
                billingType: pricing.billing,
                isolationEnabled,
                planId: selectedPlan.id,
              },
            },
            ownerId: user.id,
          },
          select: {
            id: true,
          },
        })

        await tx.subscriptionEvent.create({
          data: {
            companyId: company.id,
            event: 'trial_started',
            payload: {
              billingCycle,
              billingType: pricing.billing,
              isolationEnabled,
              planId: selectedPlan.id,
              trialEndsAt: trialEndsAt.toISOString(),
            },
          },
        })

        await tx.user.update({
          where: { id: user.id },
          data: { companyId: company.id },
        })

        await persistSignupLegalConsents(tx, {
          acceptance: input.legalAcceptance,
          companyId: company.id,
          context: input.legalContext,
          userId: user.id,
        })

        try {
          const workspaceProvisioning = await provisionWorkspaceForCompany(tx, {
            companyId: company.id,
            ownerId: user.id,
            companyType,
          })
          logger.info('signup.workspace_provisioned', {
            companyId: company.id,
            companyType,
            homePath: workspaceProvisioning.homePath,
            shell: workspaceProvisioning.shell,
          })
        } catch (error) {
          if (!isMissingDatabaseObjectError(error)) throw error
          logger.warn('signup.workspace_provisioning_skipped_missing_schema', {
            companyId: company.id,
            companyType,
          })
        }

        return {
          userId: user.id,
          companyId: company.id,
        }
      },
      {
        maxWait: SIGNUP_TRANSACTION_MAX_WAIT_MS,
        timeout: SIGNUP_TRANSACTION_TIMEOUT_MS,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    )

    return createdUser
  } catch (error) {
    await rollbackSignupAuthUser(authUserId, 'owner_signup')
    throw error
  }
}

export async function submitDomainAccessRequest(input: SubmitAccessRequestInput) {
  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  const role = input.role.trim().toUpperCase()
  const emailDomain = extractEmailDomain(email)

  if (!name) {
    throw new InviteFlowError('Full name is required.')
  }

  if (!email || !email.includes('@')) {
    throw new InviteFlowError('Enter a valid email address.')
  }

  if (!isInvitableRole(role)) {
    throw new InviteFlowError('Only managers and employees can request access.', 400)
  }

  const company = await prisma.company.findUnique({
    where: {
      emailDomain,
    },
    select: {
      id: true,
      name: true,
    },
  })

  if (!company) {
    throw new InviteFlowError('No company is linked to that email domain. Ask your admin for an invite.', 404)
  }

  const [existingUser, activeInvite, pendingRequest] = await Promise.all([
    prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        companyId: true,
      },
    }),
    prisma.invite.findFirst({
      where: {
        companyId: company.id,
        invitedEmail: email,
        used: false,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
      },
    }),
    prisma.accessRequest.findFirst({
      where: {
        companyId: company.id,
        email,
        status: 'PENDING',
      },
      select: {
        id: true,
      },
    }),
  ])

  if (existingUser) {
    if (existingUser.companyId === company.id) {
      throw new InviteFlowError('That email already belongs to this company.', 409)
    }

    throw new InviteFlowError('That email is already registered in another workspace.', 409)
  }

  if (activeInvite) {
    throw new InviteFlowError('An active invite already exists for this email. Ask your admin to resend it.', 409)
  }

  if (pendingRequest) {
    throw new InviteFlowError('A join request is already pending for this email.', 409)
  }

  const request = await prisma.accessRequest.create({
    data: {
      companyId: company.id,
      email,
      name,
      role,
    },
    include: {
      company: {
        select: {
          name: true,
        },
      },
      invite: {
        select: {
          id: true,
          code: true,
          expiresAt: true,
          used: true,
          usedAt: true,
        },
      },
    },
  })

  return serializeAccessRequest(request)
}

export async function listCompanyAccessRequests(companyId: string) {
  const requests = await prisma.accessRequest.findMany({
    where: {
      companyId,
    },
    include: {
      company: {
        select: {
          name: true,
        },
      },
      invite: {
        select: {
          id: true,
          code: true,
          expiresAt: true,
          used: true,
          usedAt: true,
        },
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 20,
  })

  return requests.map(serializeAccessRequest)
}

export async function reviewCompanyAccessRequest(input: ReviewAccessRequestInput) {
  if (input.reviewerRole === 'EMPLOYEE') {
    throw new InviteFlowError('Only company admins can review access requests.', 403)
  }

  const action = input.action
  if (action !== 'APPROVE' && action !== 'REJECT') {
    throw new InviteFlowError('Invalid review action.', 400)
  }

  const request = await prisma.accessRequest.findFirst({
    where: {
      id: input.requestId,
      companyId: input.companyId,
      status: 'PENDING',
    },
    include: {
      company: {
        select: {
          name: true,
        },
      },
      invite: {
        select: {
          id: true,
          code: true,
          expiresAt: true,
          used: true,
          usedAt: true,
        },
      },
    },
  })

  if (!request) {
    throw new InviteFlowError('Access request not found.', 404)
  }

  if (action === 'REJECT') {
    const rejected = await prisma.accessRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedById: input.reviewerId,
      },
      include: {
        company: {
          select: {
            name: true,
          },
        },
        invite: {
          select: {
            id: true,
            code: true,
            expiresAt: true,
            used: true,
            usedAt: true,
          },
        },
      },
    })

    return {
      request: serializeAccessRequest(rejected),
      invite: null,
    }
  }

  const invite = await createCompanyInvite({
    companyId: input.companyId,
    companyAdminId: input.reviewerId,
    companyAdminRole: input.reviewerRole,
    email: request.email,
    role: request.role,
    ttlHours: input.ttlHours ?? getInviteTtlHours(),
  })

  const approved = await prisma.accessRequest.update({
    where: { id: request.id },
    data: {
      status: 'APPROVED',
      reviewedAt: new Date(),
      reviewedById: input.reviewerId,
      inviteId: invite.id,
    },
    include: {
      company: {
        select: {
          name: true,
        },
      },
      invite: {
        select: {
          id: true,
          code: true,
          expiresAt: true,
          used: true,
          usedAt: true,
        },
      },
    },
  })

  return {
    request: serializeAccessRequest(approved),
    invite,
  }
}
