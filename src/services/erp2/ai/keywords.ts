/**
 * Comprehensive keyword→account mapping database.
 * The brain of the deterministic accounting engine.
 * Covers 200+ patterns across all common business transactions.
 */

export type AccountMatch = {
  accountCode: string
  accountName: string
  keywords: string[]
  priority: number // higher = more specific match
  expectedDebit: boolean // true = debit side, false = credit side
}

// Ordered by priority (most specific patterns first)
export const KEYWORD_MAP: AccountMatch[] = [
  // ── Software & Subscriptions (5030/5040) ──
  { accountCode: '5040', accountName: 'Software & Subscriptions', keywords: ['aws', 'amazon web services', 'azure', 'google cloud', 'gcp', 'digitalocean', 'heroku', 'netlify', 'vercel', 'cloudflare'], priority: 80, expectedDebit: true },
  { accountCode: '5040', accountName: 'Software & Subscriptions', keywords: ['github', 'gitlab', 'bitbucket', 'jira', 'confluence', 'notion', 'slack', 'teams', 'zoom', 'google workspace', 'g suite', 'microsoft 365', 'office 365'], priority: 80, expectedDebit: true },
  { accountCode: '5040', accountName: 'Software & Subscriptions', keywords: ['salesforce', 'hubspot', 'marketo', 'mailchimp', 'sendgrid', 'twilio', 'stripe', 'shopify', 'wordpress', 'wix', 'squarespace'], priority: 80, expectedDebit: true },
  { accountCode: '5040', accountName: 'Software & Subscriptions', keywords: ['adobe', 'creative cloud', 'photoshop', 'figma', 'canva', 'sketch', 'invision', 'datadog', 'new relic', 'sentry', 'logz.io'], priority: 80, expectedDebit: true },
  { accountCode: '5040', accountName: 'Software & Subscriptions', keywords: ['atlassian', 'linear', 'asana', 'monday.com', 'clickup', 'basecamp', 'trello', 'todoist'], priority: 75, expectedDebit: true },
  { accountCode: '5040', accountName: 'Software & Subscriptions', keywords: ['software', 'subscription', 'saas', 'license', 'hosting', 'domain', 'ssl', 'cdn'], priority: 60, expectedDebit: true },

  // ── Salaries & Wages (5010) ──
  { accountCode: '5010', accountName: 'Salaries & Wages', keywords: ['salary', 'payroll', 'wages', 'employee pay', 'pay run', 'paychex', 'adp', 'gusto', 'rippling', 'bamboo', 'deel', 'remote.com', 'oyster'], priority: 85, expectedDebit: true },
  { accountCode: '5010', accountName: 'Salaries & Wages', keywords: ['pay period', 'bi weekly', 'monthly payroll', 'payroll run', 'staff salary', 'team salary'], priority: 80, expectedDebit: true },

  // ── Marketing & Advertising (5020) ──
  { accountCode: '5020', accountName: 'Marketing & Advertising', keywords: ['google ads', 'google adwords', 'facebook ads', 'meta ads', 'instagram ads', 'linkedin ads', 'twitter ads', 'tiktok ads'], priority: 85, expectedDebit: true },
  { accountCode: '5020', accountName: 'Marketing & Advertising', keywords: ['ad spend', 'advertising', 'ppc', 'cpc', 'cpm', 'social media ad', 'display ad', 'retargeting'], priority: 70, expectedDebit: true },
  { accountCode: '5020', accountName: 'Marketing & Advertising', keywords: ['seo', 'sem', 'content marketing', 'pr agency', 'public relations', 'influencer', 'sponsored'], priority: 65, expectedDebit: true },

  // ── Rent & Facilities (5030) ──
  { accountCode: '5030', accountName: 'Rent & Facilities', keywords: ['rent', 'lease', 'office rent', 'warehouse rent', 'wework', 'regus', 'coworking', 'space as a service'], priority: 80, expectedDebit: true },
  { accountCode: '5030', accountName: 'Rent & Facilities', keywords: ['electricity', 'power bill', 'utility', 'water bill', 'internet bill', 'cleaning', 'janitorial', 'facility'], priority: 75, expectedDebit: true },

  // ── Professional Fees (5050) ──
  { accountCode: '5050', accountName: 'Professional Fees', keywords: ['legal', 'lawyer', 'attorney', 'legal fees', 'legal advice', 'legal retainer', 'notary'], priority: 85, expectedDebit: true },
  { accountCode: '5050', accountName: 'Professional Fees', keywords: ['accounting', 'accountant', 'bookkeeping', 'audit', 'tax preparation', 'tax filing', 'cpa'], priority: 85, expectedDebit: true },
  { accountCode: '5050', accountName: 'Professional Fees', keywords: ['consultant', 'consulting', 'consultancy', 'advisory', 'management consulting', 'business coach'], priority: 75, expectedDebit: true },
  { accountCode: '5050', accountName: 'Professional Fees', keywords: ['recruitment', 'recruiting', 'headhunter', 'staffing agency', 'temp agency'], priority: 70, expectedDebit: true },

  // ── Travel & Meals (5060) ──
  { accountCode: '5060', accountName: 'Travel & Meals', keywords: ['flight', 'airfare', 'airline', 'delta', 'united', 'american airlines', 'southwest', 'jetblue'], priority: 80, expectedDebit: true },
  { accountCode: '5060', accountName: 'Travel & Meals', keywords: ['hotel', 'lodging', 'marriott', 'hilton', 'airbnb', 'booking.com', 'expedia', 'hotels.com'], priority: 80, expectedDebit: true },
  { accountCode: '5060', accountName: 'Travel & Meals', keywords: ['uber', 'lyft', 'taxi', 'car rental', 'rental car', 'hertz', 'avis', 'enterprise'], priority: 80, expectedDebit: true },
  { accountCode: '5060', accountName: 'Travel & Meals', keywords: ['meal', 'lunch', 'dinner', 'restaurant', 'doordash', 'ubereats', 'grubhub', 'business meal'], priority: 75, expectedDebit: true },
  { accountCode: '5060', accountName: 'Travel & Meals', keywords: ['travel', 'business trip', 'conference', 'parking', 'toll', 'mileage'], priority: 65, expectedDebit: true },

  // ── Bank Fees (5050 base, but we add specific) ──
  { accountCode: '5050', accountName: 'Professional Fees', keywords: ['bank fee', 'wire fee', 'transfer fee', 'processing fee', 'payment fee', 'stripe fee', 'paypal fee'], priority: 75, expectedDebit: true },

  // ── Shipping & Delivery ──
  { accountCode: '5030', accountName: 'Rent & Facilities', keywords: ['fedex', 'ups', 'usps', 'dhl', 'shipping', 'delivery', 'postage', 'courier', 'last mile'], priority: 75, expectedDebit: true },

  // ── Office Supplies ──
  { accountCode: '5030', accountName: 'Rent & Facilities', keywords: ['office supplies', 'stationery', 'printer', 'ink', 'toner', 'paper', 'furniture', 'desk', 'chair'], priority: 70, expectedDebit: true },

  // ── Revenue (4010/4020) ──
  { accountCode: '4010', accountName: 'Service Revenue', keywords: ['invoice payment', 'client payment', 'customer payment', 'payment received', 'consulting fee', 'service fee'], priority: 80, expectedDebit: false },
  { accountCode: '4010', accountName: 'Service Revenue', keywords: ['retainer', 'monthly retainer', 'quarterly retainer', 'annual retainer'], priority: 85, expectedDebit: false },
  { accountCode: '4020', accountName: 'Product Revenue', keywords: ['product sale', 'merchandise', 'physical product', 'digital product', 'license sale', 'royalty'], priority: 75, expectedDebit: false },

  // ── Bank & Cash (1010) ──
  { accountCode: '1010', accountName: 'Cash and Bank', keywords: ['bank deposit', 'wire in', 'ach credit', 'direct deposit', 'bank interest', 'interest income'], priority: 70, expectedDebit: false },
  { accountCode: '1010', accountName: 'Cash and Bank', keywords: ['bank transfer', 'ach debit', 'wire out', 'withdrawal', 'atm'], priority: 70, expectedDebit: true },

  // ── AR (1020) ──
  { accountCode: '1020', accountName: 'Accounts Receivable', keywords: ['accounts receivable', 'invoice outstanding', 'receivable', 'client receivable', 'trade receivable'], priority: 80, expectedDebit: true },
  { accountCode: '1020', accountName: 'Accounts Receivable', keywords: ['payment on account', 'advance payment', 'deposit from client'], priority: 65, expectedDebit: false },

  // ── AP / Vendor Payments (2010) ──
  { accountCode: '2010', accountName: 'Accounts Payable', keywords: ['vendor payment', 'supplier payment', 'payables', 'trade payable', 'bill payment'], priority: 75, expectedDebit: false },
  { accountCode: '2010', accountName: 'Accounts Payable', keywords: ['outstanding bill', 'unpaid invoice'], priority: 65, expectedDebit: false },

  // ── Deferred Revenue (2030) ──
  { accountCode: '2030', accountName: 'Deferred Revenue', keywords: ['deferred revenue', 'unearned revenue', 'prepaid service', 'advance billing'], priority: 80, expectedDebit: false },

  // ── Prepaid Expenses (1030) ──
  { accountCode: '1030', accountName: 'Prepaid Expenses', keywords: ['prepaid', 'prepayment', 'advance payment', 'deposit paid', 'insurance premium'], priority: 75, expectedDebit: true },

  // ── Equipment (1110) ──
  { accountCode: '1110', accountName: 'Property and Equipment', keywords: ['computer', 'laptop', 'server', 'hardware', 'equipment', 'machinery', 'furniture and fixture', 'vehicle'], priority: 80, expectedDebit: true },

  // ── Depreciation (5070) ──
  { accountCode: '5070', accountName: 'Depreciation', keywords: ['depreciation', 'amortization', 'depreciation expense'], priority: 85, expectedDebit: true },

  // ── General patterns (lower priority) ──
  { accountCode: '4010', accountName: 'Service Revenue', keywords: ['payment from', 'received from', 'paid by client', 'money in'], priority: 50, expectedDebit: false },
  { accountCode: '5000', accountName: 'Operating Expenses', keywords: ['expense', 'cost', 'purchase', 'bill', 'charge', 'payment to', 'paid to'], priority: 30, expectedDebit: true },
  { accountCode: '5000', accountName: 'Operating Expenses', keywords: ['miscellaneous', 'sundry', 'general expense', 'operating expense'], priority: 20, expectedDebit: true },
]

export const DEFAULT_BANK_ACCOUNT = { code: '1010', name: 'Cash and Bank' }
export const DEFAULT_EXPENSE_ACCOUNT = { code: '5000', name: 'Operating Expenses' }
export const DEFAULT_REVENUE_ACCOUNT = { code: '4010', name: 'Service Revenue' }
