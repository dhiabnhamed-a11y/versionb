import assert from 'node:assert/strict'
import test from 'node:test'
import { AppError } from '@/modules/shared/errors'
import { requirePermission, requireResourceOwnership, requireRole, requireTenantAccess } from '@/modules/security/access-control'
import { evaluatePasswordPolicy } from '@/modules/security/password-policy'
import { assertTimestampTolerance, buildSignedRequestPayload, signRequestPayload } from '@/modules/security/request-signature'
import { buildTotpUri, generateRecoveryCodes, generateTotpSecret, getTotpCode, verifyTotpCode } from '@/modules/security/mfa'
import type { SessionUser } from '@/modules/shared/session'

const owner: SessionUser = {
  id: 'user_owner',
  email: 'owner@example.com',
  role: 'OWNER',
  companyId: 'company_a',
}

const employee: SessionUser = {
  id: 'user_employee',
  email: 'employee@example.com',
  role: 'EMPLOYEE',
  companyId: 'company_a',
}

test('requireTenantAccess hides cross-tenant resources as not found', () => {
  assert.equal(requireTenantAccess(owner, { id: 'project_1', companyId: 'company_a' }).companyId, 'company_a')

  assert.throws(
    () => requireTenantAccess(owner, { id: 'project_2', companyId: 'company_b' }),
    (error) => error instanceof AppError && error.status === 404
  )
})

test('requireRole blocks privilege escalation', () => {
  assert.equal(requireRole(owner, 'OWNER'), owner)
  assert.throws(
    () => requireRole(employee, ['OWNER', 'SUPER_ADMIN']),
    (error) => error instanceof AppError && error.status === 403
  )
})

test('requirePermission enforces RBAC and tenant scope', () => {
  assert.equal(requirePermission(employee, 'read', 'task', { companyId: 'company_a', assigneeId: 'user_employee' }), employee)
  assert.throws(
    () => requirePermission(employee, 'delete', 'task', { companyId: 'company_a', assigneeId: 'user_employee' }),
    (error) => error instanceof AppError && error.status === 403
  )
  assert.throws(
    () => requirePermission(employee, 'read', 'task', { companyId: 'company_b', assigneeId: 'user_employee' }),
    (error) => error instanceof AppError && error.status === 403
  )
})

test('requireResourceOwnership blocks resource guessing', () => {
  assert.equal(
    requireResourceOwnership(employee, { id: 'task_1', companyId: 'company_a', assigneeId: 'user_employee' }).id,
    'task_1'
  )
  assert.throws(
    () => requireResourceOwnership(employee, { id: 'task_2', companyId: 'company_a', assigneeId: 'someone_else' }),
    (error) => error instanceof AppError && error.status === 404
  )
})

test('password policy rejects weak and identity-derived passwords', () => {
  const weak = evaluatePasswordPolicy('password', { email: 'owner@example.com', name: 'Owner User' })
  assert.equal(weak.ok, false)
  assert.ok(weak.errors.length >= 3)

  const strong = evaluatePasswordPolicy('Correct-Horse-71-Task', { email: 'owner@example.com', name: 'Owner User' })
  assert.equal(strong.ok, true)
})

test('signed request canonical payloads are stable and timestamps expire', () => {
  const payload = buildSignedRequestPayload({
    body: '{"ok":true}',
    method: 'post',
    nonce: 'nonce_123',
    pathname: '/api/v1/example',
    timestamp: '2026-05-16T12:00:00.000Z',
  })
  assert.equal(
    signRequestPayload('secret', payload),
    signRequestPayload('secret', payload)
  )

  assert.throws(
    () => assertTimestampTolerance('2020-01-01T00:00:00.000Z', 1_000),
    (error) => error instanceof AppError && error.status === 401
  )
})

test('TOTP and recovery-code utilities support MFA enrollment', () => {
  const secret = generateTotpSecret()
  const now = Date.UTC(2026, 4, 16, 12, 0, 0)
  const code = getTotpCode(secret, now)

  assert.equal(verifyTotpCode({ code, secret, now, window: 0 }), true)
  assert.equal(buildTotpUri({ accountName: 'owner@example.com', secret }).startsWith('otpauth://totp/'), true)
  assert.equal(generateRecoveryCodes(3).length, 3)
})
