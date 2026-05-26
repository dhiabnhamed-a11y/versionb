export type CurrencyOption = {
  value: string
  label: string
  meta?: string
}

export type CountryCurrencyOption = CurrencyOption & {
  currency: string
}

const FALLBACK_CURRENCY_CODES = [
  'AED',
  'AFN',
  'ALL',
  'AMD',
  'ANG',
  'AOA',
  'ARS',
  'AUD',
  'AWG',
  'AZN',
  'BAM',
  'BBD',
  'BDT',
  'BGN',
  'BHD',
  'BIF',
  'BMD',
  'BND',
  'BOB',
  'BRL',
  'BSD',
  'BTN',
  'BWP',
  'BYN',
  'BZD',
  'CAD',
  'CDF',
  'CHF',
  'CLP',
  'CNY',
  'COP',
  'CRC',
  'CUP',
  'CVE',
  'CZK',
  'DJF',
  'DKK',
  'DOP',
  'DZD',
  'EGP',
  'ERN',
  'ETB',
  'EUR',
  'FJD',
  'FKP',
  'GBP',
  'GEL',
  'GHS',
  'GIP',
  'GMD',
  'GNF',
  'GTQ',
  'GYD',
  'HKD',
  'HNL',
  'HTG',
  'HUF',
  'IDR',
  'ILS',
  'INR',
  'IQD',
  'IRR',
  'ISK',
  'JMD',
  'JOD',
  'JPY',
  'KES',
  'KGS',
  'KHR',
  'KMF',
  'KRW',
  'KWD',
  'KYD',
  'KZT',
  'LAK',
  'LBP',
  'LKR',
  'LRD',
  'LSL',
  'LYD',
  'MAD',
  'MDL',
  'MGA',
  'MKD',
  'MMK',
  'MNT',
  'MOP',
  'MRU',
  'MUR',
  'MVR',
  'MWK',
  'MXN',
  'MYR',
  'MZN',
  'NAD',
  'NGN',
  'NIO',
  'NOK',
  'NPR',
  'NZD',
  'OMR',
  'PAB',
  'PEN',
  'PGK',
  'PHP',
  'PKR',
  'PLN',
  'PYG',
  'QAR',
  'RON',
  'RSD',
  'RUB',
  'RWF',
  'SAR',
  'SBD',
  'SCR',
  'SDG',
  'SEK',
  'SGD',
  'SHP',
  'SLE',
  'SOS',
  'SRD',
  'SSP',
  'STN',
  'SYP',
  'SZL',
  'THB',
  'TJS',
  'TMT',
  'TND',
  'TOP',
  'TRY',
  'TTD',
  'TWD',
  'TZS',
  'UAH',
  'UGX',
  'USD',
  'UYU',
  'UZS',
  'VES',
  'VND',
  'VUV',
  'WST',
  'XAF',
  'XCD',
  'XOF',
  'XPF',
  'YER',
  'ZAR',
  'ZMW',
]

const COUNTRY_CURRENCIES: Array<{ country: string; currency: string }> = [
  { country: 'Algeria', currency: 'DZD' },
  { country: 'Argentina', currency: 'ARS' },
  { country: 'Australia', currency: 'AUD' },
  { country: 'Bahrain', currency: 'BHD' },
  { country: 'Bangladesh', currency: 'BDT' },
  { country: 'Belgium', currency: 'EUR' },
  { country: 'Brazil', currency: 'BRL' },
  { country: 'Canada', currency: 'CAD' },
  { country: 'China', currency: 'CNY' },
  { country: 'Denmark', currency: 'DKK' },
  { country: 'Egypt', currency: 'EGP' },
  { country: 'France', currency: 'EUR' },
  { country: 'Germany', currency: 'EUR' },
  { country: 'Ghana', currency: 'GHS' },
  { country: 'Hong Kong', currency: 'HKD' },
  { country: 'India', currency: 'INR' },
  { country: 'Indonesia', currency: 'IDR' },
  { country: 'Ireland', currency: 'EUR' },
  { country: 'Italy', currency: 'EUR' },
  { country: 'Japan', currency: 'JPY' },
  { country: 'Jordan', currency: 'JOD' },
  { country: 'Kenya', currency: 'KES' },
  { country: 'Kuwait', currency: 'KWD' },
  { country: 'Lebanon', currency: 'LBP' },
  { country: 'Libya', currency: 'LYD' },
  { country: 'Malaysia', currency: 'MYR' },
  { country: 'Mexico', currency: 'MXN' },
  { country: 'Morocco', currency: 'MAD' },
  { country: 'Netherlands', currency: 'EUR' },
  { country: 'New Zealand', currency: 'NZD' },
  { country: 'Nigeria', currency: 'NGN' },
  { country: 'Norway', currency: 'NOK' },
  { country: 'Oman', currency: 'OMR' },
  { country: 'Pakistan', currency: 'PKR' },
  { country: 'Poland', currency: 'PLN' },
  { country: 'Qatar', currency: 'QAR' },
  { country: 'Romania', currency: 'RON' },
  { country: 'Saudi Arabia', currency: 'SAR' },
  { country: 'Singapore', currency: 'SGD' },
  { country: 'South Africa', currency: 'ZAR' },
  { country: 'South Korea', currency: 'KRW' },
  { country: 'Spain', currency: 'EUR' },
  { country: 'Sweden', currency: 'SEK' },
  { country: 'Switzerland', currency: 'CHF' },
  { country: 'Thailand', currency: 'THB' },
  { country: 'Tunisia', currency: 'TND' },
  { country: 'Turkey', currency: 'TRY' },
  { country: 'United Arab Emirates', currency: 'AED' },
  { country: 'United Kingdom', currency: 'GBP' },
  { country: 'United States', currency: 'USD' },
  { country: 'Vietnam', currency: 'VND' },
]

const ZERO_MINOR_UNIT_CURRENCIES = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'])
const THREE_MINOR_UNIT_CURRENCIES = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'])

export function supportedCurrencyCodes() {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: 'currency') => string[] }
  const codes = typeof intl.supportedValuesOf === 'function' ? intl.supportedValuesOf('currency') : FALLBACK_CURRENCY_CODES
  return Array.from(new Set([...codes, ...FALLBACK_CURRENCY_CODES])).sort()
}

export function normalizeCurrencyCode(value: unknown, fallback = 'USD') {
  const currency = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (!/^[A-Z]{3}$/.test(currency)) return fallback
  return supportedCurrencyCodes().includes(currency) ? currency : fallback
}

export function currencyMinorUnit(currency: string) {
  const normalized = normalizeCurrencyCode(currency)
  if (ZERO_MINOR_UNIT_CURRENCIES.has(normalized)) return 0
  if (THREE_MINOR_UNIT_CURRENCIES.has(normalized)) return 3
  return 2
}

export function currencyMinorFactorNumber(currency: string) {
  return 10 ** currencyMinorUnit(currency)
}

export function minorUnitsToMajor(value: number, currency: string) {
  return value / currencyMinorFactorNumber(currency)
}

export function formatCurrencyOptionLabel(currency: string, locale = 'en-US') {
  const code = normalizeCurrencyCode(currency)
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: 'currency' })
    return `${code} - ${displayNames.of(code) ?? code}`
  } catch {
    return code
  }
}

export function getCurrencyOptions(locale = 'en-US'): CurrencyOption[] {
  return supportedCurrencyCodes().map((currency) => ({
    value: currency,
    label: formatCurrencyOptionLabel(currency, locale),
  }))
}

export function getCountryCurrencyOptions(): CountryCurrencyOption[] {
  return COUNTRY_CURRENCIES.map(({ country, currency }) => ({
    value: country,
    label: `${country} - ${currency}`,
    meta: currency,
    currency,
  }))
}

export function defaultCurrencyForCountry(country: unknown, fallback = 'USD') {
  const normalizedCountry = typeof country === 'string' ? country.trim().toLowerCase() : ''
  const match = COUNTRY_CURRENCIES.find((item) => item.country.toLowerCase() === normalizedCountry)
  return normalizeCurrencyCode(match?.currency, fallback)
}
