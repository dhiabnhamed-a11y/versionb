import { Prisma } from '@prisma/client'
import { badRequest } from '@/modules/shared/errors'

export type DecimalInput = Prisma.Decimal | string | number | null | undefined

export function toDecimal(value: DecimalInput, field = 'amount') {
  try {
    return new Prisma.Decimal(value ?? 0)
  } catch {
    throw badRequest(`Invalid ${field}.`)
  }
}

export function zeroDecimal() {
  return new Prisma.Decimal(0)
}

export function sumDecimals(values: Prisma.Decimal[]) {
  return values.reduce((total, value) => total.plus(value), zeroDecimal())
}

export function normalizeCurrency(value: unknown) {
  const currency = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return /^[A-Z]{3}$/.test(currency) ? currency : 'USD'
}
