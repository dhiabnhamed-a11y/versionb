import { Prisma } from '@prisma/client'
import { badRequest } from '@/modules/shared/errors'
import { toDecimal } from '@/modules/accounting/money'

export function calculateTaxAmount(input: { taxableAmount: string | number | Prisma.Decimal; ratePercent: string | number | Prisma.Decimal }) {
  const taxableAmount = toDecimal(input.taxableAmount, 'taxableAmount')
  const ratePercent = toDecimal(input.ratePercent, 'ratePercent')
  if (taxableAmount.isNegative()) throw badRequest('Taxable amount cannot be negative.')
  if (ratePercent.isNegative() || ratePercent.gt(100)) throw badRequest('Tax rate must be between 0 and 100.')
  return taxableAmount.mul(ratePercent).div(100)
}

export function buildTaxJurisdictionKey(country?: string | null, region?: string | null) {
  return [country?.trim().toUpperCase(), region?.trim().toUpperCase()].filter(Boolean).join(':') || 'GLOBAL'
}
