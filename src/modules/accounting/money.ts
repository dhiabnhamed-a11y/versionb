import { Prisma } from '@prisma/client'
import { currencyMinorUnit, normalizeCurrencyCode } from '@/lib/currencies'
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
  return new Prisma.Decimal(10).pow(currencyMinorUnit(currency))
}

export function decimalToMinorUnits(value: Prisma.Decimal, currency: string, field = 'amount') {
  const scaled = value.mul(currencyMinorFactor(currency))
  if (!scaled.isInteger()) {
    throw badRequest(`${field} has more precision than ${normalizeCurrency(currency)} supports.`)
  }
  return BigInt(scaled.toFixed(0))
}

export function normalizeCurrency(value: unknown) {
  return normalizeCurrencyCode(value)
}
