import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { refreshExchangeRates, getLatestRates } from '@/modules/finance/fx-rates.service'
import { badRequest } from '@/modules/shared/errors'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPPORTED_BASE_CURRENCIES = ['USD', 'EUR', 'GBP', 'TND', 'AED', 'SAR', 'MAD', 'DZD', 'EGP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL', 'MXN', 'ZAR', 'KWD', 'QAR', 'OMR', 'BHD', 'JOD', 'SGD', 'HKD', 'NOK', 'SEK', 'DKK', 'PLN', 'CZK', 'HUF', 'RUB', 'TRY', 'NGN', 'KES', 'GHS']

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }) => {
const { searchParams } = new URL(req.url)
const baseCurrency = (searchParams.get('base') || 'USD').toUpperCase()
const rates = await getLatestRates(user.companyId!, baseCurrency)
return apiData({ baseCurrency, rates, count: rates.length })
}, { auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/finance/exchange-rates' })
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }) => {
const body = await parseJsonObject(req)
const baseCurrency = (body.baseCurrency || 'USD').toString().toUpperCase()
const currencies: string[] = Array.isArray(body.currencies)
  ? body.currencies.map((c: string) => c.toString().toUpperCase())
  : SUPPORTED_BASE_CURRENCIES.filter((c) => c !== baseCurrency)

if (!SUPPORTED_BASE_CURRENCIES.includes(baseCurrency)) {
  throw badRequest(`Unsupported base currency: ${baseCurrency}`)
}
if (currencies.length > 60) throw badRequest('Maximum 60 currencies per refresh')

const result = await refreshExchangeRates(user.companyId!, baseCurrency, currencies)
return apiData({
  message: `Updated ${result.updated} exchange rates from ${result.source}`,
  updated: result.updated,
  source: result.source,
  rateDate: result.rateDate,
  baseCurrency,
})
}, { auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/finance/exchange-rates' })
}, { auth: 'required' });
