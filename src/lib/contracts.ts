export const CONTRACT_STATUSES = [
  'draft',
  'in_review',
  'approved',
  'sent',
  'viewed',
  'signed',
  'expired',
  'terminated',
  'archived',
] as const

export const CONTRACT_LANGUAGES = ['en', 'fr', 'ar', 'bilingual_en_fr', 'bilingual_en_ar'] as const

export type ContractStatus = (typeof CONTRACT_STATUSES)[number]
export type ContractLanguage = (typeof CONTRACT_LANGUAGES)[number]

export type ContractParty = {
  name: string
  contactName?: string | null
  email?: string | null
  address?: string | null
  country?: string | null
  taxId?: string | null
}

export type ContractSection = {
  id: string
  number: string
  title: string
  body: string[]
  riskLevel?: string
  category?: string
  bilingualTitle?: string
  bilingualBody?: string[]
}

export type ContractSignatureBlock = {
  role: string
  partyName: string
  signerName?: string | null
  signerEmail?: string | null
}

export type ContractContent = {
  title: string
  subtitle: string
  contractNumber: string
  language: ContractLanguage
  type: string
  status: string
  currency: string
  jurisdiction?: string | null
  governingLaw?: string | null
  effectiveDate?: string | null
  expiryDate?: string | null
  renewalTerms?: string | null
  paymentTerms?: string | null
  paymentFrequency?: string | null
  serviceScope?: string | null
  legalDisclaimer: string
  watermark?: string | null
  company: ContractParty
  client: ContractParty
  project?: {
    title?: string | null
    description?: string | null
  } | null
  financials: {
    currency: string
    estimatedValue?: number | null
    openInvoiceTotal?: number | null
    openInvoiceCount?: number
  }
  tableOfContents: Array<{ number: string; title: string }>
  sections: ContractSection[]
  signatureBlocks: ContractSignatureBlock[]
  aiSummary: string
  missingFields: string[]
  generatedAt: string
}

export type SerializedContract = {
  id: string
  companyId: string
  clientId?: string | null
  projectId?: string | null
  contractNumber: string
  title: string
  type: string
  status: string
  language: string
  currency: string
  jurisdiction?: string | null
  governingLaw?: string | null
  confidentialityLevel: string
  riskProfile: string
  currentVersionNumber: number
  effectiveDate?: string | null
  expiryDate?: string | null
  renewalDate?: string | null
  sentAt?: string | null
  viewedAt?: string | null
  approvedAt?: string | null
  signedAt?: string | null
  terminatedAt?: string | null
  createdAt: string
  updatedAt: string
  versions?: Array<{
    id: string
    versionNumber: number
    status: string
    locale: string
    title: string
    pdfByteLength?: number | null
    createdAt: string
  }>
  signatures?: Array<{
    id: string
    signerType: string
    signerName: string
    signerEmail?: string | null
    status: string
    method: string
    signedAt?: string | null
    createdAt: string
  }>
}

export function normalizeContractLanguage(value: unknown): ContractLanguage {
  return CONTRACT_LANGUAGES.includes(value as ContractLanguage) ? (value as ContractLanguage) : 'en'
}

export function normalizeContractStatus(value: unknown): ContractStatus {
  return CONTRACT_STATUSES.includes(value as ContractStatus) ? (value as ContractStatus) : 'draft'
}

export function normalizeContractCurrency(value: unknown) {
  const currency = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return /^[A-Z]{3}$/.test(currency) ? currency : 'USD'
}

export function primaryLocale(language: string) {
  if (language === 'ar' || language === 'bilingual_en_ar') return 'ar'
  if (language === 'fr' || language === 'bilingual_en_fr') return 'fr'
  return 'en'
}

export function contractDirection(language: string) {
  return primaryLocale(language) === 'ar' ? 'rtl' : 'ltr'
}

export function formatContractDate(value: Date | string | null | undefined, language = 'en') {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return '-'

  const locale = primaryLocale(language) === 'ar' ? 'ar-TN' : primaryLocale(language) === 'fr' ? 'fr-FR' : 'en-US'
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

export function formatContractMoney(value: number | string | null | undefined, currency: string, language = 'en') {
  const amount = typeof value === 'number' ? value : Number(value ?? 0)
  const locale = primaryLocale(language) === 'ar' ? 'ar-TN' : primaryLocale(language) === 'fr' ? 'fr-FR' : 'en-US'

  return new Intl.NumberFormat(locale, {
    currency: normalizeContractCurrency(currency),
    style: 'currency',
  }).format(Number.isFinite(amount) ? amount : 0)
}

export function getContractStatusLabel(status: string, language = 'en') {
  const labels: Record<ContractStatus, Record<'en' | 'fr' | 'ar', string>> = {
    draft: { en: 'Draft', fr: 'Brouillon', ar: 'مسودة' },
    in_review: { en: 'In review', fr: 'En revue', ar: 'قيد المراجعة' },
    approved: { en: 'Approved', fr: 'Approuve', ar: 'معتمد' },
    sent: { en: 'Sent', fr: 'Envoye', ar: 'مرسل' },
    viewed: { en: 'Viewed', fr: 'Consulte', ar: 'تمت المراجعة' },
    signed: { en: 'Signed', fr: 'Signe', ar: 'موقع' },
    expired: { en: 'Expired', fr: 'Expire', ar: 'منتهي' },
    terminated: { en: 'Terminated', fr: 'Resilie', ar: 'منهى' },
    archived: { en: 'Archived', fr: 'Archive', ar: 'مؤرشف' },
  }
  const locale = primaryLocale(language) as 'en' | 'fr' | 'ar'
  return labels[normalizeContractStatus(status)][locale]
}

export function safeContractText(value: unknown, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || fallback
}

export function serializeContractDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : null
}

export function serializeContract(contract: Record<string, unknown>): SerializedContract {
  const versions = Array.isArray(contract.versions)
    ? contract.versions.map((item) => {
        const version = item as Record<string, unknown>
        return {
          id: String(version.id),
          versionNumber: Number(version.versionNumber ?? 1),
          status: String(version.status ?? 'draft'),
          locale: String(version.locale ?? 'en'),
          title: String(version.title ?? ''),
          pdfByteLength: typeof version.pdfByteLength === 'number' ? version.pdfByteLength : null,
          createdAt: serializeContractDate(version.createdAt as Date | string | null | undefined) ?? new Date().toISOString(),
        }
      })
    : undefined

  const signatures = Array.isArray(contract.signatures)
    ? contract.signatures.map((item) => {
        const signature = item as Record<string, unknown>
        return {
          id: String(signature.id),
          signerType: String(signature.signerType ?? 'client'),
          signerName: String(signature.signerName ?? ''),
          signerEmail: typeof signature.signerEmail === 'string' ? signature.signerEmail : null,
          status: String(signature.status ?? 'pending'),
          method: String(signature.method ?? 'prepared'),
          signedAt: serializeContractDate(signature.signedAt as Date | string | null | undefined),
          createdAt: serializeContractDate(signature.createdAt as Date | string | null | undefined) ?? new Date().toISOString(),
        }
      })
    : undefined

  return {
    id: String(contract.id),
    companyId: String(contract.companyId),
    clientId: typeof contract.clientId === 'string' ? contract.clientId : null,
    projectId: typeof contract.projectId === 'string' ? contract.projectId : null,
    contractNumber: String(contract.contractNumber ?? ''),
    title: String(contract.title ?? ''),
    type: String(contract.type ?? 'SERVICE_AGREEMENT'),
    status: String(contract.status ?? 'draft'),
    language: String(contract.language ?? 'en'),
    currency: String(contract.currency ?? 'USD'),
    jurisdiction: typeof contract.jurisdiction === 'string' ? contract.jurisdiction : null,
    governingLaw: typeof contract.governingLaw === 'string' ? contract.governingLaw : null,
    confidentialityLevel: String(contract.confidentialityLevel ?? 'standard'),
    riskProfile: String(contract.riskProfile ?? 'standard'),
    currentVersionNumber: Number(contract.currentVersionNumber ?? 1),
    effectiveDate: serializeContractDate(contract.effectiveDate as Date | string | null | undefined),
    expiryDate: serializeContractDate(contract.expiryDate as Date | string | null | undefined),
    renewalDate: serializeContractDate(contract.renewalDate as Date | string | null | undefined),
    sentAt: serializeContractDate(contract.sentAt as Date | string | null | undefined),
    viewedAt: serializeContractDate(contract.viewedAt as Date | string | null | undefined),
    approvedAt: serializeContractDate(contract.approvedAt as Date | string | null | undefined),
    signedAt: serializeContractDate(contract.signedAt as Date | string | null | undefined),
    terminatedAt: serializeContractDate(contract.terminatedAt as Date | string | null | undefined),
    createdAt: serializeContractDate(contract.createdAt as Date | string | null | undefined) ?? new Date().toISOString(),
    updatedAt: serializeContractDate(contract.updatedAt as Date | string | null | undefined) ?? new Date().toISOString(),
    versions,
    signatures,
  }
}
