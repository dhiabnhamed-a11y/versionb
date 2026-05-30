const SENSITIVE_FIELDS = new Set([
  'ssn', 'socialSecurity', 'taxId', 'ein',
  'password', 'passwordHash', 'secret',
  'apiKey', 'apiSecret', 'accessToken', 'refreshToken',
  'creditCard', 'cvv', 'cardNumber',
  'bankAccount', 'routingNumber',
  'driverLicense', 'passportNumber',
  'phi', 'medicalRecord',
])

const MASKED_PATTERNS = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '***-**-****' },
  { pattern: /\b\d{16}\b/g, replacement: '****-****-****-****' },
  { pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g, replacement: '****-****-****-****' },
]

export type MaskingLevel = 'NONE' | 'PARTIAL' | 'FULL'

export function isSensitiveField(fieldName: string): boolean {
  const lower = fieldName.toLowerCase()
  return SENSITIVE_FIELDS.has(lower) || Array.from(SENSITIVE_FIELDS).some((f) => lower.includes(f))
}

export function maskValue(value: string, level: MaskingLevel): string {
  if (level === 'NONE') return value
  if (level === 'FULL') return '***'

  let result = value
  for (const { pattern, replacement } of MASKED_PATTERNS) {
    result = result.replace(pattern, replacement)
  }

  if (result.length > 4) {
    result = result.slice(0, 2) + '*'.repeat(result.length - 4) + result.slice(-2)
  }

  return result
}

export function maskObject<T extends Record<string, unknown>>(
  obj: T,
  level: MaskingLevel = 'PARTIAL',
  sensitiveKeys?: string[]
): T {
  if (level === 'NONE') return obj

  const masked = { ...obj }
  const keys = sensitiveKeys || Object.keys(masked)

  for (const key of keys) {
    const value = masked[key]
    if (isSensitiveField(key) && value !== undefined && value !== null) {
      if (typeof value === 'string') {
        masked[key] = maskValue(value, level) as any
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        masked[key] = maskObject(value as Record<string, unknown>, level) as any
      }
    }
  }

  return masked
}

const SENSITIVE_ENTITY_FIELDS: Record<string, string[]> = {
  enterprise_incident: ['resolution', 'rootCause', 'description'],
  enterprise_asset: ['serialNumber', 'location'],
  enterprise_change: ['description', 'justification'],
  enterprise_problem: ['description', 'rootCause', 'workaround', 'permanentFix'],
  enterprise_vendor: ['contactName', 'contactEmail', 'contactPhone', 'notes'],
  enterprise_contract: ['terms'],
}

export function getSensitiveFieldsForEntity(entityType: string): string[] {
  return SENSITIVE_ENTITY_FIELDS[entityType] || []
}

export function maskEntityResponse<T extends Record<string, unknown>>(
  entity: T,
  entityType: string,
  userRole: string,
  companyId: string
): T {
  const managersOnly = ['it_manager', 'admin', 'super_admin', 'enterprise_admin']
  const shouldMask = !managersOnly.includes(userRole)

  if (!shouldMask) return entity

  const sensitiveKeys = getSensitiveFieldsForEntity(entityType)
  if (sensitiveKeys.length === 0) return entity

  return maskObject(entity, 'FULL', sensitiveKeys)
}
