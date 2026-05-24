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

export function currencyMinorFactor(currency: string) {
  const normalized = normalizeCurrency(currency)
  if (['BHD', 'JOD', 'KWD', 'OMR', 'TND'].includes(normalized)) return new Prisma.Decimal(1000)
  if (['CLP', 'JPY', 'KRW', 'VND'].includes(normalized)) return new Prisma.Decimal(1)
  return new Prisma.Decimal(100)
}

export function decimalToMinorUnits(value: Prisma.Decimal, currency: string, field = 'amount') {
  const scaled = value.mul(currencyMinorFactor(currency))
  if (!scaled.isInteger()) {
    throw badRequest(`${field} has more precision than ${normalizeCurrency(currency)} supports.`)
  }
  return BigInt(scaled.toFixed(0))
}

export function normalizeCurrency(value: unknown) {
  const currency = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return /^[A-Z]{3}$/.test(currency) ? currency : 'USD'
}
