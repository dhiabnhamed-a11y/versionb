import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Prisma, type Invite } from '@prisma/client'

import { prisma } from '@/lib/db'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const INVITABLE_ROLES = ['MANAGER', 'EMPLOYEE'] as const
export type InvitableRole = (typeof INVITABLE_ROLES)[number]

const DEFAULT_INVITE_TTL_HOURS = 48

type InviteRecord = Invite & {
  company: {
    name: string
  }
}

export type SerializedInvite = {
  id: string
  code: string
  invitedEmail: string
  invitedEmailMasked: string
  role: string
  companyId: string
  companyName: string
  used: boolean
  expiresAt: string
  createdAt: string
  usedAt: string | null
  inviteLink: string
}

export class OnboardingFlowError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'OnboardingFlowError'
    this.status = status
  }
}

export const InviteFlowError = OnboardingFlowError

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function normalizeInviteCode(code: string) {
  return code.trim()
}

export function isInvitableRole(value: string): value is InvitableRole {
  return INVITABLE_ROLES.includes(value as InvitableRole)
}

export function getInviteTtlHours() {
  const parsed = Number(process.env.INVITE_TTL_HOURS ?? DEFAULT_INVITE_TTL_HOURS)
  if (!Number.isFinite(parsed)) return DEFAULT_INVITE_TTL_HOURS
  return Math.min(Math.max(Math.floor(parsed), 1), 168)
}

export function buildInviteCode() {
  return crypto.randomBytes(18).toString('base64url')
}

export function buildInviteExpiry(hours = getInviteTtlHours()) {
  return new Date(Date.now() + hours * 60 * 60 * 1000)
}

export function buildInviteLink(code: string) {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  return `${baseUrl}/invite/${code}`
}

export function maskEmail(email: string) {
  const normalized = normalizeEmail(email)
  const [localPart, domain = ''] = normalized.split('@')

  if (!localPart || !domain) return normalized
  if (localPart.length <= 2) return `${localPart[0] ?? '*'}*@${domain}`

  return `${localPart.slice(0, 2)}${'*'.repeat(Math.min(localPart.length - 2, 6))}@${domain}`
}

function serializeInvite(invite: InviteRecord): SerializedInvite {
  return {
    id: invite.id,
    code: invite.code,
    invitedEmail: invite.invitedEmail,
    invitedEmailMasked: maskEmail(invite.invitedEmail),
    role: invite.role,
    companyId: invite.companyId,
    companyName: invite.company.name,
    used: invite.used,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
    usedAt: invite.usedAt?.toISOString() ?? null,
    inviteLink: buildInviteLink(invite.code),
  }
}

async function getInvitePreviewRecord(code: string) {
  const normalizedCode = normalizeInviteCode(code)
  if (!normalizedCode) return null

  return prisma.invite.findUnique({
    where: { code: normalizedCode },
    include: {
      company: {
        select: {
          name: true,
        },
      },
    },
  })
}

async function getActiveInviteForCode(code: string) {
  const invite = await getInvitePreviewRecord(code)
  if (!invite) return null

  // Invite reuse is blocked by both the explicit `used` flag and the audit timestamp.
  const isExpired = invite.expiresAt <= new Date()
  if (invite.used || invite.usedAt || isExpired) {
    return null
  }

  return invite
}

export async function getInvitePreview(code: string) {
  const invite = await getActiveInviteForCode(code)
  if (!invite) return null

  return serializeInvite(invite)
}

type CreateInviteInput = {
  companyId: string
  companyAdminId: string
  companyAdminRole: string
  email: string
  role: string
  ttlHours?: number
}

export async function createCompanyInvite(input: CreateInviteInput) {
  const email = normalizeEmail(input.email)
  const role = input.role.trim().toUpperCase()

  if (!email || !email.includes('@')) {
    throw new OnboardingFlowError('Enter a valid email address.')
  }

  if (!isInvitableRole(role)) {
    throw new OnboardingFlowError('Invalid invite role.')
  }

  if (input.companyAdminRole === 'EMPLOYEE') {
    throw new OnboardingFlowError('Only company admins can create invites.', 403)
  }

  if (input.companyAdminRole !== 'OWNER' && role === 'MANAGER') {
    throw new OnboardingFlowError('Only the company owner can invite another admin.', 403)
  }

  const now = new Date()
  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      companyId: true,
    },
  })

  if (existingUser) {
    if (existingUser.companyId === input.companyId) {
      throw new OnboardingFlowError('That user already belongs to your company.', 409)
    }

    throw new OnboardingFlowError('That email is already registered in another workspace.', 409)
  }

  const ttlHours = input.ttlHours ?? getInviteTtlHours()

  const invite = await prisma.$transaction(async (tx) => {
    // Keep one active invite per email/company so the latest link is the only valid one.
    await tx.invite.updateMany({
      where: {
        companyId: input.companyId,
        invitedEmail: email,
        used: false,
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        expiresAt: now,
      },
    })

    return tx.invite.create({
      data: {
        companyId: input.companyId,
        createdById: input.companyAdminId,
        invitedEmail: email,
        role,
        code: buildInviteCode(),
        expiresAt: buildInviteExpiry(ttlHours),
      },
      include: {
        company: {
          select: {
            name: true,
          },
        },
      },
    })
  })

  return serializeInvite(invite)
}

export async function listCompanyInvites(companyId: string) {
  const invites = await prisma.invite.findMany({
    where: {
      companyId,
    },
    include: {
      company: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ usedAt: 'asc' }, { createdAt: 'desc' }],
    take: 20,
  })

  return invites.map(serializeInvite)
}

type RedeemInviteInput = {
  name: string
  email: string
  password: string
  inviteCode: string
  requestedRole: string
}

export async function redeemInviteSignup(input: RedeemInviteInput) {
  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  const password = input.password
  const inviteCode = normalizeInviteCode(input.inviteCode)
  const requestedRole = input.requestedRole.trim().toUpperCase()

  if (!name) {
    throw new OnboardingFlowError('Full name is required.')
  }

  if (!email || !email.includes('@')) {
    throw new OnboardingFlowError('Enter a valid email address.')
  }

  if (!inviteCode) {
    throw new OnboardingFlowError('Invite code is required.')
  }

  if (!isInvitableRole(requestedRole)) {
    throw new OnboardingFlowError('Invalid signup role.', 400)
  }

  if (password.length < 8) {
    throw new OnboardingFlowError('Password must be at least 8 characters long.')
  }

  const invite = await getActiveInviteForCode(inviteCode)

  if (!invite) {
    throw new OnboardingFlowError('Invalid invite code.', 404)
  }

  // Bind the invite to both the expected email and the expected role to prevent role escalation.
  if (invite.invitedEmail !== email) {
    throw new OnboardingFlowError('Invalid invite code for this email.', 403)
  }

  if (invite.role !== requestedRole) {
    throw new OnboardingFlowError('Invite role does not match the selected role.', 403)
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  })

  if (existingUser) {
    throw new OnboardingFlowError('Email already exists.', 409)
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      invite_code: inviteCode,
      signup_role: requestedRole,
      taskit_onboarding: true,
    },
  })

  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes('already')) {
      throw new OnboardingFlowError('That email is already registered in Supabase Auth.', 409)
    }

    throw new OnboardingFlowError(error?.message ?? 'Supabase Auth user creation failed.', 500)
  }

  const authUserId = data.user.id

  try {
    // Supabase Auth and Prisma are separate systems, so we create the auth user first
    // and delete it again if the local membership transaction fails.
    const createdUser = await prisma.$transaction(
      async (tx) => createInvitedUser(tx, { authUserId, invite, name, email, password }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    )

    return createdUser
  } catch (error) {
    await rollbackSupabaseUser(authUserId)
    throw error
  }
}

async function createInvitedUser(
  tx: Prisma.TransactionClient,
  input: {
    authUserId: string
    invite: {
      id: string
      companyId: string
      role: string
    }
    name: string
    email: string
    password: string
  }
) {
  const freshInvite = await tx.invite.findFirst({
    where: {
      id: input.invite.id,
      invitedEmail: input.email,
      used: false,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      companyId: true,
      role: true,
    },
  })

  if (!freshInvite) {
    throw new OnboardingFlowError('This invite is no longer available.', 409)
  }

  const passwordHash = await bcrypt.hash(input.password, 12)

  const user = await tx.user.create({
    data: {
      name: input.name,
      email: input.email,
      password: passwordHash,
      role: freshInvite.role,
      companyId: freshInvite.companyId,
      authUserId: input.authUserId,
    },
    select: {
      id: true,
      email: true,
      companyId: true,
      role: true,
    },
  })

  const claimResult = await tx.invite.updateMany({
    where: {
      id: freshInvite.id,
      used: false,
      usedAt: null,
    },
    data: {
      used: true,
      usedAt: new Date(),
      usedById: user.id,
    },
  })

  // updateMany lets us atomically fail if another request consumed the invite first.
  if (claimResult.count !== 1) {
    throw new OnboardingFlowError('This invite has already been used.', 409)
  }

  return user
}

async function rollbackSupabaseUser(authUserId: string) {
  try {
    const { error } = await getSupabaseAdmin().auth.admin.deleteUser(authUserId)
    if (error) {
      console.error('[invites] failed to rollback Supabase Auth user', error)
    }
  } catch (error) {
    console.error('[invites] unexpected Supabase Auth rollback failure', error)
  }
}
