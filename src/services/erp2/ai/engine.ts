import { KEYWORD_MAP, DEFAULT_BANK_ACCOUNT, DEFAULT_EXPENSE_ACCOUNT, DEFAULT_REVENUE_ACCOUNT, type AccountMatch } from '@/services/erp2/ai/keywords'

export type SuggestedLine = {
  accountCode: string
  accountName: string
  side: 'debit' | 'credit'
  amount: number
}

export type SuggestionResult = {
  lines: SuggestedLine[]
  confidence: number
  engine: 'deterministic'
  matchedVendor?: string | null
  matchedKeyword?: string
}

type ParsedDescription = {
  vendors: string[]
  amount: number | null
  keywords: string[]
  isExpense: boolean
  isRevenue: boolean
  isTransfer: boolean
  raw: string
}

// Known vendor names mapped to normalized forms
const VENDOR_ALIASES: Record<string, string[]> = {
  'aws': ['amazon web services', 'aws inc', 'aws services', 'amazon cloud'],
  'google': ['google cloud', 'gcp', 'google workspace', 'google ads', 'google llc'],
  'microsoft': ['azure', 'microsoft 365', 'office 365', 'microsoft corp'],
  'stripe': ['stripe inc', 'stripe payments', 'stripe.com'],
  'github': ['github inc', 'github.com'],
  'slack': ['slack technologies', 'slack.com'],
  'notion': ['notion labs', 'notion.so'],
  'hubspot': ['hubspot inc', 'hubspot.com'],
  'adobe': ['adobe inc', 'adobe systems', 'creative cloud'],
  'atlassian': ['atlassian pty', 'atlassian.com'],
  'zoom': ['zoom video', 'zoom.us'],
  'twilio': ['twilio inc', 'twilio.com'],
  'sendgrid': ['sendgrid inc', 'twilio sendgrid'],
  'digitalocean': ['digital ocean', 'docean'],
  'datadog': ['datadog inc', 'datadoghq'],
  'new relic': ['new relic inc', 'newrelic'],
  'vercel': ['vercel inc', 'vercel.com'],
  'netlify': ['netlify inc', 'netlify.com'],
  'shopify': ['shopify inc', 'shopify.com'],
  'mailchimp': ['mailchimp.com', 'intuit mailchimp'],
  'deel': ['deel inc', 'deel.com'],
  'gusto': ['gusto inc', 'gusto.com'],
  'wework': ['wework companies', 'wework.com'],
  'regus': ['regus group', 'regus.com'],
  'fedex': ['fedex corp', 'federal express', 'fedex.com'],
  'ups': ['ups corp', 'united parcel', 'ups.com'],
  'delta': ['delta air', 'delta airlines'],
  'uber': ['uber bv', 'uber.com', 'uber for business'],
  'lyft': ['lyft inc', 'lyft.com'],
  'marriott': ['marriott intl', 'marriott hotel'],
  'hilton': ['hilton worldwide', 'hilton hotel'],
  'airbnb': ['airbnb inc', 'airbnb.com'],
}

function findVendors(text: string): string[] {
  const found: string[] = []
  const lower = text.toLowerCase()

  // Check aliases first (multi-word vendor names)
  for (const [canonical, aliases] of Object.entries(VENDOR_ALIASES)) {
    for (const alias of aliases) {
      if (lower.includes(alias)) {
        found.push(canonical)
        break
      }
    }
  }

  // Direct keyword map vendor names
  for (const mapping of KEYWORD_MAP) {
    for (const kw of mapping.keywords) {
      if (lower.includes(kw) && kw.length > 2) {
        // Don't double-count if already found via aliases
        const matchedCanonical = Object.entries(VENDOR_ALIASES).find(([, aliases]) =>
          aliases.some(a => kw.includes(a) || a.includes(kw))
        )
        if (!matchedCanonical && !found.includes(kw)) {
          found.push(kw)
        }
      }
    }
  }

  return [...new Set(found)]
}

function extractAmount(text: string): number | null {
  // Patterns: $2,400.00, $2400, 2,400.00, $2.4k, 2400
  const patterns = [
    /\$?([\d,]+(?:\.\d{2})?)\s*k\s*(?:USD|usd)?/i,
    /\$?\s*([\d,]+(?:\.\d{1,2})?)/,
    /(\d+)\s*(?:USD|usd|dollars)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      let num = parseFloat(match[1].replace(/,/g, ''))
      if (text.toLowerCase().includes('k') && !text.includes('.')) {
        num *= 1000
      }
      if (!isNaN(num) && num > 0) return Math.round(num * 100) // return cents
    }
  }

  return null
}

function classifyTransaction(text: string): Pick<ParsedDescription, 'isExpense' | 'isRevenue' | 'isTransfer'> {
  const lower = text.toLowerCase()

  const expenseSignals = [
    'paid', 'payment to', 'pay to', 'purchase', 'bought', 'bought', 'cost',
    'fee', 'expense', 'bill', 'invoice from', 'charge', 'spent',
  ]
  const revenueSignals = [
    'received', 'payment from', 'paid by', 'invoice paid', 'deposit from',
    'client payment', 'sale', 'revenue', 'income',
  ]
  const transferSignals = [
    'transfer', 'moved', 'between accounts', 'from account', 'to account',
  ]

  const isExpense = expenseSignals.some(s => lower.includes(s))
  const isRevenue = revenueSignals.some(s => lower.includes(s))
  const isTransfer = transferSignals.some(s => lower.includes(s))

  // If not classified, try to infer from common patterns
  if (!isExpense && !isRevenue && !isTransfer) {
    // "AWS $500" → expense
    // "Client X $1000" → revenue
    const vendorFound = findVendors(text).length > 0
    // Default to expense for vendor mentions
    return { isExpense: vendorFound, isRevenue: !vendorFound, isTransfer: false }
  }

  return { isExpense, isRevenue, isTransfer }
}

function matchKeywords(text: string): AccountMatch[] {
  const lower = text.toLowerCase()
  const matches: { match: AccountMatch; score: number }[] = []

  for (const mapping of KEYWORD_MAP) {
    for (const kw of mapping.keywords) {
      if (lower.includes(kw)) {
        // Priority-based scoring with length bonus for specific matches
        const specificityBonus = kw.length > 8 ? 10 : kw.length > 5 ? 5 : 0
        const score = mapping.priority + specificityBonus
        matches.push({ match: mapping, score })
        break // one keyword per mapping is enough
      }
    }
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .map(m => m.match)
}

export function suggestJournalEntry(description: string, amountCents?: number | null): SuggestionResult {
  const text = description.trim()
  const vendors = findVendors(text)
  const extractedAmount = amountCents ?? extractAmount(text)
  const transactionType = classifyTransaction(text)
  const keywordMatches = matchKeywords(text)

  const matchedVendor = vendors[0]
  const bestMatch = keywordMatches[0]
  const matchedKeyword = bestMatch?.keywords?.find(kw => text.toLowerCase().includes(kw))

  // Build journal lines
  const lines: SuggestedLine[] = []
  const amount = extractedAmount ?? 0

  if (keywordMatches.length > 0 && amount > 0) {
    const primary = bestMatch!

    // Determine if this is expense/asset (debit primary) or revenue/liability (credit primary)
    if (primary.expectedDebit) {
      // Expense/asset purchase: debit the expense account, credit bank
      lines.push({
        accountCode: primary.accountCode,
        accountName: primary.accountName,
        side: 'debit',
        amount,
      })
      lines.push({
        accountCode: DEFAULT_BANK_ACCOUNT.code,
        accountName: DEFAULT_BANK_ACCOUNT.name,
        side: 'credit',
        amount,
      })
    } else {
      // Revenue/liability: debit bank, credit the revenue account
      lines.push({
        accountCode: DEFAULT_BANK_ACCOUNT.code,
        accountName: DEFAULT_BANK_ACCOUNT.name,
        side: 'debit',
        amount,
      })
      lines.push({
        accountCode: primary.accountCode,
        accountName: primary.accountName,
        side: 'credit',
        amount,
      })
    }
  } else if (amount > 0) {
    // No keyword match — use transaction type to determine default mapping
    if (transactionType.isExpense) {
      lines.push({ accountCode: DEFAULT_EXPENSE_ACCOUNT.code, accountName: DEFAULT_EXPENSE_ACCOUNT.name, side: 'debit', amount })
      lines.push({ accountCode: DEFAULT_BANK_ACCOUNT.code, accountName: DEFAULT_BANK_ACCOUNT.name, side: 'credit', amount })
    } else {
      lines.push({ accountCode: DEFAULT_BANK_ACCOUNT.code, accountName: DEFAULT_BANK_ACCOUNT.name, side: 'debit', amount })
      lines.push({ accountCode: DEFAULT_REVENUE_ACCOUNT.code, accountName: DEFAULT_REVENUE_ACCOUNT.name, side: 'credit', amount })
    }
  }

  // Calculate confidence
  const confidence = calculateConfidence(vendors.length, keywordMatches.length, amount, bestMatch)

  return { lines, confidence, engine: 'deterministic', matchedVendor, matchedKeyword }
}

function calculateConfidence(vendorCount: number, matchCount: number, amount: number | null, bestMatch?: AccountMatch): number {
  if (!amount || amount <= 0) return 10 // missing amount = very low confidence

  let score = 30 // base

  if (vendorCount > 0) score += 20
  if (matchCount > 0 && bestMatch) {
    score += Math.min(40, bestMatch.priority * 0.5)
  }
  if (matchCount > 1) score += 10
  if (vendorCount > 0 && matchCount > 0) score += 15 // vendor + keyword = strong signal

  const vendorSignal = matchedVendorConfidence(bestMatch)
  score += vendorSignal

  return Math.min(100, Math.round(score))
}

function matchedVendorConfidence(match?: AccountMatch): number {
  if (!match) return 0
  // High-priority matches (specific vendors) get extra confidence
  if (match.priority >= 80) return 10
  if (match.priority >= 60) return 5
  return 0
}

export function engineInfo(): { name: string; version: string; patterns: number } {
  return {
    name: 'ERP Deterministic Accounting Engine',
    version: '1.0.0',
    patterns: KEYWORD_MAP.length,
  }
}
