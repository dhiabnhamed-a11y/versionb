import { Prisma } from '@prisma/client'
import { badRequest } from '@/modules/shared/errors'
import { currencyMinorFactor, decimalToMinorUnits, normalizeCurrency, toDecimal } from '@/modules/accounting/money'

export function normalizeErpCurrency(value: unknown) {
  return normalizeCurrency(value)
}

export function toMinorUnits(value: unknown, currency: string, field = 'amount') {
  return decimalToMinorUnits(toDecimal(value as Prisma.Decimal | string | number | null | undefined, field), currency, field)
}

export function minorUnitsToDecimal(minor: bigint | number | string, currency: string) {
  try {
    return new Prisma.Decimal(minor.toString()).div(currencyMinorFactor(currency))
  } catch {
    throw badRequest('Invalid minor-unit amount.')
  }
}

export function assertBalancedMinorLines(lines: Array<{ debitMinor?: bigint | number | string | null; creditMinor?: bigint | number | string | null }>) {
  const totals = lines.reduce<{ debitMinor: bigint; creditMinor: bigint }>(
    (acc, line) => {
      acc.debitMinor += BigInt(line.debitMinor ?? 0)
      acc.creditMinor += BigInt(line.creditMinor ?? 0)
      return acc
    },
    { debitMinor: BigInt(0), creditMinor: BigInt(0) }
  )

  if (totals.debitMinor !== totals.creditMinor) {
    throw badRequest('Journal entry is out of balance.', {
      totalDebitMinor: totals.debitMinor.toString(),
      totalCreditMinor: totals.creditMinor.toString(),
    })
  }
  if (totals.debitMinor <= BigInt(0)) throw badRequest('Journal entry total must be greater than zero.')
  return totals
}
