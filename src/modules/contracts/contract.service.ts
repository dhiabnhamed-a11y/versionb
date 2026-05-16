import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  normalizeContractCurrency,
  normalizeContractLanguage,
  safeContractText,
  serializeContract,
  type ContractContent,
  type ContractLanguage,
  type ContractSection,
} from '@/lib/contracts'
import { contractPdfChecksum, generateContractPdf } from '@/lib/contract-pdf'
import { logClientActivity } from '@/lib/clients'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { registerEnterpriseEventListeners } from '@/modules/events/listeners'
import { canManageWorkspace } from '@/modules/permissions/permissions'
import { badRequest, forbidden, notFound } from '@/modules/shared/errors'
import { toJsonValue } from '@/modules/shared/json'
import type { SessionUser } from '@/modules/shared/session'

registerEnterpriseEventListeners()

type ContractGenerationInput = {
  clientId?: unknown
  projectId?: unknown
  contractType?: unknown
  language?: unknown
  currency?: unknown
  governingLaw?: unknown
  jurisdiction?: unknown
  paymentFrequency?: unknown
  paymentTerms?: unknown
  confidentialityLevel?: unknown
  supportTerms?: unknown
  terminationNoticeDays?: unknown
  revisionLimit?: unknown
  ipOwnership?: unknown
  serviceScope?: unknown
  durationMonths?: unknown
  renewalTerms?: unknown
  riskProfile?: unknown
  effectiveDate?: unknown
  pricingStructure?: unknown
}

type ClauseText = {
  key: string
  category: string
  riskLevel?: string
  title: Record<'en' | 'fr' | 'ar', string>
  body: Record<'en' | 'fr' | 'ar', string[]>
}

type LoadedClient = NonNullable<Awaited<ReturnType<typeof loadClientContext>>>

const DEFAULT_DISCLAIMER =
  'This document is generated from verified workspace data and approved business clauses. It is not a substitute for advice from licensed legal counsel and should be reviewed before external signature.'

const CLAUSES: ClauseText[] = [
  {
    key: 'appointment',
    category: 'scope',
    title: {
      en: 'Appointment and Scope of Services',
      fr: 'Designation et portee des services',
      ar: 'التعيين ونطاق الخدمات',
    },
    body: {
      en: [
        '{{companyName}} is appointed to provide the services described in this Agreement for {{clientName}}. The services include {{serviceScope}}.',
        'Any material change to scope, timeline, deliverables, or commercial assumptions must be documented in writing and approved by authorized representatives of both parties.',
      ],
      fr: [
        '{{companyName}} est designee pour fournir a {{clientName}} les services decrits dans le present contrat. Les services comprennent {{serviceScope}}.',
        'Toute modification substantielle du perimetre, du calendrier, des livrables ou des hypotheses commerciales doit etre documentee par ecrit et approuvee par les representants autorises des deux parties.',
      ],
      ar: [
        'تقوم {{companyName}} بتقديم الخدمات الموضحة في هذه الاتفاقية لصالح {{clientName}}، وتشمل الخدمات {{serviceScope}}.',
        'يجب توثيق أي تغيير جوهري في النطاق أو الجدول الزمني أو المخرجات أو الافتراضات التجارية كتابة واعتماده من ممثلين مفوضين عن الطرفين.',
      ],
    },
  },
  {
    key: 'commercial_terms',
    category: 'payment',
    title: {
      en: 'Fees, Currency, and Payment Terms',
      fr: 'Honoraires, devise et conditions de paiement',
      ar: 'الأتعاب والعملة وشروط الدفع',
    },
    body: {
      en: [
        'Fees are payable in {{currency}} under the following structure: {{pricingStructure}}.',
        'Payment frequency is {{paymentFrequency}}. Unless otherwise stated, undisputed invoices are due according to the agreed payment terms: {{paymentTerms}}.',
      ],
      fr: [
        'Les honoraires sont payables en {{currency}} selon la structure suivante : {{pricingStructure}}.',
        'La frequence de paiement est {{paymentFrequency}}. Sauf disposition contraire, les factures non contestees sont exigibles selon les conditions convenues : {{paymentTerms}}.',
      ],
      ar: [
        'تدفع الأتعاب بعملة {{currency}} وفق الهيكل التالي: {{pricingStructure}}.',
        'تكون دورية الدفع {{paymentFrequency}}. وما لم يرد خلاف ذلك، تستحق الفواتير غير المتنازع عليها وفق شروط الدفع المتفق عليها: {{paymentTerms}}.',
      ],
    },
  },
  {
    key: 'deliverables_acceptance',
    category: 'delivery',
    title: {
      en: 'Deliverables, Review, and Acceptance',
      fr: 'Livrables, revue et acceptation',
      ar: 'المخرجات والمراجعة والقبول',
    },
    body: {
      en: [
        'Deliverables will be submitted through the operational workflow or another agreed channel. The client will review deliverables promptly and provide consolidated feedback.',
        'Unless a stricter approval process is agreed, deliverables are deemed accepted when approved in writing, used commercially, or not reasonably disputed within the review period.',
      ],
      fr: [
        'Les livrables seront transmis via le flux operationnel ou tout autre canal convenu. Le client les examinera sans delai excessif et transmettra des retours consolides.',
        'Sauf processus d approbation plus strict, les livrables sont reputes acceptes lorsqu ils sont approuves par ecrit, utilises commercialement, ou non contestes raisonnablement pendant la periode de revue.',
      ],
      ar: [
        'تسلم المخرجات عبر سير العمل التشغيلي أو أي قناة أخرى متفق عليها. يراجع العميل المخرجات دون تأخير غير مبرر ويقدم ملاحظات موحدة.',
        'ما لم يتم الاتفاق على عملية اعتماد أكثر صرامة، تعد المخرجات مقبولة عند اعتمادها كتابة أو استخدامها تجاريا أو عدم الاعتراض عليها بشكل معقول خلال فترة المراجعة.',
      ],
    },
  },
  {
    key: 'revisions',
    category: 'delivery',
    title: {
      en: 'Revision Limits',
      fr: 'Limites de revisions',
      ar: 'حدود التعديلات',
    },
    body: {
      en: [
        'The included revision allowance is {{revisionLimit}}. Revisions must relate to the approved scope and may not introduce materially new deliverables without a written change order.',
      ],
      fr: [
        'Le nombre de revisions incluses est {{revisionLimit}}. Les revisions doivent se rapporter au perimetre approuve et ne peuvent pas introduire de nouveaux livrables substantiels sans ordre de changement ecrit.',
      ],
      ar: [
        'عدد جولات التعديل المشمولة هو {{revisionLimit}}. يجب أن تكون التعديلات مرتبطة بالنطاق المعتمد ولا يجوز أن تضيف مخرجات جديدة جوهريا إلا بموجب أمر تغيير مكتوب.',
      ],
    },
  },
  {
    key: 'confidentiality',
    category: 'legal',
    riskLevel: 'high',
    title: {
      en: 'Confidentiality and Data Protection',
      fr: 'Confidentialite et protection des donnees',
      ar: 'السرية وحماية البيانات',
    },
    body: {
      en: [
        'Each party must protect non-public business, technical, financial, client, and operational information received from the other party using at least commercially reasonable safeguards.',
        'The confidentiality level for this engagement is {{confidentialityLevel}}. Confidential information may be used only to perform or receive services under this Agreement.',
      ],
      fr: [
        'Chaque partie doit proteger les informations non publiques commerciales, techniques, financieres, clients et operationnelles recues de l autre partie au moyen de mesures au moins commercialement raisonnables.',
        'Le niveau de confidentialite de cette mission est {{confidentialityLevel}}. Les informations confidentielles ne peuvent etre utilisees que pour executer ou recevoir les services prevus au contrat.',
      ],
      ar: [
        'يلتزم كل طرف بحماية المعلومات غير العامة التجارية والتقنية والمالية ومعلومات العملاء والمعلومات التشغيلية المستلمة من الطرف الآخر باستخدام ضمانات معقولة تجاريا على الأقل.',
        'مستوى السرية لهذه المهمة هو {{confidentialityLevel}}. لا يجوز استخدام المعلومات السرية إلا لأداء الخدمات أو تلقيها بموجب هذه الاتفاقية.',
      ],
    },
  },
  {
    key: 'intellectual_property',
    category: 'legal',
    riskLevel: 'high',
    title: {
      en: 'Intellectual Property Ownership',
      fr: 'Propriete intellectuelle',
      ar: 'ملكية حقوق الملكية الفكرية',
    },
    body: {
      en: [
        'Intellectual property ownership is allocated as follows: {{ipOwnership}}.',
        'Pre-existing materials, reusable know-how, software components, workflows, templates, and internal methods remain the property of the party that owned or developed them independently.',
      ],
      fr: [
        'La propriete intellectuelle est repartie comme suit : {{ipOwnership}}.',
        'Les elements preexistants, savoir-faire reutilisable, composants logiciels, flux de travail, modeles et methodes internes restent la propriete de la partie qui les detenait ou les a developpes de maniere independante.',
      ],
      ar: [
        'توزع ملكية حقوق الملكية الفكرية على النحو التالي: {{ipOwnership}}.',
        'تبقى المواد السابقة والمعرفة القابلة لإعادة الاستخدام ومكونات البرمجيات وسير العمل والقوالب والأساليب الداخلية ملكا للطرف الذي كان يملكها أو طورها بشكل مستقل.',
      ],
    },
  },
  {
    key: 'support_sla',
    category: 'operations',
    title: {
      en: 'Support and Service Levels',
      fr: 'Support et niveaux de service',
      ar: 'الدعم ومستويات الخدمة',
    },
    body: {
      en: [
        'Support terms are {{supportTerms}}. Response targets are operational commitments and do not guarantee resolution where dependencies, third-party platforms, or client approvals are outside {{companyName}} control.',
      ],
      fr: [
        'Les conditions de support sont les suivantes : {{supportTerms}}. Les delais de reponse sont des engagements operationnels et ne garantissent pas la resolution lorsque des dependances, plateformes tierces ou validations client echappent au controle de {{companyName}}.',
      ],
      ar: [
        'شروط الدعم هي: {{supportTerms}}. تعد أهداف الاستجابة التزامات تشغيلية ولا تضمن الحل عندما تكون التبعيات أو منصات الطرف الثالث أو موافقات العميل خارج سيطرة {{companyName}}.',
      ],
    },
  },
  {
    key: 'term_termination',
    category: 'legal',
    riskLevel: 'high',
    title: {
      en: 'Term, Renewal, and Termination',
      fr: 'Duree, renouvellement et resiliation',
      ar: 'المدة والتجديد والإنهاء',
    },
    body: {
      en: [
        'This Agreement begins on {{effectiveDate}} and continues until {{expiryDate}} unless terminated earlier in accordance with this section.',
        'Either party may terminate for convenience by giving {{terminationNoticeDays}} days written notice. Renewal terms: {{renewalTerms}}.',
      ],
      fr: [
        'Le present contrat commence le {{effectiveDate}} et se poursuit jusqu au {{expiryDate}}, sauf resiliation anticipee conformement a la presente clause.',
        'Chaque partie peut resilier pour convenance moyennant un preavis ecrit de {{terminationNoticeDays}} jours. Conditions de renouvellement : {{renewalTerms}}.',
      ],
      ar: [
        'تبدأ هذه الاتفاقية في {{effectiveDate}} وتستمر حتى {{expiryDate}} ما لم يتم إنهاؤها قبل ذلك وفقا لهذا البند.',
        'يجوز لأي طرف إنهاء الاتفاقية دون سبب بموجب إشعار كتابي قبل {{terminationNoticeDays}} يوما. شروط التجديد: {{renewalTerms}}.',
      ],
    },
  },
  {
    key: 'liability',
    category: 'legal',
    riskLevel: 'high',
    title: {
      en: 'Limitation of Liability',
      fr: 'Limitation de responsabilite',
      ar: 'تحديد المسؤولية',
    },
    body: {
      en: [
        'To the maximum extent permitted by applicable law, neither party will be liable for indirect, incidental, consequential, special, punitive, or loss-of-profit damages arising from this Agreement.',
        'Aggregate liability is limited to fees paid or payable for the services giving rise to the claim during the three months preceding the event, except for confidentiality breaches, payment obligations, willful misconduct, or liabilities that cannot be limited by law.',
      ],
      fr: [
        'Dans la limite permise par la loi applicable, aucune partie ne sera responsable des dommages indirects, incidents, consecutifs, speciaux, punitifs ou pertes de profits decoulant du present contrat.',
        'La responsabilite globale est limitee aux honoraires payes ou dus pour les services a l origine de la reclamation pendant les trois mois precedant l evenement, sauf violation de confidentialite, obligations de paiement, faute intentionnelle ou responsabilites non limitables par la loi.',
      ],
      ar: [
        'إلى أقصى حد يسمح به القانون المعمول به، لا يكون أي طرف مسؤولا عن الأضرار غير المباشرة أو العرضية أو التبعية أو الخاصة أو العقابية أو خسارة الأرباح الناشئة عن هذه الاتفاقية.',
        'تقتصر المسؤولية الإجمالية على الرسوم المدفوعة أو المستحقة عن الخدمات التي نشأت عنها المطالبة خلال الأشهر الثلاثة السابقة للحدث، باستثناء خرق السرية أو التزامات الدفع أو سوء السلوك المتعمد أو المسؤوليات التي لا يجوز تقييدها قانونا.',
      ],
    },
  },
  {
    key: 'force_majeure',
    category: 'legal',
    title: {
      en: 'Force Majeure',
      fr: 'Force majeure',
      ar: 'القوة القاهرة',
    },
    body: {
      en: [
        'Neither party is responsible for delay or failure caused by events beyond reasonable control, including natural disasters, war, labor disruptions, government action, platform outages, cyber incidents, or telecommunications failures.',
      ],
      fr: [
        'Aucune partie n est responsable d un retard ou manquement cause par des evenements echappant a son controle raisonnable, notamment catastrophe naturelle, guerre, conflit social, action gouvernementale, panne de plateforme, incident cyber ou defaillance telecommunication.',
      ],
      ar: [
        'لا يكون أي طرف مسؤولا عن التأخير أو الإخفاق الناتج عن أحداث خارجة عن السيطرة المعقولة، بما في ذلك الكوارث الطبيعية أو الحرب أو اضطرابات العمل أو الإجراءات الحكومية أو تعطل المنصات أو الحوادث السيبرانية أو أعطال الاتصالات.',
      ],
    },
  },
  {
    key: 'dispute_resolution',
    category: 'legal',
    riskLevel: 'high',
    title: {
      en: 'Governing Law and Dispute Resolution',
      fr: 'Droit applicable et resolution des litiges',
      ar: 'القانون الحاكم وتسوية المنازعات',
    },
    body: {
      en: [
        'This Agreement is governed by {{governingLaw}}. The parties will first attempt good-faith executive negotiation before initiating formal proceedings.',
        'If a dispute cannot be resolved informally, it will be submitted to the competent courts or dispute forum in {{jurisdiction}}, unless a mandatory law requires another forum.',
      ],
      fr: [
        'Le present contrat est regi par {{governingLaw}}. Les parties tenteront d abord une negociation de bonne foi au niveau executif avant toute procedure formelle.',
        'Si un litige ne peut etre resolu amiablement, il sera soumis aux tribunaux competents ou au forum de resolution de {{jurisdiction}}, sauf loi imperativement applicable imposant un autre forum.',
      ],
      ar: [
        'تخضع هذه الاتفاقية إلى {{governingLaw}}. يسعى الطرفان أولا إلى التفاوض التنفيذي بحسن نية قبل بدء أي إجراءات رسمية.',
        'إذا تعذر حل النزاع وديا، يحال إلى المحاكم المختصة أو جهة تسوية المنازعات في {{jurisdiction}}، ما لم يفرض قانون إلزامي جهة أخرى.',
      ],
    },
  },
  {
    key: 'signatures',
    category: 'execution',
    title: {
      en: 'Execution and Electronic Signature Readiness',
      fr: 'Execution et preparation a la signature electronique',
      ar: 'التنفيذ والجاهزية للتوقيع الإلكتروني',
    },
    body: {
      en: [
        'This Agreement may be executed in counterparts and by electronic signature where permitted by applicable law. TASKIT may preserve document history, generated versions, signature timestamps, download events, and approval records for auditability.',
      ],
      fr: [
        'Le present contrat peut etre signe en plusieurs exemplaires et par signature electronique lorsque la loi applicable l autorise. TASKIT peut conserver l historique du document, les versions generees, horodatages de signature, telechargements et validations a des fins d audit.',
      ],
      ar: [
        'يجوز تنفيذ هذه الاتفاقية على نسخ متقابلة وبالتوقيع الإلكتروني حيث يسمح القانون المعمول به. يجوز لـ TASKIT حفظ سجل المستند والنسخ المنشأة وطوابع توقيت التوقيع وأحداث التنزيل وسجلات الاعتماد لأغراض التدقيق.',
      ],
    },
  },
]

function requireCompany(user: SessionUser) {
  if (!user.companyId) throw badRequest('No company found for this account')
  return user.companyId
}

function assertContractAccess(user: SessionUser) {
  if (!canManageWorkspace(user)) throw forbidden()
}

function asText(value: unknown, fallback = '') {
  return safeContractText(value, fallback)
}

function asInt(value: unknown, fallback: number, min = 0, max = 120) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? Math.min(Math.max(Math.round(number), min), max) : fallback
}

function parseDate(value: unknown, fallback: Date | null = null) {
  if (!value) return fallback
  const date = value instanceof Date ? value : new Date(String(value))
  if (!Number.isFinite(date.getTime())) throw badRequest('Invalid contract date value.')
  return date
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function localeKey(language: ContractLanguage): 'en' | 'fr' | 'ar' {
  if (language === 'fr') return 'fr'
  if (language === 'ar') return 'ar'
  return 'en'
}

function bilingualKey(language: ContractLanguage): 'fr' | 'ar' | null {
  if (language === 'bilingual_en_fr') return 'fr'
  if (language === 'bilingual_en_ar') return 'ar'
  return null
}

function formatDateForContent(date: Date | null, language: ContractLanguage) {
  if (!date) return 'to be confirmed'
  const locale = language === 'ar' || language === 'bilingual_en_ar' ? 'ar-TN' : language === 'fr' || language === 'bilingual_en_fr' ? 'fr-FR' : 'en-US'
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

function interpolate(value: string, variables: Record<string, string>) {
  return value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key: string) => variables[key] ?? '')
}

function buildMissingFields(input: {
  governingLaw: string
  paymentFrequency: string
  confidentialityLevel: string
  supportTerms: string
  terminationNoticeDays: number
  revisionLimit: string
  ipOwnership: string
}) {
  const missing: string[] = []
  if (!input.governingLaw) missing.push('governingLaw')
  if (!input.paymentFrequency) missing.push('paymentFrequency')
  if (!input.confidentialityLevel) missing.push('confidentialityLevel')
  if (!input.supportTerms) missing.push('supportTerms')
  if (!input.terminationNoticeDays) missing.push('terminationNoticeDays')
  if (!input.revisionLimit) missing.push('revisionLimit')
  if (!input.ipOwnership) missing.push('ipOwnership')
  return missing
}

async function nextContractNumber(companyId: string) {
  const year = new Date().getFullYear()
  const prefix = `CON-${year}-`
  const count = await prisma.contract.count({
    where: {
      companyId,
      contractNumber: { startsWith: prefix },
    },
  })
  return `${prefix}${String(count + 1).padStart(4, '0')}`
}

async function loadClientContext(companyId: string, clientId: string, projectId?: string | null) {
  return prisma.client.findFirst({
    where: { id: clientId, companyId },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          country: true,
          registrationNumber: true,
          settings: { select: { primaryColor: true } },
          owner: { select: { name: true, email: true } },
        },
      },
      projects: {
        where: projectId ? { id: projectId, companyId } : { companyId },
        orderBy: { updatedAt: 'desc' },
        take: projectId ? 1 : 4,
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          tasks: { select: { id: true, title: true, stage: true } },
          briefs: { select: { id: true, title: true, description: true, objectives: true } },
          deliverables: { select: { id: true, title: true, type: true, status: true, revisionCount: true } },
        },
      },
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          status: true,
          currency: true,
          total: true,
          dueDate: true,
          items: { select: { description: true, quantity: true, unitPrice: true, lineTotal: true } },
        },
      },
    },
  })
}

function inferServiceScope(client: LoadedClient, rawScope: string) {
  if (rawScope) return rawScope
  const projectLines = client.projects.map((project) => {
    const deliverables = project.deliverables.map((deliverable) => deliverable.title).filter(Boolean).slice(0, 4)
    return [project.title, deliverables.length ? `deliverables: ${deliverables.join(', ')}` : null].filter(Boolean).join(' - ')
  })
  if (projectLines.length) return projectLines.join('; ')
  const invoiceItems = client.invoices.flatMap((invoice) => invoice.items.map((item) => item.description)).filter(Boolean).slice(0, 6)
  return invoiceItems.length ? invoiceItems.join('; ') : 'professional services, operational deliverables, and client support managed in TASKIT'
}

function inferPricingStructure(client: LoadedClient, rawPricing: string) {
  if (rawPricing) return rawPricing
  const latestInvoice = client.invoices[0]
  if (!latestInvoice) return 'fees to be agreed in approved statements of work, invoices, or written orders'
  const total = Number(latestInvoice.total)
  return Number.isFinite(total) && total > 0
    ? `commercial pricing aligned with recent billing records; latest recorded invoice value is ${total.toFixed(2)} ${latestInvoice.currency}`
    : 'fees to be confirmed in approved invoices or statements of work'
}

function buildContent(input: {
  client: LoadedClient
  contractNumber: string
  contractType: string
  language: ContractLanguage
  currency: string
  governingLaw: string
  jurisdiction: string
  paymentFrequency: string
  paymentTerms: string
  confidentialityLevel: string
  supportTerms: string
  terminationNoticeDays: number
  revisionLimit: string
  ipOwnership: string
  serviceScope: string
  renewalTerms: string
  riskProfile: string
  effectiveDate: Date
  expiryDate: Date
  pricingStructure: string
  missingFields: string[]
}): ContractContent {
  const { client, language } = input
  const primary = localeKey(language)
  const secondary = bilingualKey(language)
  const project = client.projects[0] ?? null
  const openInvoices = client.invoices.filter((invoice) => ['sent', 'overdue', 'viewed', 'partially_paid', 'disputed', 'escalated'].includes(invoice.status))
  const openInvoiceTotal = openInvoices.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0)
  const estimatedValue = client.invoices.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0) || null
  const variables = {
    clientName: client.companyName,
    companyName: client.company.name,
    currency: input.currency,
    serviceScope: input.serviceScope,
    pricingStructure: input.pricingStructure,
    paymentFrequency: input.paymentFrequency || 'to be confirmed',
    paymentTerms: input.paymentTerms || 'to be confirmed',
    confidentialityLevel: input.confidentialityLevel || 'standard',
    supportTerms: input.supportTerms || 'business-hours support unless otherwise agreed',
    revisionLimit: input.revisionLimit || 'two consolidated revision rounds',
    ipOwnership: input.ipOwnership || 'client owns final paid deliverables; provider retains pre-existing tools and methods',
    terminationNoticeDays: String(input.terminationNoticeDays || 30),
    renewalTerms: input.renewalTerms || 'renewal requires written approval by both parties',
    governingLaw: input.governingLaw || input.jurisdiction || 'the governing law selected by the parties',
    jurisdiction: input.jurisdiction || 'the agreed competent forum',
    effectiveDate: formatDateForContent(input.effectiveDate, language),
    expiryDate: formatDateForContent(input.expiryDate, language),
  }

  const sections: ContractSection[] = CLAUSES.map((clause, index) => ({
    id: clause.key,
    number: String(index + 1),
    title: clause.title[primary],
    body: clause.body[primary].map((paragraph) => interpolate(paragraph, variables)),
    category: clause.category,
    riskLevel: clause.riskLevel ?? input.riskProfile,
    bilingualTitle: secondary ? clause.title[secondary] : undefined,
    bilingualBody: secondary ? clause.body[secondary].map((paragraph) => interpolate(paragraph, variables)) : undefined,
  }))

  const titleByLocale = {
    en: 'Professional Service Agreement',
    fr: 'Contrat de services professionnels',
    ar: 'اتفاقية خدمات مهنية',
  }
  const subtitleByLocale = {
    en: `Prepared for ${client.companyName} using TASKIT operational, client, and billing data.`,
    fr: `Prepare pour ${client.companyName} a partir des donnees operationnelles, client et facturation de TASKIT.`,
    ar: `تم إعدادها لصالح ${client.companyName} باستخدام بيانات التشغيل والعملاء والفوترة في TASKIT.`,
  }

  return {
    title: titleByLocale[primary],
    subtitle: subtitleByLocale[primary],
    contractNumber: input.contractNumber,
    language,
    type: input.contractType,
    status: 'draft',
    currency: input.currency,
    jurisdiction: input.jurisdiction || null,
    governingLaw: input.governingLaw || null,
    effectiveDate: input.effectiveDate.toISOString(),
    expiryDate: input.expiryDate.toISOString(),
    renewalTerms: input.renewalTerms || null,
    paymentTerms: input.paymentTerms || null,
    paymentFrequency: input.paymentFrequency || null,
    serviceScope: input.serviceScope,
    legalDisclaimer: DEFAULT_DISCLAIMER,
    watermark: 'DRAFT',
    company: {
      name: client.company.name,
      contactName: client.company.owner?.name ?? null,
      email: client.company.owner?.email ?? null,
      country: client.company.country ?? null,
      taxId: client.company.registrationNumber ?? null,
    },
    client: {
      name: client.companyName,
      contactName: client.contactPerson,
      email: client.email,
      address: client.address,
      country: client.country,
      taxId: null,
    },
    project: project ? { title: project.title, description: project.description } : null,
    financials: {
      currency: input.currency,
      estimatedValue,
      openInvoiceTotal,
      openInvoiceCount: openInvoices.length,
    },
    tableOfContents: sections.map((section) => ({ number: section.number, title: section.title })),
    sections,
    signatureBlocks: [
      {
        role: 'Service provider',
        partyName: client.company.name,
        signerName: client.company.owner?.name ?? null,
        signerEmail: client.company.owner?.email ?? null,
      },
      {
        role: 'Client',
        partyName: client.companyName,
        signerName: client.contactPerson,
        signerEmail: client.email,
      },
    ],
    aiSummary:
      secondary === 'fr'
        ? 'TASKIT prepared a bilingual English/French contract optimized for structured professional services and recurring commercial governance.'
        : secondary === 'ar'
          ? 'TASKIT prepared a bilingual English/Arabic contract with RTL-ready legal structure and signature audit readiness.'
          : `TASKIT prepared a professionally structured ${primary === 'fr' ? 'French' : primary === 'ar' ? 'Arabic' : 'English'} service agreement using operational and billing data.`,
    missingFields: input.missingFields,
    generatedAt: new Date().toISOString(),
  }
}

export async function listClientContracts(user: SessionUser, clientId: string) {
  const companyId = requireCompany(user)
  assertContractAccess(user)

  const client = await prisma.client.findFirst({ where: { id: clientId, companyId }, select: { id: true } })
  if (!client) throw notFound('Client not found.')

  const contracts = await prisma.contract.findMany({
    where: { companyId, clientId },
    orderBy: { updatedAt: 'desc' },
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 3,
        select: { id: true, versionNumber: true, status: true, locale: true, title: true, pdfByteLength: true, createdAt: true },
      },
      signatures: {
        orderBy: [{ signingOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, signerType: true, signerName: true, signerEmail: true, status: true, method: true, signedAt: true, createdAt: true },
      },
    },
  })

  return contracts.map((contract) => serializeContract(contract as unknown as Record<string, unknown>))
}

export async function generateContractForClient(user: SessionUser, rawInput: ContractGenerationInput, requestId?: string) {
  const companyId = requireCompany(user)
  assertContractAccess(user)

  const clientId = asText(rawInput.clientId)
  if (!clientId) throw badRequest('Client id is required.')

  const projectId = asText(rawInput.projectId) || null
  const client = await loadClientContext(companyId, clientId, projectId)
  if (!client) throw notFound('Client not found.')
  if (projectId && !client.projects.some((project) => project.id === projectId)) throw badRequest('Selected project was not found for this client.')

  const language = normalizeContractLanguage(rawInput.language)
  const currency = normalizeContractCurrency(rawInput.currency ?? client.invoices[0]?.currency)
  const durationMonths = asInt(rawInput.durationMonths, 12, 1, 120)
  const effectiveDate = parseDate(rawInput.effectiveDate, new Date()) ?? new Date()
  const expiryDate = addMonths(effectiveDate, durationMonths)
  const terminationNoticeDays = asInt(rawInput.terminationNoticeDays, 30, 0, 365)
  const contractType = asText(rawInput.contractType, 'SERVICE_AGREEMENT').toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  const jurisdiction = asText(rawInput.jurisdiction, client.country ?? client.company.country ?? '')
  const governingLaw = asText(rawInput.governingLaw, jurisdiction ? `${jurisdiction} law` : '')
  const paymentFrequency = asText(rawInput.paymentFrequency, client.invoices.length > 1 ? 'monthly or per approved invoice' : '')
  const paymentTerms = asText(rawInput.paymentTerms, 'Net 15 days from valid invoice unless otherwise agreed')
  const confidentialityLevel = asText(rawInput.confidentialityLevel, 'standard')
  const supportTerms = asText(rawInput.supportTerms, 'business-hours support with priority handling for production-blocking issues')
  const revisionLimit = asText(rawInput.revisionLimit, 'two consolidated revision rounds per deliverable')
  const ipOwnership = asText(rawInput.ipOwnership, 'client owns final paid deliverables; provider retains pre-existing tools, systems, reusable know-how, and templates')
  const serviceScope = inferServiceScope(client, asText(rawInput.serviceScope))
  const renewalTerms = asText(rawInput.renewalTerms, 'renewal by mutual written agreement before the expiry date')
  const pricingStructure = inferPricingStructure(client, asText(rawInput.pricingStructure))
  const riskProfile = asText(rawInput.riskProfile, confidentialityLevel === 'strict' ? 'elevated' : 'standard')
  const missingFields = buildMissingFields({
    governingLaw,
    paymentFrequency,
    confidentialityLevel,
    supportTerms,
    terminationNoticeDays,
    revisionLimit,
    ipOwnership,
  })

  const job = await prisma.contractGenerationJob.create({
    data: {
      companyId,
      clientId,
      actorId: user.id,
      status: 'collecting_data',
      contractType,
      language,
      riskProfile,
      input: toJsonValue(rawInput),
      missingFields: toJsonValue(missingFields),
      startedAt: new Date(),
    },
  })

  try {
    const contractNumber = await nextContractNumber(companyId)
    const content = buildContent({
      client,
      contractNumber,
      contractType,
      language,
      currency,
      governingLaw,
      jurisdiction,
      paymentFrequency,
      paymentTerms,
      confidentialityLevel,
      supportTerms,
      terminationNoticeDays,
      revisionLimit,
      ipOwnership,
      serviceScope,
      renewalTerms,
      riskProfile,
      effectiveDate,
      expiryDate,
      pricingStructure,
      missingFields,
    })

    await prisma.contractGenerationJob.update({
      where: { id: job.id },
      data: { status: 'rendering_pdf', attempts: { increment: 1 } },
    })
    const pdf = await generateContractPdf(content, {
      requestId,
      contractNumber,
      startedAt: Date.now(),
    })
    const checksum = contractPdfChecksum(pdf)

    const contract = await prisma.$transaction(async (tx) => {
      const created = await tx.contract.create({
        data: {
          companyId,
          clientId,
          projectId,
          createdById: user.id,
          contractNumber,
          title: content.title,
          type: contractType,
          status: 'draft',
          language,
          currency,
          jurisdiction: jurisdiction || null,
          governingLaw: governingLaw || null,
          confidentialityLevel,
          riskProfile,
          currentVersionNumber: 1,
          effectiveDate,
          expiryDate,
          renewalDate: expiryDate,
          metadata: toJsonValue({
            aiSummary: content.aiSummary,
            serviceScope,
            paymentTerms,
            paymentFrequency,
            supportTerms,
            revisionLimit,
            ipOwnership,
          }),
        },
      })

      const version = await tx.contractVersion.create({
        data: {
          companyId,
          contractId: created.id,
          createdById: user.id,
          versionNumber: 1,
          status: 'generated',
          locale: language,
          title: content.title,
          content: toJsonValue(content) ?? Prisma.JsonNull,
          renderedSnapshot: toJsonValue({
            engine: '@react-pdf/renderer',
            renderer: 'TASKIT ContractDocument',
            deterministic: true,
          }),
          dataSnapshot: toJsonValue({
            clientId,
            projectId,
            invoiceCount: client.invoices.length,
            projectCount: client.projects.length,
          }),
          clauseSnapshot: toJsonValue(content.sections.map((section) => ({ id: section.id, title: section.title, riskLevel: section.riskLevel }))),
          pdfChecksum: checksum,
          pdfByteLength: pdf.byteLength,
          model: 'taskit-contract-intelligence',
          promptVersion: 'contract-v1',
          legalDisclaimer: content.legalDisclaimer,
          watermark: content.watermark,
          immutable: true,
        },
      })

      await tx.contractSignature.createMany({
        data: content.signatureBlocks.map((signature, index) => ({
          companyId,
          contractId: created.id,
          versionId: version.id,
          clientId: index === 1 ? clientId : null,
          signerType: index === 0 ? 'company' : 'client',
          signerName: signature.signerName || signature.partyName,
          signerEmail: signature.signerEmail || null,
          status: 'pending',
          method: 'prepared',
          signingOrder: index + 1,
        })),
      })

      await tx.contractAuditLog.create({
        data: {
          companyId,
          contractId: created.id,
          versionId: version.id,
          actorId: user.id,
          action: 'contract.generated',
          after: toJsonValue({ contractNumber, versionNumber: 1, missingFields }),
          metadata: toJsonValue({ requestId, checksum, pdfByteLength: pdf.byteLength, language }),
          requestId,
        },
      })

      await tx.contractGenerationJob.update({
        where: { id: job.id },
        data: {
          contractId: created.id,
          status: 'completed',
          result: toJsonValue({ contractId: created.id, versionId: version.id, contractNumber, pdfByteLength: pdf.byteLength, checksum }),
          completedAt: new Date(),
        },
      })

      return tx.contract.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 3,
            select: { id: true, versionNumber: true, status: true, locale: true, title: true, pdfByteLength: true, createdAt: true },
          },
          signatures: {
            orderBy: [{ signingOrder: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, signerType: true, signerName: true, signerEmail: true, status: true, method: true, signedAt: true, createdAt: true },
          },
        },
      })
    })

    const serialized = serializeContract(contract as unknown as Record<string, unknown>)
    await logClientActivity({
      companyId,
      clientId,
      actorId: user.id,
      type: 'contract.generated',
      title: 'Enterprise contract generated',
      body: `${contract.contractNumber} was generated with ${content.sections.length} structured clauses and ${language} language settings.`,
      metadata: toJsonValue({ contractId: contract.id, contractNumber, language, missingFields }),
    })
    await publishDomainEvent({
      type: 'contract.generated',
      companyId,
      actorId: user.id,
      entityType: 'contract',
      entityId: contract.id,
      action: `Contract ${contract.contractNumber} generated`,
      payload: { contract: serialized },
      after: serialized,
    })

    return {
      contract: serialized,
      jobId: job.id,
      missingFields,
      aiMessage:
        language === 'bilingual_en_fr'
          ? 'I prepared a bilingual English/French contract optimized for recurring professional services and client approval workflows.'
          : language === 'bilingual_en_ar'
            ? 'I prepared a bilingual English/Arabic contract with RTL-ready structure, signature blocks, and audit-ready legal sections.'
            : 'I generated a professionally structured service agreement for this client using your operational and billing data.',
    }
  } catch (error) {
    await prisma.contractGenerationJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      },
    })
    throw error
  }
}

export async function getContractVersionContent(user: SessionUser, contractId: string, versionId?: string | null) {
  const companyId = requireCompany(user)
  assertContractAccess(user)

  const contract = await prisma.contract.findFirst({ where: { id: contractId, companyId } })
  if (!contract) throw notFound('Contract not found.')

  const version = versionId
    ? await prisma.contractVersion.findFirst({ where: { id: versionId, contractId, companyId } })
    : await prisma.contractVersion.findFirst({ where: { contractId, companyId, versionNumber: contract.currentVersionNumber } })

  if (!version) throw notFound('Contract version not found.')
  return { contract, version, content: version.content as unknown as ContractContent }
}

export async function recordContractDownload(user: SessionUser, input: { contractId: string; versionId: string; requestId?: string; byteLength?: number }) {
  const companyId = requireCompany(user)
  assertContractAccess(user)
  await prisma.contractAuditLog.create({
    data: {
      companyId,
      contractId: input.contractId,
      versionId: input.versionId,
      actorId: user.id,
      action: 'contract.pdf_downloaded',
      metadata: toJsonValue({ requestId: input.requestId, byteLength: input.byteLength }),
      requestId: input.requestId,
    },
  })
}
