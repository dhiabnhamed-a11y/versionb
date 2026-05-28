import { prisma } from '@/lib/db'
import type { FieldMappingRule, EnumMapping } from './types'

export class FieldMappingService {
  private companyId: string
  private integrationId: string
  private cache: Map<string, { mappings: FieldMappingRule[]; enums: EnumMapping }> = new Map()

  constructor(companyId: string, integrationId: string) {
    this.companyId = companyId
    this.integrationId = integrationId
  }

  async loadMappings(entityType: string): Promise<{ mappings: FieldMappingRule[]; enums: EnumMapping }> {
    const cacheKey = `${this.integrationId}:${entityType}`
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!

    const mapping = await prisma.emsFieldMapping.findFirst({
      where: {
        companyId: this.companyId,
        integrationId: this.integrationId,
        entityType,
        isActive: true,
      },
      orderBy: { version: 'desc' },
    })

    const result = {
      mappings: (mapping?.mappings as unknown as FieldMappingRule[]) || [],
      enums: (mapping?.enumMappings as EnumMapping) || {},
    }
    this.cache.set(cacheKey, result)
    return result
  }

  invalidateCache(entityType?: string): void {
    if (entityType) {
      this.cache.delete(`${this.integrationId}:${entityType}`)
    } else {
      this.cache.clear()
    }
  }

  async applyMappings(entityType: string, sourceData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { mappings, enums } = await this.loadMappings(entityType)
    if (mappings.length === 0) return { ...sourceData }

    const result: Record<string, unknown> = {}

    // Copy unmapped fields
    const mappedSourceFields = new Set(mappings.map(m => m.sourceField))
    for (const [key, value] of Object.entries(sourceData)) {
      if (!mappedSourceFields.has(key)) {
        result[key] = value
      }
    }

    // Apply mappings
    for (const rule of mappings) {
      const rawValue = sourceData[rule.sourceField]
      const value = rawValue !== undefined ? rawValue : rule.defaultValue
      if (value === undefined && rule.required) continue

      result[rule.targetField] = this.transformValue(value, rule, enums)
    }

    return result
  }

  private transformValue(value: unknown, rule: FieldMappingRule, enums: EnumMapping): unknown {
    if (value === null || value === undefined) return rule.defaultValue || null

    switch (rule.transform) {
      case 'uppercase':
        return String(value).toUpperCase()
      case 'lowercase':
        return String(value).toLowerCase()
      case 'enum_map': {
        const fieldMap = enums[rule.sourceField] || enums[rule.targetField] || {}
        const strVal = String(value)
        return fieldMap[strVal] || rule.defaultValue || value
      }
      case 'date_format': {
        const date = new Date(String(value))
        if (isNaN(date.getTime())) return value
        const format = (rule.transformConfig?.format as string) || 'iso'
        if (format === 'timestamp') return date.getTime()
        return date.toISOString()
      }
      case 'concat': {
        const parts = [String(value)]
        const suffix = rule.transformConfig?.suffix as string
        const prefix = rule.transformConfig?.prefix as string
        if (prefix) parts.unshift(prefix)
        if (suffix) parts.push(suffix)
        return parts.join('')
      }
      case 'split': {
        const separator = (rule.transformConfig?.separator as string) || ','
        const index = (rule.transformConfig?.index as number) || 0
        return String(value).split(separator)[index] || value
      }
      default:
        return value
    }
  }

  async createMapping(data: {
    name: string
    entityType: string
    mappings: FieldMappingRule[]
    enumMappings?: EnumMapping
    validationRules?: Record<string, unknown>
  }): Promise<unknown> {
    this.invalidateCache(data.entityType)
    return prisma.emsFieldMapping.create({
      data: {
        companyId: this.companyId,
        integrationId: this.integrationId,
        name: data.name,
        entityType: data.entityType,
        mappings: data.mappings as any,
        enumMappings: (data.enumMappings || {}) as any,
        validationRules: (data.validationRules || {}) as any,
      },
    })
  }

  async updateMapping(id: string, data: Partial<{
    name: string
    mappings: FieldMappingRule[]
    enumMappings: EnumMapping
    validationRules: Record<string, unknown>
    isActive: boolean
  }>): Promise<unknown> {
    const existing = await prisma.emsFieldMapping.findUnique({ where: { id } })
    if (existing) this.invalidateCache(existing.entityType)
    return prisma.emsFieldMapping.update({
      where: { id },
      data: { ...data, version: { increment: 1 } } as any,
    })
  }

  async listMappings(): Promise<unknown[]> {
    return prisma.emsFieldMapping.findMany({
      where: { companyId: this.companyId, integrationId: this.integrationId },
      orderBy: { createdAt: 'desc' },
    })
  }
}
