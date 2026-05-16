import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertSignupLegalAcceptance,
  buildConsentHash,
  getDefaultLegalVersions,
  getMissingRequiredConsentTypes,
  parseSignupLegalAcceptance,
} from '@/lib/legal'
import { AppError } from '@/modules/shared/errors'

test('signup legal validation rejects missing required acceptance', () => {
  assert.throws(
    () => assertSignupLegalAcceptance({ legalConsent: { termsAccepted: true, privacyAccepted: false } }),
    (error) => error instanceof AppError && error.status === 400
  )
})

test('signup legal validation accepts terms and privacy from the legal payload', () => {
  const acceptance = assertSignupLegalAcceptance({
    legalConsent: {
      termsAccepted: true,
      privacyAccepted: true,
      marketingEmailsAccepted: false,
      aiUsageDisclosureAcknowledged: true,
    },
  })

  assert.equal(acceptance.termsAccepted, true)
  assert.equal(acceptance.privacyAccepted, true)
  assert.equal(acceptance.aiUsageDisclosureAcknowledged, true)
})

test('parseSignupLegalAcceptance normalizes browser checkbox values', () => {
  const acceptance = parseSignupLegalAcceptance({
    legalConsent: {
      termsAccepted: 'on',
      privacyAccepted: 'true',
    },
  })

  assert.equal(acceptance.termsAccepted, true)
  assert.equal(acceptance.privacyAccepted, true)
})

test('consent hash binds version and request evidence', () => {
  const acceptedAt = new Date('2026-05-16T12:00:00.000Z')
  const base = {
    acceptedAt,
    companyId: 'company_1',
    consentType: 'TERMS_OF_SERVICE' as const,
    documentVersion: '2026.05',
    ipAddress: '203.0.113.10',
    locale: 'en-US',
    requestId: 'req_123',
    userAgent: 'Node Test',
    userId: 'user_1',
  }

  assert.equal(buildConsentHash(base), buildConsentHash(base))
  assert.notEqual(buildConsentHash(base), buildConsentHash({ ...base, documentVersion: '2026.06' }))
  assert.notEqual(buildConsentHash(base), buildConsentHash({ ...base, ipAddress: '203.0.113.11' }))
})

test('version re-acceptance detection preserves history and finds missing active versions', () => {
  const versions = getDefaultLegalVersions()
  versions.TERMS_OF_SERVICE.version = '2026.06'
  versions.PRIVACY_POLICY.version = '2026.05'

  const missing = getMissingRequiredConsentTypes(
    [
      { consentType: 'TERMS_OF_SERVICE', documentVersion: '2026.05' },
      { consentType: 'PRIVACY_POLICY', documentVersion: '2026.05' },
    ],
    versions
  )

  assert.deepEqual(missing, ['TERMS_OF_SERVICE'])
})

