import { getMessage, type TranslationKey } from '@/lib/i18n'

export type IntentType =
  | 'CREATE_RECORD'
  | 'UPDATE_RECORD'
  | 'DELETE_RECORD'
  | 'MARK_PAID'
  | 'ANALYZE'
  | 'SEARCH_RECORDS'
  | 'SEND_ALERT'
  | 'GENERATE_REPORT'
  | 'UNKNOWN'

export type AIEntity = 'invoice' | 'client' | 'campaign' | 'task' | 'brief' | 'deliverable'
export type AILanguage = 'en' | 'fr' | 'ar'

export interface AiAmbiguityOption {
  id: string
  label: string
  details: string
}

export interface AiAmbiguityPanelPayload {
  question: string
  options: AiAmbiguityOption[]
  intentType: IntentType
  entity?: AIEntity
  rawInput: string
  normalizedInput: string
  language: AILanguage
}

export interface ResolvedIntent {
  type: IntentType
  entity?: AIEntity
  entityId?: string
  entityName?: string
  confidence: number
  rawInput: string
  normalizedInput: string
  params: Record<string, unknown>
  language: AILanguage
  ambiguous: boolean
  alternatives?: string[]
  ambiguityPanel?: AiAmbiguityPanelPayload
}

export interface IntentRecordCandidate {
  id: string
  entity: AIEntity
  label: string
  details?: string
  aliases?: string[]
}

export interface IntentResolutionContext {
  records?: IntentRecordCandidate[]
}

export const ABBREVIATIONS: Record<string, string> = {
  inv: 'invoice',
  cli: 'client',
  camp: 'campaign',
  del: 'delete',
  creat: 'create',
  upd: 'update',
  proj: 'project',
  mgr: 'manager',
  dlv: 'deliverable',
  tsk: 'task',
}

export const INTENT_KEYWORDS = {
  CREATE: ['create', 'add', 'new', 'créer', 'ajouter', 'nouveau', 'إنشاء', 'أضف', 'جديد'],
  DELETE: ['delete', 'remove', 'supprimer', 'effacer', 'حذف', 'إزالة', 'امسح'],
  UPDATE: ['update', 'edit', 'change', 'modifier', 'changer', 'تعديل', 'تغيير', 'عدّل'],
  MARK_PAID: ['paid', 'payment', 'payé', 'règlement', 'مدفوع', 'سدد', 'دفع'],
  ANALYZE: ['analyze', 'report', 'summary', 'analyser', 'rapport', 'تحليل', 'تقرير'],
} as const

const CONFIDENCE_FLOOR = 0.65

const EXTRA_INTENT_KEYWORDS: Record<IntentType, string[]> = {
  CREATE_RECORD: [
    ...INTENT_KEYWORDS.CREATE,
    'make',
    'draft',
    'generate',
    'start',
    'creer',
    'generer',
    'générer',
    'انشاء',
    'انشئ',
    'أنشئ',
    'اضافة',
    'إضافة',
  ],
  UPDATE_RECORD: [...INTENT_KEYWORDS.UPDATE, 'mark', 'set', 'mettre', 'marquer', 'تحديث', 'حدث', 'غير'],
  DELETE_RECORD: [...INTENT_KEYWORDS.DELETE, 'erase', 'retirer', 'احذف', 'مسح'],
  MARK_PAID: [...INTENT_KEYWORDS.MARK_PAID, 'mark paid', 'payment received', 'payed', 'paye', 'payee', 'reglee', 'réglée', 'مدفوعة', 'تم الدفع'],
  ANALYZE: [...INTENT_KEYWORDS.ANALYZE, 'risk', 'risks', 'forecast', 'bottleneck', 'résumé', 'ملخص'],
  SEARCH_RECORDS: ['show', 'find', 'list', 'search', 'lookup', 'display', 'afficher', 'chercher', 'trouver', 'liste', 'اعرض', 'ابحث', 'أظهر'],
  SEND_ALERT: ['alert', 'notify', 'remind', 'send message', 'alerte', 'notifier', 'rappeler', 'تنبيه', 'نبه', 'ذكر', 'إرسال'],
  GENERATE_REPORT: ['generate report', 'weekly report', 'report', 'rapport', 'générer rapport', 'تقرير', 'إنشاء تقرير'],
  UNKNOWN: [],
}

const ENTITY_KEYWORDS: Record<AIEntity, string[]> = {
  invoice: ['invoice', 'invoices', 'bill', 'bills', 'facture', 'factures', 'فاتورة', 'فواتير'],
  client: ['client', 'clients', 'customer', 'customers', 'account', 'compte', 'عميل', 'عملاء', 'زبون', 'العميل'],
  campaign: ['campaign', 'campaigns', 'project', 'projects', 'campagne', 'campagnes', 'projet', 'projets', 'حملة', 'حملات', 'الحملة', 'مشروع', 'مشاريع'],
  task: ['task', 'tasks', 'todo', 'mission', 'tache', 'taches', 'tâche', 'tâches', 'مهمة', 'مهام'],
  brief: ['brief', 'briefs', 'بريف', 'ملخص', 'ملخصات'],
  deliverable: ['deliverable', 'deliverables', 'livrable', 'livrables', 'تسليم', 'تسليمات', 'منجز'],
}

const ENTITY_ORDER: AIEntity[] = ['invoice', 'client', 'campaign', 'task', 'brief', 'deliverable']
const ACTIONABLE_INTENTS: IntentType[] = ['CREATE_RECORD', 'UPDATE_RECORD', 'DELETE_RECORD', 'MARK_PAID', 'SEND_ALERT']
const DANGEROUS_INTENTS: IntentType[] = ['DELETE_RECORD', 'MARK_PAID']

const EN_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'for',
  'from',
  'in',
  'is',
  'me',
  'of',
  'on',
  'one',
  'please',
  'the',
  'this',
  'to',
  'with',
])

const FR_STOPWORDS = new Set(['de', 'des', 'du', 'la', 'le', 'les', 'pour', 'un', 'une', 'et', 'avec', 'dans'])
const AR_STOPWORDS = new Set(['من', 'في', 'على', 'عن', 'الى', 'إلى', 'ال', 'هذا', 'هذه', 'للعميل'])

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))))
}

export function normalizeInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/\s+/g, ' ')
}

function normalizeComparable(value: string): string {
  return normalizeInput(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .normalize('NFC')
}

function normalizedToken(value: string): string {
  return normalizeComparable(value).replace(/^[^\p{L}\p{N}#]+|[^\p{L}\p{N}#]+$/gu, '')
}

function tokenize(input: string): string[] {
  return normalizeComparable(input)
    .split(/[^\p{L}\p{N}#-]+/u)
    .map((token) => token.trim())
    .filter(Boolean)
}

export function levenshtein(a: string, b: string): number {
  const left = Array.from(a)
  const right = Array.from(b)

  if (left.length === 0) return right.length
  if (right.length === 0) return left.length

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  const current = Array.from({ length: right.length + 1 }, () => 0)

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost
      )
    }

    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j]
    }
  }

  return previous[right.length]
}

function similarity(a: string, b: string): number {
  const left = normalizeComparable(a)
  const right = normalizeComparable(b)
  const length = Math.max(Array.from(left).length, Array.from(right).length)
  if (length === 0) return 1
  return 1 - levenshtein(left, right) / length
}

export function fuzzyMatch(input: string, candidates: string[], threshold = 0.75): string | null {
  const normalized = normalizeComparable(input)
  let best: { candidate: string; score: number } | null = null

  for (const candidate of candidates) {
    const score = similarity(normalized, candidate)
    if (!best || score > best.score) best = { candidate, score }
  }

  return best && best.score >= threshold ? best.candidate : null
}

export function expandAbbreviations(input: string): string {
  return input
    .split(/\s+/)
    .map((token) => {
      const normalized = normalizedToken(token)
      if (!normalized) return token
      const expanded = ABBREVIATIONS[normalized]
      return expanded ?? token
    })
    .join(' ')
}

function detectLanguage(input: string): AILanguage {
  if (/[\u0600-\u06ff]/.test(input)) return 'ar'
  if (/[àâçéèêëîïôùûüÿœæ]/i.test(input)) return 'fr'

  const comparable = normalizeComparable(input)
  const frenchSignals = [
    'ajouter',
    'campagne',
    'changer',
    'client',
    'creer',
    'facture',
    'modifier',
    'nouveau',
    'rapport',
    'supprimer',
  ]

  return frenchSignals.some((word) => comparable.includes(word)) ? 'fr' : 'en'
}

function scoreTokenAgainstCandidate(token: string, candidate: string): number {
  const normalized = normalizedToken(token)
  const normalizedCandidate = normalizedToken(candidate)
  if (!normalized || !normalizedCandidate) return 0
  if (normalized === normalizedCandidate) return 1
  if (normalizedCandidate.startsWith(normalized) && normalized.length >= 3) {
    return Math.max(0.78, normalized.length / normalizedCandidate.length)
  }
  if (normalized.startsWith(normalizedCandidate) && normalizedCandidate.length >= 3) return 0.82
  return similarity(normalized, normalizedCandidate)
}

function scorePhrase(input: string, tokens: string[], candidates: string[]): { score: number; matched?: string } {
  const normalized = normalizeComparable(input)
  let best: { score: number; matched?: string } = { score: 0 }

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeComparable(candidate)
    if (!normalizedCandidate) continue

    if (normalized.includes(normalizedCandidate)) {
      const score = normalizedCandidate.includes(' ') ? 1 : 0.98
      if (score > best.score) best = { score, matched: candidate }
      continue
    }

    const candidateTokens = tokenize(candidate)
    const tokenScore =
      candidateTokens.length > 1
        ? candidateTokens.reduce((sum, candidateToken) => {
            const bestTokenScore = Math.max(0, ...tokens.map((token) => scoreTokenAgainstCandidate(token, candidateToken)))
            return sum + bestTokenScore
          }, 0) / candidateTokens.length
        : Math.max(0, ...tokens.map((token) => scoreTokenAgainstCandidate(token, candidate)))

    if (tokenScore > best.score) best = { score: tokenScore, matched: candidate }
  }

  return best
}

function classifyIntent(input: string, tokens: string[]): { type: IntentType; confidence: number; alternatives: string[] } {
  const scored = (Object.keys(EXTRA_INTENT_KEYWORDS) as IntentType[])
    .filter((type) => type !== 'UNKNOWN')
    .map((type) => ({ type, ...scorePhrase(input, tokens, EXTRA_INTENT_KEYWORDS[type]) }))
    .sort((a, b) => b.score - a.score)

  const top = scored[0]
  const second = scored[1]

  let type = top?.type ?? 'UNKNOWN'
  let confidence = top?.score ?? 0

  const hasPaid = scorePhrase(input, tokens, EXTRA_INTENT_KEYWORDS.MARK_PAID).score >= 0.75
  const hasInvoice = scorePhrase(input, tokens, ENTITY_KEYWORDS.invoice).score >= 0.75
  const hasAlert = scorePhrase(input, tokens, EXTRA_INTENT_KEYWORDS.SEND_ALERT).score >= 0.75
  const hasReport = scorePhrase(input, tokens, EXTRA_INTENT_KEYWORDS.GENERATE_REPORT).score >= 0.82
  const hasAnalyze = scorePhrase(input, tokens, EXTRA_INTENT_KEYWORDS.ANALYZE).score >= 0.82

  if (hasPaid && hasInvoice) {
    type = 'MARK_PAID'
    confidence = Math.max(confidence, 0.92)
  } else if (hasAlert) {
    type = 'SEND_ALERT'
    confidence = Math.max(confidence, 0.86)
  } else if (hasReport && (hasAnalyze || scorePhrase(input, tokens, EXTRA_INTENT_KEYWORDS.CREATE_RECORD).score >= 0.75)) {
    type = 'GENERATE_REPORT'
    confidence = Math.max(confidence, 0.86)
  }

  const alternatives = scored
    .filter((item) => item.type !== type && item.score >= Math.max(CONFIDENCE_FLOOR, confidence - 0.12))
    .slice(0, 3)
    .map((item) => item.type)

  if (confidence < CONFIDENCE_FLOOR) return { type: 'UNKNOWN', confidence, alternatives }
  if (second && second.type !== type && second.score >= 0.78 && confidence - second.score < 0.06) {
    alternatives.push(second.type)
  }

  return { type, confidence, alternatives: [...new Set(alternatives)] }
}

function classifyEntity(input: string, tokens: string[]): { entity?: AIEntity; confidence: number; alternatives: AIEntity[] } {
  const scored = ENTITY_ORDER
    .map((entity) => ({ entity, ...scorePhrase(input, tokens, ENTITY_KEYWORDS[entity]) }))
    .sort((a, b) => b.score - a.score)

  const matches = scored.filter((item) => item.score >= CONFIDENCE_FLOOR)
  if (matches.length === 0) return { confidence: 0, alternatives: [] }

  const positions = matches.map((item) => ({
    ...item,
    position: firstKeywordPosition(input, ENTITY_KEYWORDS[item.entity]),
  }))

  const ordered = positions.sort((a, b) => {
    const aPosition = a.position < 0 ? Number.MAX_SAFE_INTEGER : a.position
    const bPosition = b.position < 0 ? Number.MAX_SAFE_INTEGER : b.position
    if (Math.abs(a.score - b.score) <= 0.08 && aPosition !== bPosition) return aPosition - bPosition
    return b.score - a.score
  })

  const top = ordered[0]
  const alternatives = ordered
    .filter((item) => item.entity !== top.entity && item.score >= Math.max(CONFIDENCE_FLOOR, top.score - 0.12))
    .slice(0, 3)
    .map((item) => item.entity)

  return { entity: top.entity, confidence: top.score, alternatives }
}

function firstKeywordPosition(input: string, keywords: string[]) {
  const normalized = normalizeComparable(input)
  const positions = keywords
    .map((keyword) => normalized.indexOf(normalizeComparable(keyword)))
    .filter((position) => position >= 0)

  return positions.length ? Math.min(...positions) : -1
}

function canonicalMappings(): Array<{ keywords: string[]; canonical: string }> {
  return [
    { keywords: EXTRA_INTENT_KEYWORDS.CREATE_RECORD, canonical: 'create' },
    { keywords: EXTRA_INTENT_KEYWORDS.DELETE_RECORD, canonical: 'delete' },
    { keywords: EXTRA_INTENT_KEYWORDS.UPDATE_RECORD, canonical: 'update' },
    { keywords: ['mark', 'mak'], canonical: 'mark' },
    { keywords: EXTRA_INTENT_KEYWORDS.MARK_PAID, canonical: 'paid' },
    { keywords: EXTRA_INTENT_KEYWORDS.SEND_ALERT, canonical: 'alert' },
    { keywords: EXTRA_INTENT_KEYWORDS.GENERATE_REPORT, canonical: 'report' },
    { keywords: ENTITY_KEYWORDS.invoice, canonical: 'invoice' },
    { keywords: ENTITY_KEYWORDS.client, canonical: 'client' },
    { keywords: ENTITY_KEYWORDS.campaign, canonical: 'campaign' },
    { keywords: ENTITY_KEYWORDS.task, canonical: 'task' },
    { keywords: ENTITY_KEYWORDS.brief, canonical: 'brief' },
    { keywords: ENTITY_KEYWORDS.deliverable, canonical: 'deliverable' },
  ]
}

function replaceTokenCore(token: string, replacement: string): string {
  const match = token.match(/^([^\p{L}\p{N}#]*)([\p{L}\p{N}#-]+)([^\p{L}\p{N}#]*)$/u)
  if (!match) return replacement
  return `${match[1]}${replacement}${match[3]}`
}

function canonicalizeToken(token: string): string {
  const normalized = normalizedToken(token)
  if (!normalized) return token
  const expanded = ABBREVIATIONS[normalized] ?? normalized
  if (expanded !== normalized) return replaceTokenCore(token, expanded)

  let best: { canonical: string; score: number } | null = null
  for (const mapping of canonicalMappings()) {
    const score = Math.max(0, ...mapping.keywords.map((keyword) => scoreTokenAgainstCandidate(normalized, keyword)))
    if (score >= 0.74 && (!best || score > best.score)) {
      best = { canonical: mapping.canonical, score }
    }
  }

  return best ? replaceTokenCore(token, best.canonical) : token
}

function canonicalizeInput(input: string): string {
  return input
    .split(/\s+/)
    .map((token) => canonicalizeToken(token))
    .join(' ')
}

function stopwordsForLanguage(language: AILanguage) {
  if (language === 'fr') return FR_STOPWORDS
  if (language === 'ar') return AR_STOPWORDS
  return EN_STOPWORDS
}

function removeKnownOperationalWords(tokens: string[], language: AILanguage) {
  const knownWords = new Set<string>()
  for (const words of Object.values(EXTRA_INTENT_KEYWORDS)) {
    for (const word of words.flatMap((item) => tokenize(item))) knownWords.add(word)
  }
  for (const words of Object.values(ENTITY_KEYWORDS)) {
    for (const word of words.flatMap((item) => tokenize(item))) knownWords.add(word)
  }
  for (const value of Object.values(ABBREVIATIONS)) knownWords.add(value)
  for (const key of Object.keys(ABBREVIATIONS)) knownWords.add(key)

  const stopwords = stopwordsForLanguage(language)
  return tokens.filter((token) => {
    const normalized = normalizedToken(token)
    if (!normalized || normalized.length < 2) return false
    if (stopwords.has(normalized)) return false
    return !knownWords.has(normalized)
  })
}

function recordLabels(record: IntentRecordCandidate): string[] {
  return [record.label, ...(record.aliases ?? [])].filter((label) => label.trim().length > 0)
}

function scoreRecord(queryTokens: string[], record: IntentRecordCandidate): number {
  if (queryTokens.length === 0) return 0
  const labels = recordLabels(record)
  let best = 0

  for (const label of labels) {
    const labelComparable = normalizeComparable(label)
    const labelTokens = tokenize(labelComparable)
    const query = queryTokens.join(' ')
    if (query.length >= 2 && labelComparable.includes(query)) best = Math.max(best, query.length / Math.max(labelComparable.length, query.length))

    const tokenScore = queryTokens.reduce((sum, token) => {
      const bestToken = Math.max(0, ...labelTokens.map((labelToken) => scoreTokenAgainstCandidate(token, labelToken)))
      return sum + bestToken
    }, 0) / queryTokens.length

    best = Math.max(best, tokenScore)
  }

  return clampConfidence(best)
}

function resolveRecord(
  intent: { type: IntentType; entity?: AIEntity; language: AILanguage; rawInput: string; normalizedInput: string },
  canonicalInput: string,
  records?: IntentRecordCandidate[]
): {
  entityId?: string
  entityName?: string
  confidence?: number
  alternatives?: string[]
  ambiguityPanel?: AiAmbiguityPanelPayload
} {
  if (!records?.length || !intent.entity || intent.type === 'CREATE_RECORD' || !ACTIONABLE_INTENTS.includes(intent.type)) return {}

  const candidates = records.filter((record) => record.entity === intent.entity)
  if (!candidates.length) return {}

  const queryTokens = removeKnownOperationalWords(tokenize(canonicalInput), intent.language)
  if (!queryTokens.length) return {}

  const scored = candidates
    .map((record) => ({ record, score: scoreRecord(queryTokens, record) }))
    .filter((item) => item.score >= CONFIDENCE_FLOOR)
    .sort((a, b) => b.score - a.score || a.record.label.localeCompare(b.record.label))

  if (!scored.length) return {}

  const top = scored[0]
  const close = scored.filter((item) => top.score - item.score <= 0.08).slice(0, 5)
  if (close.length > 1) {
    const options = close.map((item) => ({
      id: item.record.id,
      label: item.record.label,
      details: item.record.details ?? item.record.entity,
    }))

    return {
      confidence: top.score,
      alternatives: close.map((item) => item.record.label),
      ambiguityPanel: {
        question: ambiguityQuestion(intent.language, intent.entity),
        options,
        intentType: intent.type,
        entity: intent.entity,
        rawInput: intent.rawInput,
        normalizedInput: intent.normalizedInput,
        language: intent.language,
      },
    }
  }

  return {
    entityId: top.record.id,
    entityName: top.record.label,
    confidence: top.score,
    alternatives: top.score < 0.85 ? scored.slice(1, 4).map((item) => item.record.label) : [],
  }
}

function ambiguityQuestion(language: AILanguage, entity: AIEntity) {
  const keys: Record<AIEntity, TranslationKey> = {
    invoice: 'ai.ambiguity.invoice',
    client: 'ai.ambiguity.client',
    campaign: 'ai.ambiguity.campaign',
    task: 'ai.ambiguity.task',
    brief: 'ai.ambiguity.brief',
    deliverable: 'ai.ambiguity.deliverable',
  }

  return getMessage(language, keys[entity])
}

function intentAlternatives(intentAlternatives: string[], entityAlternatives: AIEntity[], recordAlternatives?: string[]) {
  return [
    ...intentAlternatives,
    ...entityAlternatives,
    ...(recordAlternatives ?? []),
  ].filter(Boolean)
}

export function isDangerousIntent(type: IntentType): boolean {
  return DANGEROUS_INTENTS.includes(type)
}

export function resolveIntent(rawInput: string, context: IntentResolutionContext = {}): ResolvedIntent {
  const normalizedInput = normalizeInput(rawInput)
  const language = detectLanguage(normalizedInput)
  const expandedInput = expandAbbreviations(normalizedInput)
  const canonicalInput = canonicalizeInput(rawInput.trim().normalize('NFC').replace(/\s+/g, ' '))
  const tokens = tokenize(canonicalInput)
  const intent = classifyIntent(canonicalInput, tokens)
  const entity = classifyEntity(canonicalInput, tokens)
  const record = resolveRecord(
    {
      type: intent.type,
      entity: entity.entity,
      language,
      rawInput,
      normalizedInput,
    },
    canonicalInput,
    context.records
  )

  const hasEntity = Boolean(entity.entity)
  const confidence = clampConfidence(
    hasEntity
      ? intent.confidence * 0.68 + Math.max(entity.confidence, record.confidence ?? 0) * 0.32
      : intent.confidence
  )
  const type = confidence < CONFIDENCE_FLOOR ? 'UNKNOWN' : intent.type
  const alternatives = intentAlternatives(intent.alternatives, entity.alternatives, record.alternatives)
  const ambiguityPanel = record.ambiguityPanel

  return {
    type,
    entity: entity.entity,
    entityId: record.entityId,
    entityName: record.entityName,
    confidence,
    rawInput,
    normalizedInput,
    params: {
      expandedInput,
      canonicalInput,
      requiresConfirmation: isDangerousIntent(type),
    },
    language,
    ambiguous: Boolean(ambiguityPanel),
    alternatives: alternatives.length ? [...new Set(alternatives)] : confidence < 0.85 ? intent.alternatives : undefined,
    ambiguityPanel,
  }
}
