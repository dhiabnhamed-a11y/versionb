import type { Prisma } from '@prisma/client'

export function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined

  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (typeof item === 'bigint') return item.toString()
      if (item instanceof Date) return item.toISOString()
      if (item && typeof item === 'object' && typeof item.toString === 'function' && item.constructor?.name === 'Decimal') {
        return Number(item.toString())
      }
      return item
    })
  ) as Prisma.InputJsonValue
}
