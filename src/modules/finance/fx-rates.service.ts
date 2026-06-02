/**
 * Live FX Rate Service
 *
 * Primary source: Open Exchange Rates API (requires OXR_APP_ID env var)
 * Fallback:       Frankfurter (ECB data, no key required, ~40 currencies)
 *
 * Rates are stored in ExchangeRate with rateMicros (rate × 1_000_000)
 * for lossless storage.
 */

import { prisma } from '@/lib/db'
import { logger } from '@/modules/shared/logger'

const OXR_BASE_URL = 'https://openexchangerates.org/api'
const FRANKFURTER_BASE_URL = 'https://api.frankfurter.app'
const MICROS = BigInt(1_000_000)

type OxrLatestResponse = {
  base: string
  timestamp: number
  rates: Record<string, number>
  error?: boolean
  description?: string
}

type FrankfurterLatestResponse = {
  base: string
  date: string
  rates: Record<string, number>
}

async function fetchFromOxr(baseCurrency: string, currencies: string[]): Promise<{ rates: Record<string, number>; date: Date; source: string }> {
  const appId = process.env.OXR_APP_ID?.trim()
  if (!appId) throw new Error('OXR_APP_ID not configured')

  const symbols = currencies.join(',')
  const url = `${OXR_BASE_URL}/latest.json?app_id=${appId}&base=${baseCurrency}&symbols=${symbols}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`OXR responded HTTP ${res.status}`)
  const data: OxrLatestResponse = await res.json()
  if (data.error) throw new Error(`OXR error: ${data.description}`)
  const date = data.timestamp ? new Date(data.timestamp * 1000) : new Date()
  return { rates: data.rates, date, source: 'OPEN_EXCHANGE_RATES' }
}

async function fetchFromFrankfurter(baseCurrency: string, currencies: string[]): Promise<{ rates: Record<string, number>; date: Date; source: string }> {
  const to = currencies.join(',')
  const url = `${FRANKFURTER_BASE_URL}/latest?from=${baseCurrency}&to=${to}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Frankfurter responded HTTP ${res.status}`)
  const data: FrankfurterLatestResponse = await res.json()
  const date = data.date ? new Date(`${data.date}T12:00:00.000Z`) : new Date()
  return { rates: data.rates, date, source: 'FRANKFURTER_ECB' }
}

export async function refreshExchangeRates(
  companyId: string,
  baseCurrency: string,
  currencies: string[]
): Promise<{ updated: number; source: string; rateDate: Date }> {
  const targetCurrencies = currencies.filter((c) => c !== baseCurrency)
  if (targetCurrencies.length === 0) return { updated: 0, source: 'none', rateDate: new Date() }

  let result: { rates: Record<string, number>; date: Date; source: string }

  try {
    result = await fetchFromOxr(baseCurrency, targetCurrencies)
    logger.info('fx.rates_fetched', { companyId, source: 'OXR', baseCurrency, count: Object.keys(result.rates).length })
  } catch (oxrErr) {
    logger.warn('fx.oxr_failed_falling_back', { companyId, error: oxrErr instanceof Error ? oxrErr.message : String(oxrErr) })
    try {
      result = await fetchFromFrankfurter(baseCurrency, targetCurrencies)
      logger.info('fx.rates_fetched', { companyId, source: 'Frankfurter', baseCurrency, count: Object.keys(result.rates).length })
    } catch (fallbackErr) {
      logger.error('fx.rates_fetch_failed', undefined, { companyId, baseCurrency, error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr) })
      throw new Error('Could not fetch FX rates from any source. Try again later.')
    }
  }

  const rateDate = new Date(Date.UTC(
    result.date.getUTCFullYear(),
    result.date.getUTCMonth(),
    result.date.getUTCDate()
  ))

  let updated = 0
  for (const [quoteCurrency, rate] of Object.entries(result.rates)) {
    if (!rate || !Number.isFinite(rate) || rate <= 0) continue
    const rateMicros = BigInt(Math.round(rate * Number(MICROS)))
    try {
      await prisma.exchangeRate.upsert({
        where: {
          companyId_provider_baseCurrency_quoteCurrency_rateDate: {
            companyId,
            provider: result.source,
            baseCurrency,
            quoteCurrency,
            rateDate,
          },
        },
        create: {
          companyId,
          provider: result.source,
          baseCurrency,
          quoteCurrency,
          rateDate,
          rateMicros,
          sourcePayload: { rate, fetchedAt: new Date().toISOString() },
        },
        update: {
          rateMicros,
          sourcePayload: { rate, fetchedAt: new Date().toISOString() },
        },
      })
      updated++
    } catch (err) {
      logger.warn('fx.upsert_failed', { companyId, quoteCurrency, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return { updated, source: result.source, rateDate }
}

export async function getLatestRates(
  companyId: string,
  baseCurrency: string
): Promise<Array<{ quoteCurrency: string; rate: number; rateDate: Date; provider: string }>> {
  const rates = await prisma.exchangeRate.findMany({
    where: { companyId, baseCurrency },
    orderBy: { rateDate: 'desc' },
    distinct: ['quoteCurrency'],
  })
  return rates.map((r) => ({
    quoteCurrency: r.quoteCurrency,
    rate: Number(r.rateMicros) / Number(MICROS),
    rateDate: r.rateDate,
    provider: r.provider,
  }))
}

export async function convertAmount(
  companyId: string,
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ converted: number; rate: number; rateDate: Date } | null> {
  if (fromCurrency === toCurrency) return { converted: amount, rate: 1, rateDate: new Date() }

  const rate = await prisma.exchangeRate.findFirst({
    where: { companyId, baseCurrency: fromCurrency, quoteCurrency: toCurrency },
    orderBy: { rateDate: 'desc' },
  })

  if (!rate) return null

  const rateValue = Number(rate.rateMicros) / Number(MICROS)
  return { converted: amount * rateValue, rate: rateValue, rateDate: rate.rateDate }
}
