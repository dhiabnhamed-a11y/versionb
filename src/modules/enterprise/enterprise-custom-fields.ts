export interface CustomFieldDefinition {
  key: string
  label: string
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'SELECT' | 'MULTI_SELECT'
  options?: string[]
  required?: boolean
}

export interface CustomFieldValue {
  key: string
  value: string | number | boolean | string[] | null
}

export function getCustomFields(metadata: Record<string, unknown> | null): CustomFieldValue[] {
  if (!metadata) return []
  const raw = metadata.customFields
  if (!Array.isArray(raw)) return []
  return raw as CustomFieldValue[]
}

export function setCustomFields(
  metadata: Record<string, unknown> | null,
  fields: CustomFieldValue[]
): Record<string, unknown> {
  return {
    ...(metadata || {}),
    customFields: fields,
  }
}

export function validateCustomFields(
  fields: CustomFieldValue[],
  definitions: CustomFieldDefinition[]
): string[] {
  const errors: string[] = []
  const defMap = new Map(definitions.map((d) => [d.key, d]))

  for (const field of fields) {
    const def = defMap.get(field.key)
    if (!def) {
      errors.push(`Unknown custom field: ${field.key}`)
      continue
    }

    if (field.value === null || field.value === undefined || field.value === '') {
      if (def.required) errors.push(`${def.label} is required`)
      continue
    }

    if (def.type === 'SELECT' && def.options && !def.options.includes(String(field.value))) {
      errors.push(`${def.label} must be one of: ${def.options.join(', ')}`)
    }

    if (def.type === 'MULTI_SELECT' && def.options) {
      const vals = Array.isArray(field.value) ? field.value : [String(field.value)]
      for (const v of vals) {
        if (!def.options.includes(v)) {
          errors.push(`${def.label}: invalid option "${v}". Must be one of: ${def.options.join(', ')}`)
        }
      }
    }

    if (def.type === 'NUMBER' && typeof field.value !== 'number') {
      errors.push(`${def.label} must be a number`)
    }

    if (def.type === 'BOOLEAN' && typeof field.value !== 'boolean') {
      errors.push(`${def.label} must be a boolean`)
    }
  }

  for (const def of definitions) {
    if (def.required && !fields.some((f) => f.key === def.key && f.value !== null && f.value !== undefined && f.value !== '')) {
      errors.push(`${def.label} is required`)
    }
  }

  return errors
}
