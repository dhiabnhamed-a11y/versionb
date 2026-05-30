import { Prisma } from '@prisma/client'
import { enterpriseRepositoryPrisma } from '@/modules/enterprise/enterprise.repository'
import { logger } from '@/modules/shared/logger'

type DepreciationMethod = 'STRAIGHT_LINE' | 'DECLINING_BALANCE' | 'SUM_OF_YEARS' | 'NONE'

function calculateStraightLine(
  purchaseCost: number,
  salvageValue: number,
  monthsElapsed: number,
  totalMonths: number
): number {
  if (totalMonths <= 0) return purchaseCost
  const annualDepreciation = (purchaseCost - salvageValue) / (totalMonths / 12)
  const accumulated = (annualDepreciation / 12) * monthsElapsed
  return Math.max(salvageValue, purchaseCost - accumulated)
}

function calculateDecliningBalance(
  purchaseCost: number,
  monthsElapsed: number,
  totalMonths: number,
  factor = 2
): number {
  if (totalMonths <= 0) return purchaseCost
  const annualRate = factor / (totalMonths / 12)
  const bookValue = purchaseCost * Math.pow(1 - annualRate, monthsElapsed / 12)
  return Math.max(0, Math.round(bookValue * 100) / 100)
}

function calculateSumOfYears(
  purchaseCost: number,
  salvageValue: number,
  monthsElapsed: number,
  totalMonths: number
): number {
  if (totalMonths <= 0) return purchaseCost
  const yearsTotal = (totalMonths / 12) * ((totalMonths / 12) + 1) / 2
  const yearElapsed = Math.ceil(monthsElapsed / 12)
  let accumulatedDepreciation = 0
  for (let y = 1; y <= yearElapsed && y <= totalMonths / 12; y++) {
    const yearFraction = ((totalMonths / 12) - y + 1) / yearsTotal
    accumulatedDepreciation += (purchaseCost - salvageValue) * yearFraction
  }
  return Math.max(salvageValue, purchaseCost - accumulatedDepreciation)
}

export function calculateDepreciation(input: {
  purchaseCost: number
  salvageValue?: number
  monthsElapsed: number
  totalMonths: number
  method: DepreciationMethod
}): number {
  const salvage = input.salvageValue ?? 0
  switch (input.method) {
    case 'STRAIGHT_LINE':
      return calculateStraightLine(input.purchaseCost, salvage, input.monthsElapsed, input.totalMonths)
    case 'DECLINING_BALANCE':
      return calculateDecliningBalance(input.purchaseCost, input.monthsElapsed, input.totalMonths)
    case 'SUM_OF_YEARS':
      return calculateSumOfYears(input.purchaseCost, salvage, input.monthsElapsed, input.totalMonths)
    case 'NONE':
    default:
      return input.purchaseCost
  }
}

export async function runDepreciationEngine(): Promise<{ processed: number; updated: number; errors: number }> {
  const assets = await enterpriseRepositoryPrisma.enterpriseAsset.findMany({
    where: {
      lifecycleState: { notIn: ['RETIRED', 'DISPOSED'] },
      depreciationMethod: { not: 'NONE' },
      depreciationStartDate: { not: null },
      depreciationMonths: { not: null },
      purchaseCost: { not: null },
      deletedAt: null,
    },
  })

  let updated = 0
  let errors = 0

  for (const asset of assets) {
    try {
      const startDate = asset.depreciationStartDate!
      const elapsedMs = Date.now() - new Date(startDate).getTime()
      const monthsElapsed = Math.max(0, Math.floor(elapsedMs / (30.44 * 24 * 60 * 60 * 1000)))
      const totalMonths = asset.depreciationMonths!

      const bookValue = calculateDepreciation({
        purchaseCost: Number(asset.purchaseCost),
        monthsElapsed,
        totalMonths,
        method: (asset.depreciationMethod || 'STRAIGHT_LINE') as DepreciationMethod,
      })

      await enterpriseRepositoryPrisma.enterpriseAsset.update({
        where: { id: asset.id },
        data: {
          currentBookValue: new Prisma.Decimal(bookValue),
          ...(bookValue <= 0 ? { lifecycleState: 'RETIRED', retiredAt: new Date(), retiredReason: 'Fully depreciated' } : {}),
        },
      })

      updated++
    } catch (err) {
      errors++
      logger.error('enterprise.depreciation_asset_error', err, { assetId: asset.id })
    }
  }

  logger.info('enterprise.depreciation_run', { processed: assets.length, updated, errors })
  return { processed: assets.length, updated, errors }
}
