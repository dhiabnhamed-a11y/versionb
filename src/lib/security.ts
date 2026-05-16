type EmailIdentity = {
  email?: string | null
}

type RoleIdentity = EmailIdentity & {
  role?: string | null
}

type AuthState = RoleIdentity & {
  accountStatus?: string | null
  companyStatus?: string | null
}

export const USER_ROLE_VALUES = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'EMPLOYEE'] as const
export type UserRole = (typeof USER_ROLE_VALUES)[number]

export const ACCOUNT_STATUS_VALUES = ['PENDING', 'ACTIVE', 'REJECTED', 'DISABLED'] as const
export type AccountStatus = (typeof ACCOUNT_STATUS_VALUES)[number]

export const COMPANY_STATUS_VALUES = ['PENDING', 'ACTIVE', 'REJECTED', 'DISABLED'] as const
export type CompanyStatus = (typeof COMPANY_STATUS_VALUES)[number]

function normalizeUpper(value?: string | null) {
  return value?.trim().toUpperCase() ?? ''
}

function normalizeEmailValue(value?: string | null) {
  return value?.trim().toLowerCase() ?? ''
}

function parseCsv(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => normalizeEmailValue(item))
    .filter(Boolean)
}

export function normalizeUserRole(value?: string | null): UserRole {
  const normalized = normalizeUpper(value)
  if (USER_ROLE_VALUES.includes(normalized as UserRole)) {
    return normalized as UserRole
  }

  return 'EMPLOYEE'
}

export function normalizeAccountStatus(value?: string | null): AccountStatus {
  const normalized = normalizeUpper(value)
  if (ACCOUNT_STATUS_VALUES.includes(normalized as AccountStatus)) {
    return normalized as AccountStatus
  }

  return 'PENDING'
}

export function normalizeCompanyStatus(value?: string | null): CompanyStatus {
  const normalized = normalizeUpper(value)
  if (COMPANY_STATUS_VALUES.includes(normalized as CompanyStatus)) {
    return normalized as CompanyStatus
  }

  return 'PENDING'
}

export function getConfiguredSuperAdminEmails() {
  return parseCsv(process.env.SUPER_ADMIN_EMAILS ?? process.env.SUPER_ADMIN_EMAIL)
}

export function isAuthorizedSuperAdminIdentity(user: RoleIdentity) {
  if (normalizeUserRole(user.role) !== 'SUPER_ADMIN') {
    return false
  }

  const allowedEmails = getConfiguredSuperAdminEmails()
  if (allowedEmails.length === 0) {
    return true
  }

  return allowedEmails.includes(normalizeEmailValue(user.email))
}

export function isCompanyOperational(status?: string | null) {
  return normalizeCompanyStatus(status) === 'ACTIVE'
}

export function isUserOperational(status?: string | null) {
  return normalizeAccountStatus(status) === 'ACTIVE'
}

export function canAuthenticateAuthState(state: AuthState) {
  if (isAuthorizedSuperAdminIdentity(state)) {
    return isUserOperational(state.accountStatus)
  }

  return isUserOperational(state.accountStatus) && isCompanyOperational(state.companyStatus)
}

export function getAuthBlockReason(state: AuthState) {
  if (isAuthorizedSuperAdminIdentity(state) && !isUserOperational(state.accountStatus)) {
    return 'Your Super Admin account is currently disabled.'
  }

  const accountStatus = normalizeAccountStatus(state.accountStatus)
  if (accountStatus === 'PENDING') {
    return 'Your account is pending approval by the Super Admin.'
  }

  if (accountStatus === 'REJECTED') {
    return 'Your account request was rejected. Contact support for assistance.'
  }

  if (accountStatus === 'DISABLED') {
    return 'Your account has been disabled.'
  }

  const companyStatus = normalizeCompanyStatus(state.companyStatus)
  if (companyStatus === 'PENDING') {
    return 'Your company registration is pending Super Admin approval.'
  }

  if (companyStatus === 'REJECTED') {
    return 'Your company registration was rejected by the Super Admin.'
  }

  if (companyStatus === 'DISABLED') {
    return 'Your company account has been disabled by the Super Admin.'
  }

  return 'Your account is not allowed to access the platform.'
}

export function getRoleHomePath(role?: string | null) {
  const normalizedRole = normalizeUserRole(role)
  if (normalizedRole === 'SUPER_ADMIN') {
    return '/dashboard/super-admin'
  }

  if (normalizedRole === 'EMPLOYEE') {
    return '/dashboard/employee'
  }

  return '/dashboard/admin'
}

export function hasWorkspaceManagerRole(role?: string | null) {
  const normalizedRole = normalizeUserRole(role)
  return normalizedRole === 'OWNER' || normalizedRole === 'MANAGER' || normalizedRole === 'SUPER_ADMIN'
}

export function hasTenantAccess(user: { companyId?: string | null }, resource: { companyId?: string | null }) {
  return Boolean(user.companyId && resource.companyId && user.companyId === resource.companyId)
}

export function requireWebhookSignatureHeader(headers: Pick<Headers, 'get'>, headerName: string) {
  const signature = headers.get(headerName)?.trim()
  return signature && signature.length <= 512 ? signature : null
}
