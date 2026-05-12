'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronLeft,
  ChevronUp,
  ClipboardList,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { AmbiguityPanel } from '@/components/dashboard/AmbiguityPanel'
import { useLocale } from '@/components/i18n/LocaleProvider'
import { isAgencyCompanyType } from '@/lib/company-types'
import type { AiAmbiguityOption, AiAmbiguityPanelPayload } from '@/lib/ai-intent'
import type { AppLocale } from '@/lib/i18n'

type AssistantMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Array<{
    id: string
    type: string
    label: string
    href?: string
  }>
  quickActions?: string[]
  model?: string
  ambiguity?: AiAmbiguityPanelPayload | null
}

type AssistantResponse = {
  id: string
  conversationId?: string | null
  answer: string
  intent?: string
  citations: AssistantMessage['citations']
  quickActions: string[]
  policy: {
    role: string
    scope: string
    financeVisible: boolean
  }
  model: string
  usedModel: boolean
  language?: AppLocale
  dir?: 'ltr' | 'rtl'
  ambiguity?: AiAmbiguityPanelPayload | null
  memory?: {
    available: boolean
    recalled: number
    remembered: number
    notes: string[]
  }
}

type WorkflowKind = 'campaign' | 'brief' | 'invoice' | 'client'

type WorkflowStep = {
  id: string
  label: string
  placeholder: string
  optional?: boolean
  multiline?: boolean
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  defaultValue?: string
  optionSource?: WorkflowOptionSource
  emptyLabel?: string
}

type WorkflowDefinition = {
  title: string
  intro: string
  nextLabel: string
  createLabel: string
  skipLabel: string
  backLabel: string
  cancelLabel: string
  optionalLabel: string
  cancelled: string
  steps: WorkflowStep[]
}

type ActiveWorkflow = {
  kind: WorkflowKind
  stepIndex: number
  values: Record<string, string>
}

type WorkflowOptionSource = 'clients' | 'campaigns' | 'categories' | 'managers' | 'rooms' | 'currencies' | 'invoiceLocales' | 'clientStatuses'

type WorkflowOption = {
  value: string
  label: string
  description?: string | null
  clientId?: string | null
  clientName?: string | null
}

type WorkflowContext = {
  companyType: string
  canManageWorkspace: boolean
  canManageFinance: boolean
  clients: WorkflowOption[]
  campaigns: WorkflowOption[]
  categories: WorkflowOption[]
  managers: WorkflowOption[]
  rooms: WorkflowOption[]
  currencies: WorkflowOption[]
  invoiceLocales: WorkflowOption[]
  clientStatuses: WorkflowOption[]
}

const starterPrompts = [
  'What should management focus on today?',
  'What is blocking the launch?',
  'Analyze delayed projects',
  'Find overdue invoices',
  'Analyze team workload',
  'What do you remember about our risks?',
  'Create client',
  'Create campaign',
  'Create brief',
  'Create invoice',
  'Mark invoice paid',
  'Delete record',
  'Send payment deadline alerts',
  'Summarize pending approvals',
  'Which clients need follow-up?',
]

const quickActionLabels: Record<AppLocale, Record<string, string>> = {
  en: {},
  fr: {
    'What should management focus on today?': 'Que doit prioriser la direction ?',
    'What is blocking the launch?': 'Qu’est-ce qui bloque le lancement ?',
    'Analyze delayed projects': 'Analyser les projets en retard',
    'Find overdue invoices': 'Trouver les factures en retard',
    'Analyze team workload': 'Analyser la charge équipe',
    'What do you remember about our risks?': 'Que mémorises-tu sur nos risques ?',
    'Create client': 'Créer un client',
    'Create campaign': 'Créer une campagne',
    'Create brief': 'Créer un brief',
    'Create invoice': 'Créer une facture',
    'Mark invoice paid': 'Marquer une facture payée',
    'Delete record': 'Supprimer un élément',
    'Send payment deadline alerts': 'Envoyer les alertes paiement',
    'Summarize pending approvals': 'Résumer les approbations',
    'Which clients need follow-up?': 'Quels clients relancer ?',
    'Create brief for this campaign': 'Créer un brief pour cette campagne',
    'Generate invoice draft': 'Générer une facture brouillon',
    'Generate weekly report': 'Générer le rapport hebdomadaire',
    'Detect operational risks': 'Détecter les risques opérationnels',
    'Show overdue tasks': 'Afficher les tâches en retard',
    'Generate executive summary': 'Générer un résumé exécutif',
    'Create automation from instruction': 'Créer une automatisation',
    'Summarize client activity': 'Résumer l’activité client',
    'Generate client report': 'Générer un rapport client',
  },
  ar: {
    'What should management focus on today?': 'ما أولوية الإدارة اليوم؟',
    'What is blocking the launch?': 'ما الذي يعيق الإطلاق؟',
    'Analyze delayed projects': 'حلل المشاريع المتأخرة',
    'Find overdue invoices': 'اعثر على الفواتير المتأخرة',
    'Analyze team workload': 'حلل عبء عمل الفريق',
    'What do you remember about our risks?': 'ماذا تتذكر عن مخاطرنا؟',
    'Create client': 'إنشاء عميل',
    'Create campaign': 'إنشاء حملة',
    'Create brief': 'إنشاء بريف',
    'Create invoice': 'إنشاء فاتورة',
    'Mark invoice paid': 'تحديد فاتورة كمدفوعة',
    'Delete record': 'حذف عنصر',
    'Send payment deadline alerts': 'إرسال تنبيهات الدفع',
    'Summarize pending approvals': 'لخص الموافقات المعلقة',
    'Which clients need follow-up?': 'أي العملاء يحتاجون متابعة؟',
    'Create brief for this campaign': 'إنشاء بريف لهذه الحملة',
    'Generate invoice draft': 'إنشاء مسودة فاتورة',
    'Generate weekly report': 'إنشاء التقرير الأسبوعي',
    'Detect operational risks': 'اكتشاف المخاطر التشغيلية',
    'Show overdue tasks': 'عرض المهام المتأخرة',
    'Generate executive summary': 'إنشاء ملخص تنفيذي',
    'Create automation from instruction': 'إنشاء أتمتة من التعليمات',
    'Summarize client activity': 'تلخيص نشاط العميل',
    'Generate client report': 'إنشاء تقرير عميل',
  },
}

const workflowDefinitions: Record<AppLocale, Record<WorkflowKind, WorkflowDefinition>> = {
  en: {
    campaign: {
      title: 'Campaign setup',
      intro: '**Campaign Creation**\nI’ll collect the required fields one by one, then create the campaign and starter brief in your workspace.',
      nextLabel: 'Next',
      createLabel: 'Create campaign',
      skipLabel: 'Skip',
      backLabel: 'Back',
      cancelLabel: 'Cancel',
      optionalLabel: 'Optional',
      cancelled: '**Creation Cancelled**\nThe guided creation flow was cancelled.',
      steps: [
        { id: 'campaignName', label: 'Campaign name', placeholder: 'Example: Ramadan Launch 2026' },
        { id: 'clientId', label: 'Client account', placeholder: 'Select a client...', optionSource: 'clients', emptyLabel: 'No clients yet. Create a client first.' },
        { id: 'categoryId', label: 'Category', placeholder: 'Select a category...', optionSource: 'categories', emptyLabel: 'No categories yet. Create a campaign category first.' },
        { id: 'managerId', label: 'Manager', placeholder: 'Current user', optional: true, optionSource: 'managers' },
        { id: 'description', label: 'Campaign description', placeholder: 'Goal, scope, channels, or notes', optional: true, multiline: true },
      ],
    },
    brief: {
      title: 'Brief setup',
      intro: '**Brief Creation**\nI’ll collect the campaign, title, and direction, then create a draft brief for review.',
      nextLabel: 'Next',
      createLabel: 'Create brief',
      skipLabel: 'Skip',
      backLabel: 'Back',
      cancelLabel: 'Cancel',
      optionalLabel: 'Optional',
      cancelled: '**Creation Cancelled**\nThe guided creation flow was cancelled.',
      steps: [
        { id: 'campaignId', label: 'Campaign', placeholder: 'Select a campaign...', optionSource: 'campaigns', emptyLabel: 'No campaigns found. Create a campaign first.' },
        { id: 'briefTitle', label: 'Brief title', placeholder: 'Example: Launch video brief' },
        { id: 'description', label: 'Brief details', placeholder: 'Objectives, audience, deliverables, constraints', optional: true, multiline: true },
      ],
    },
    invoice: {
      title: 'Invoice setup',
      intro: '**Invoice Creation**\nI’ll collect client, amount, currency, line item, and due date, then create a draft invoice.',
      nextLabel: 'Next',
      createLabel: 'Create invoice',
      skipLabel: 'Skip',
      backLabel: 'Back',
      cancelLabel: 'Cancel',
      optionalLabel: 'Optional',
      cancelled: '**Creation Cancelled**\nThe guided creation flow was cancelled.',
      steps: [
        { id: 'clientId', label: 'Client account', placeholder: 'Select a client...', optionSource: 'clients', emptyLabel: 'No clients found. Create a client first.' },
        { id: 'campaignId', label: 'Campaign', placeholder: 'Optional campaign link', optional: true, optionSource: 'campaigns' },
        { id: 'amount', label: 'Amount', placeholder: '1200', inputMode: 'decimal' },
        { id: 'currency', label: 'Currency', placeholder: 'USD, EUR, TND...', defaultValue: 'USD', optionSource: 'currencies' },
        { id: 'invoiceLocale', label: 'Invoice language', placeholder: 'English', defaultValue: 'en', optionSource: 'invoiceLocales' },
        { id: 'lineItem', label: 'Line item', placeholder: 'Example: Social media campaign management' },
        { id: 'dueDate', label: 'Due date', placeholder: 'YYYY-MM-DD, or leave blank', optional: true },
        { id: 'notes', label: 'Invoice notes', placeholder: 'Payment terms or client note', optional: true, multiline: true },
      ],
    },
    client: {
      title: 'Client setup',
      intro: '**Client Creation**\nI’ll collect the profile fields one by one, then create the client record.',
      nextLabel: 'Next',
      createLabel: 'Create client',
      skipLabel: 'Skip',
      backLabel: 'Back',
      cancelLabel: 'Cancel',
      optionalLabel: 'Optional',
      cancelled: '**Creation Cancelled**\nThe guided creation flow was cancelled.',
      steps: [
        { id: 'companyName', label: 'Company name', placeholder: 'Example: Acme Studio' },
        { id: 'contactPerson', label: 'Contact person', placeholder: 'Main contact name', optional: true },
        { id: 'email', label: 'Email', placeholder: 'client@example.com', optional: true, inputMode: 'email' },
        { id: 'phone', label: 'Phone', placeholder: '+216 ...', optional: true, inputMode: 'tel' },
        { id: 'country', label: 'Country', placeholder: 'Tunisia, France, UAE...', optional: true },
        { id: 'status', label: 'Status', placeholder: 'Active', defaultValue: 'active', optionSource: 'clientStatuses' },
        { id: 'address', label: 'Address', placeholder: 'Billing or office address', optional: true },
        { id: 'notes', label: 'Notes', placeholder: 'Relationship context, billing terms, preferences', optional: true, multiline: true },
      ],
    },
  },
  fr: {
    campaign: {
      title: 'Création campagne',
      intro: '**Création de campagne**\nJe vais demander les champs nécessaires un par un, puis créer la campagne et le brief de départ.',
      nextLabel: 'Suivant',
      createLabel: 'Créer campagne',
      skipLabel: 'Ignorer',
      backLabel: 'Retour',
      cancelLabel: 'Annuler',
      optionalLabel: 'Optionnel',
      cancelled: '**Création annulée**\nLe flux guidé a été annulé.',
      steps: [
        { id: 'campaignName', label: 'Nom de la campagne', placeholder: 'Exemple : Lancement Ramadan 2026' },
        { id: 'clientId', label: 'Compte client', placeholder: 'Sélectionner un client...', optionSource: 'clients', emptyLabel: 'Aucun client. Créez d’abord un client.' },
        { id: 'categoryId', label: 'Catégorie', placeholder: 'Sélectionner une catégorie...', optionSource: 'categories', emptyLabel: 'Aucune catégorie. Créez d’abord une catégorie.' },
        { id: 'managerId', label: 'Manager', placeholder: 'Utilisateur actuel', optional: true, optionSource: 'managers' },
        { id: 'description', label: 'Description', placeholder: 'Objectif, périmètre, canaux ou notes', optional: true, multiline: true },
      ],
    },
    brief: {
      title: 'Création brief',
      intro: '**Création de brief**\nJe vais collecter la campagne, le titre et la direction, puis créer un brouillon.',
      nextLabel: 'Suivant',
      createLabel: 'Créer brief',
      skipLabel: 'Ignorer',
      backLabel: 'Retour',
      cancelLabel: 'Annuler',
      optionalLabel: 'Optionnel',
      cancelled: '**Création annulée**\nLe flux guidé a été annulé.',
      steps: [
        { id: 'campaignId', label: 'Campagne', placeholder: 'Sélectionner une campagne...', optionSource: 'campaigns', emptyLabel: 'Aucune campagne trouvée. Créez d’abord une campagne.' },
        { id: 'briefTitle', label: 'Titre du brief', placeholder: 'Exemple : Brief vidéo de lancement' },
        { id: 'description', label: 'Détails du brief', placeholder: 'Objectifs, audience, livrables, contraintes', optional: true, multiline: true },
      ],
    },
    invoice: {
      title: 'Création facture',
      intro: '**Création de facture**\nJe vais collecter le client, le montant, la devise, la ligne et l’échéance, puis créer une facture brouillon.',
      nextLabel: 'Suivant',
      createLabel: 'Créer facture',
      skipLabel: 'Ignorer',
      backLabel: 'Retour',
      cancelLabel: 'Annuler',
      optionalLabel: 'Optionnel',
      cancelled: '**Création annulée**\nLe flux guidé a été annulé.',
      steps: [
        { id: 'clientId', label: 'Compte client', placeholder: 'Sélectionner un client...', optionSource: 'clients', emptyLabel: 'Aucun client trouvé. Créez d’abord un client.' },
        { id: 'campaignId', label: 'Campagne', placeholder: 'Lien campagne optionnel', optional: true, optionSource: 'campaigns' },
        { id: 'amount', label: 'Montant', placeholder: '1200', inputMode: 'decimal' },
        { id: 'currency', label: 'Devise', placeholder: 'USD, EUR, TND...', defaultValue: 'USD', optionSource: 'currencies' },
        { id: 'invoiceLocale', label: 'Langue facture', placeholder: 'English', defaultValue: 'en', optionSource: 'invoiceLocales' },
        { id: 'lineItem', label: 'Ligne de facture', placeholder: 'Exemple : Gestion campagne social media' },
        { id: 'dueDate', label: 'Échéance', placeholder: 'YYYY-MM-DD, ou vide', optional: true },
        { id: 'notes', label: 'Notes facture', placeholder: 'Conditions de paiement ou note client', optional: true, multiline: true },
      ],
    },
    client: {
      title: 'Création client',
      intro: '**Création de client**\nJe vais collecter les champs du profil un par un, puis créer la fiche client.',
      nextLabel: 'Suivant',
      createLabel: 'Créer client',
      skipLabel: 'Ignorer',
      backLabel: 'Retour',
      cancelLabel: 'Annuler',
      optionalLabel: 'Optionnel',
      cancelled: '**Création annulée**\nLe flux guidé a été annulé.',
      steps: [
        { id: 'companyName', label: 'Nom de l’entreprise', placeholder: 'Exemple : Acme Studio' },
        { id: 'contactPerson', label: 'Contact principal', placeholder: 'Nom du contact', optional: true },
        { id: 'email', label: 'Email', placeholder: 'client@example.com', optional: true, inputMode: 'email' },
        { id: 'phone', label: 'Téléphone', placeholder: '+216 ...', optional: true, inputMode: 'tel' },
        { id: 'country', label: 'Pays', placeholder: 'Tunisie, France, UAE...', optional: true },
        { id: 'status', label: 'Statut', placeholder: 'Actif', defaultValue: 'active', optionSource: 'clientStatuses' },
        { id: 'address', label: 'Adresse', placeholder: 'Adresse de facturation ou bureau', optional: true },
        { id: 'notes', label: 'Notes', placeholder: 'Contexte relation, paiement, préférences', optional: true, multiline: true },
      ],
    },
  },
  ar: {
    campaign: {
      title: 'إعداد الحملة',
      intro: '**إنشاء حملة**\nسأطلب الحقول المطلوبة خطوة بخطوة، ثم أنشئ الحملة والبريف الأولي داخل مساحة العمل.',
      nextLabel: 'التالي',
      createLabel: 'إنشاء الحملة',
      skipLabel: 'تخطي',
      backLabel: 'رجوع',
      cancelLabel: 'إلغاء',
      optionalLabel: 'اختياري',
      cancelled: '**تم إلغاء الإنشاء**\nتم إلغاء التدفق الموجه.',
      steps: [
        { id: 'campaignName', label: 'اسم الحملة', placeholder: 'مثال: إطلاق رمضان 2026' },
        { id: 'clientId', label: 'حساب العميل', placeholder: 'اختر عميلاً...', optionSource: 'clients', emptyLabel: 'لا يوجد عملاء. أنشئ عميلاً أولاً.' },
        { id: 'categoryId', label: 'الفئة', placeholder: 'اختر فئة...', optionSource: 'categories', emptyLabel: 'لا توجد فئات. أنشئ فئة أولاً.' },
        { id: 'managerId', label: 'المدير', placeholder: 'المستخدم الحالي', optional: true, optionSource: 'managers' },
        { id: 'description', label: 'وصف الحملة', placeholder: 'الهدف، النطاق، القنوات أو الملاحظات', optional: true, multiline: true },
      ],
    },
    brief: {
      title: 'إعداد البريف',
      intro: '**إنشاء بريف**\nسأجمع اسم الحملة والعنوان والتفاصيل، ثم أنشئ بريفاً كمسودة للمراجعة.',
      nextLabel: 'التالي',
      createLabel: 'إنشاء البريف',
      skipLabel: 'تخطي',
      backLabel: 'رجوع',
      cancelLabel: 'إلغاء',
      optionalLabel: 'اختياري',
      cancelled: '**تم إلغاء الإنشاء**\nتم إلغاء التدفق الموجه.',
      steps: [
        { id: 'campaignId', label: 'الحملة', placeholder: 'اختر حملة...', optionSource: 'campaigns', emptyLabel: 'لا توجد حملات. أنشئ حملة أولاً.' },
        { id: 'briefTitle', label: 'عنوان البريف', placeholder: 'مثال: بريف فيديو الإطلاق' },
        { id: 'description', label: 'تفاصيل البريف', placeholder: 'الأهداف، الجمهور، التسليمات، القيود', optional: true, multiline: true },
      ],
    },
    invoice: {
      title: 'إعداد الفاتورة',
      intro: '**إنشاء فاتورة**\nسأجمع العميل، المبلغ، العملة، البند، وتاريخ الاستحقاق، ثم أنشئ فاتورة كمسودة.',
      nextLabel: 'التالي',
      createLabel: 'إنشاء الفاتورة',
      skipLabel: 'تخطي',
      backLabel: 'رجوع',
      cancelLabel: 'إلغاء',
      optionalLabel: 'اختياري',
      cancelled: '**تم إلغاء الإنشاء**\nتم إلغاء التدفق الموجه.',
      steps: [
        { id: 'clientId', label: 'حساب العميل', placeholder: 'اختر عميلاً...', optionSource: 'clients', emptyLabel: 'لا يوجد عملاء. أنشئ عميلاً أولاً.' },
        { id: 'campaignId', label: 'الحملة', placeholder: 'ربط اختياري بالحملة', optional: true, optionSource: 'campaigns' },
        { id: 'amount', label: 'المبلغ', placeholder: '1200', inputMode: 'decimal' },
        { id: 'currency', label: 'العملة', placeholder: 'USD, EUR, TND...', defaultValue: 'USD', optionSource: 'currencies' },
        { id: 'invoiceLocale', label: 'لغة الفاتورة', placeholder: 'English', defaultValue: 'en', optionSource: 'invoiceLocales' },
        { id: 'lineItem', label: 'بند الفاتورة', placeholder: 'مثال: إدارة حملة سوشيال ميديا' },
        { id: 'dueDate', label: 'تاريخ الاستحقاق', placeholder: 'YYYY-MM-DD أو اتركه فارغاً', optional: true },
        { id: 'notes', label: 'ملاحظات الفاتورة', placeholder: 'شروط الدفع أو ملاحظة للعميل', optional: true, multiline: true },
      ],
    },
    client: {
      title: 'إعداد العميل',
      intro: '**إنشاء عميل**\nسأجمع بيانات الملف خطوة بخطوة، ثم أنشئ سجل العميل.',
      nextLabel: 'التالي',
      createLabel: 'إنشاء العميل',
      skipLabel: 'تخطي',
      backLabel: 'رجوع',
      cancelLabel: 'إلغاء',
      optionalLabel: 'اختياري',
      cancelled: '**تم إلغاء الإنشاء**\nتم إلغاء التدفق الموجه.',
      steps: [
        { id: 'companyName', label: 'اسم الشركة', placeholder: 'مثال: Acme Studio' },
        { id: 'contactPerson', label: 'الشخص المسؤول', placeholder: 'اسم جهة الاتصال الرئيسية', optional: true },
        { id: 'email', label: 'البريد الإلكتروني', placeholder: 'client@example.com', optional: true, inputMode: 'email' },
        { id: 'phone', label: 'الهاتف', placeholder: '+216 ...', optional: true, inputMode: 'tel' },
        { id: 'country', label: 'البلد', placeholder: 'تونس، فرنسا، الإمارات...', optional: true },
        { id: 'status', label: 'الحالة', placeholder: 'نشط', defaultValue: 'active', optionSource: 'clientStatuses' },
        { id: 'address', label: 'العنوان', placeholder: 'عنوان الفوترة أو المكتب', optional: true },
        { id: 'notes', label: 'ملاحظات', placeholder: 'سياق العلاقة، شروط الدفع، التفضيلات', optional: true, multiline: true },
      ],
    },
  },
}

const workflowCreateWords = [
  'create',
  'make',
  'add',
  'draft',
  'generate',
  'start',
  'creer',
  'créer',
  'ajouter',
  'generer',
  'générer',
  'انشاء',
  'إنشاء',
  'انشئ',
  'أنشئ',
  'اضافة',
  'إضافة',
]

const workflowKindWords: Record<WorkflowKind, string[]> = {
  invoice: ['invoice', 'bill', 'facture', 'فاتورة', 'فواتير'],
  brief: ['brief', 'بريف', 'ملخص'],
  client: ['client', 'customer', 'account', 'عميل', 'عملاء', 'زبون'],
  campaign: ['campaign', 'project', 'campagne', 'projet', 'حملة', 'مشروع'],
}

const knownSectionHeadings = new Set([
  'Direct Answer',
  'Key Insights',
  'Risks',
  'Recommendations',
  'Suggested Next Actions',
  'Priority Follow-Ups',
  'Client Profile',
  'Invoices Covered',
  'Governance',
  'Required Fields',
  'Next Step',
  'What I can do from live workspace records',
  'Useful prompts',
  'Réponse directe',
  'Points clés',
  'Risques',
  'Recommandations',
  'Actions suggérées',
  'Suivis prioritaires',
  'Profil client',
  'Factures couvertes',
  'Gouvernance',
  'Champs requis',
  'Prochaine étape',
  'الجواب المباشر',
  'أهم المؤشرات',
  'المخاطر',
  'التوصيات',
  'الإجراءات المقترحة',
  'المتابعات ذات الأولوية',
  'ملف العميل',
  'الفواتير المشمولة',
  'الحوكمة',
  'الحقول المطلوبة',
  'الخطوة التالية',
])

function toApiMessages(messages: AssistantMessage[]) {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({ role: message.role, content: message.content }))
}

function quickActionLabel(prompt: string, locale: AppLocale) {
  return quickActionLabels[locale][prompt] ?? prompt
}

function welcomeMessage(locale: AppLocale) {
  if (locale === 'fr') {
    return 'Je suis TASKIT Brain : une intelligence opérationnelle avec accès contrôlé aux risques, lancements, charge, approbations, clients, factures, mémoire et créations guidées. Je réponds uniquement depuis les données autorisées par votre rôle.'
  }

  if (locale === 'ar') {
    return 'أنا TASKIT Brain: ذكاء تشغيلي بصلاحيات محددة للمخاطر، الإطلاقات، عبء العمل، الموافقات، العملاء، الفواتير، الذاكرة والإنشاء الموجه. أجيب فقط من السجلات التي يسمح بها دورك.'
  }

  return 'I am TASKIT Brain: scoped operating intelligence for risks, launches, workload, approvals, clients, invoices, memory, and guided workflow creation. I only answer from records your role can access.'
}

function normalizeCommand(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function hasAny(value: string, words: string[]) {
  return words.some((word) => value.includes(normalizeCommand(word)))
}

function detectWorkflowKind(prompt: string): WorkflowKind | null {
  const normalized = normalizeCommand(prompt)
  if (!hasAny(normalized, workflowCreateWords)) return null

  if (hasAny(normalized, workflowKindWords.invoice)) return 'invoice'
  if (hasAny(normalized, workflowKindWords.brief)) return 'brief'
  if (hasAny(normalized, workflowKindWords.client)) return 'client'
  if (hasAny(normalized, workflowKindWords.campaign)) return 'campaign'

  return null
}

function initialWorkflowValues(definition: WorkflowDefinition) {
  return Object.fromEntries(
    definition.steps
      .filter((step) => step.defaultValue !== undefined)
      .map((step) => [step.id, step.defaultValue ?? ''])
  )
}

function emptyWorkflowContext(): WorkflowContext {
  return {
    companyType: 'OTHER',
    canManageWorkspace: false,
    canManageFinance: false,
    clients: [],
    campaigns: [],
    categories: [],
    managers: [],
    rooms: [],
    currencies: [{ value: 'USD', label: 'USD' }],
    invoiceLocales: [
      { value: 'en', label: 'English' },
      { value: 'ar', label: 'العربية' },
    ],
    clientStatuses: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  }
}

function compactValue(value: string | undefined) {
  return value?.trim() ?? ''
}

function optionsForStep(context: WorkflowContext | null, step: WorkflowStep) {
  if (!context || !step.optionSource) return []
  return context[step.optionSource] ?? []
}

function optionLabel(context: WorkflowContext | null, source: WorkflowOptionSource, value: string) {
  if (!value) return ''
  const option = context?.[source]?.find((item) => item.value === value)
  return option?.label ?? value
}

function optionDescription(context: WorkflowContext | null, source: WorkflowOptionSource, value: string) {
  if (!value) return ''
  const option = context?.[source]?.find((item) => item.value === value)
  return option?.description ?? ''
}

function isWorkflowStepRequired(kind: WorkflowKind, step: WorkflowStep, context: WorkflowContext | null) {
  if (step.optional) return false
  if (kind === 'campaign' && (step.id === 'clientId' || step.id === 'categoryId')) {
    return isAgencyCompanyType(context?.companyType)
  }

  return true
}

function buildWorkflowPrompt(kind: WorkflowKind, values: Record<string, string>, context: WorkflowContext | null) {
  if (kind === 'campaign') {
    return [
      `Create campaign called "${compactValue(values.campaignName)}".`,
      compactValue(values.clientId) ? `Client ID: ${compactValue(values.clientId)}.` : '',
      compactValue(values.clientId) ? `Client: ${optionLabel(context, 'clients', compactValue(values.clientId))}.` : '',
      compactValue(values.categoryId) ? `Category ID: ${compactValue(values.categoryId)}.` : '',
      compactValue(values.categoryId) ? `Category: ${optionLabel(context, 'categories', compactValue(values.categoryId))}.` : '',
      compactValue(values.managerId) ? `Manager ID: ${compactValue(values.managerId)}.` : '',
      compactValue(values.managerId) ? `Manager: ${optionLabel(context, 'managers', compactValue(values.managerId))}.` : '',
      compactValue(values.description) ? `Description: ${compactValue(values.description)}` : '',
    ].filter(Boolean).join('\n')
  }

  if (kind === 'brief') {
    return [
      `Create brief called "${compactValue(values.briefTitle)}".`,
      compactValue(values.campaignId) ? `Campaign ID: ${compactValue(values.campaignId)}.` : '',
      compactValue(values.campaignId) ? `Campaign: ${optionLabel(context, 'campaigns', compactValue(values.campaignId))}.` : '',
      compactValue(values.description) ? `Description: ${compactValue(values.description)}` : '',
    ].filter(Boolean).join('\n')
  }

  if (kind === 'invoice') {
    const amount = compactValue(values.amount).replace(/[^\d.,]/g, '')
    const currency = compactValue(values.currency).toUpperCase() || 'USD'
    return [
      `Create invoice amount $${amount} ${currency}.`,
      compactValue(values.clientId) ? `Client ID: ${compactValue(values.clientId)}.` : '',
      compactValue(values.clientId) ? `Client: ${optionLabel(context, 'clients', compactValue(values.clientId))}.` : '',
      compactValue(values.campaignId) ? `Campaign ID: ${compactValue(values.campaignId)}.` : '',
      compactValue(values.campaignId) ? `Campaign: ${optionLabel(context, 'campaigns', compactValue(values.campaignId))}.` : '',
      compactValue(values.invoiceLocale) ? `Invoice locale: ${compactValue(values.invoiceLocale)}.` : '',
      `Line item: ${compactValue(values.lineItem)}.`,
      compactValue(values.dueDate) ? `Due date: ${compactValue(values.dueDate)}.` : '',
      compactValue(values.notes) ? `Notes: ${compactValue(values.notes)}` : '',
    ].filter(Boolean).join('\n')
  }

  return [
    `Create client called "${compactValue(values.companyName)}".`,
    compactValue(values.contactPerson) ? `Contact person: ${compactValue(values.contactPerson)}.` : '',
    compactValue(values.email) ? `Email: ${compactValue(values.email)}.` : '',
    compactValue(values.phone) ? `Phone: ${compactValue(values.phone)}.` : '',
    compactValue(values.country) ? `Country: ${compactValue(values.country)}.` : '',
    compactValue(values.status) ? `Status: ${compactValue(values.status)}.` : '',
    compactValue(values.address) ? `Address: ${compactValue(values.address)}.` : '',
    compactValue(values.notes) ? `Notes: ${compactValue(values.notes)}` : '',
  ].filter(Boolean).join('\n')
}

function buildWorkflowSummary(locale: AppLocale, kind: WorkflowKind, values: Record<string, string>, context: WorkflowContext | null) {
  const definition = workflowDefinitions[locale][kind]
  const lines = definition.steps
    .map((step) => {
      const value = compactValue(values[step.id])
      const label = value && step.optionSource ? optionLabel(context, step.optionSource, value) : value
      const description = value && step.optionSource ? optionDescription(context, step.optionSource, value) : ''
      return value ? `- ${step.label}: ${label}${description ? ` (${description})` : ''}` : ''
    })
    .filter(Boolean)

  if (locale === 'fr') return `Créer avec ces informations :\n${lines.join('\n')}`
  if (locale === 'ar') return `إنشاء باستخدام هذه المعلومات:\n${lines.join('\n')}`
  return `Create with these details:\n${lines.join('\n')}`
}

function isSectionHeading(line: string) {
  const trimmed = line.trim().replace(/^\*\*|\*\*$/g, '').replace(/:$/, '')
  return knownSectionHeadings.has(trimmed)
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
    }

    return <span key={`${part}-${index}`}>{part}</span>
  })
}

function FormattedAssistantContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []
  let bullets: string[] = []

  const flushBullets = () => {
    if (!bullets.length) return
    const index = blocks.length
    blocks.push(
      <ul key={`bullets-${index}`} className="ai-assistant-bullets">
        {bullets.map((bullet, bulletIndex) => (
          <li key={`${bullet}-${bulletIndex}`}>{renderInline(bullet)}</li>
        ))}
      </ul>
    )
    bullets = []
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) {
      flushBullets()
      blocks.push(<span key={`space-${index}`} className="ai-assistant-content-space" />)
      return
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      bullets.push(trimmed.slice(2).trim())
      return
    }

    flushBullets()
    if (isSectionHeading(trimmed)) {
      blocks.push(
        <div key={`heading-${index}`} className="ai-assistant-section-title">
          {renderInline(trimmed.replace(/:$/, ''))}
        </div>
      )
      return
    }

    blocks.push(
      <p key={`paragraph-${index}`} className="ai-assistant-paragraph">
        {renderInline(trimmed)}
      </p>
    )
  })

  flushBullets()

  return <div className="ai-assistant-rich-content">{blocks}</div>
}

function ambiguitySelectionPrompt(payload: AiAmbiguityPanelPayload, option: AiAmbiguityOption) {
  const entity = payload.entity === 'campaign' ? 'campaign' : payload.entity ?? 'record'
  return `${payload.rawInput}\n${entity} id: ${option.id}`
}

export default function AiOperationsAssistant({ disabled = false }: { disabled?: boolean }) {
  const { t, locale, direction } = useLocale()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [activeWorkflow, setActiveWorkflow] = useState<ActiveWorkflow | null>(null)
  const [workflowContext, setWorkflowContext] = useState<WorkflowContext | null>(null)
  const [workflowContextLoading, setWorkflowContextLoading] = useState(false)
  const [workflowContextError, setWorkflowContextError] = useState<string | null>(null)
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: welcomeMessage(locale),
      quickActions: starterPrompts,
      model: 'grounded workspace intelligence',
    },
  ])
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const workflowInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null)
  const workflowFocusKey = activeWorkflow ? `${activeWorkflow.kind}:${activeWorkflow.stepIndex}` : ''

  const loadWorkflowContext = useCallback(async () => {
    if (workflowContext) return workflowContext

    setWorkflowContextLoading(true)
    setWorkflowContextError(null)

    try {
      const response = await fetch('/api/ai/workflow-context', { cache: 'no-store' })
      const data = (await response.json()) as WorkflowContext & { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Workflow choices could not be loaded.')
      const nextContext = { ...emptyWorkflowContext(), ...data }
      setWorkflowContext(nextContext)
      return nextContext
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Workflow choices could not be loaded.'
      setWorkflowContextError(message)
      const fallback = emptyWorkflowContext()
      setWorkflowContext(fallback)
      return fallback
    } finally {
      setWorkflowContextLoading(false)
    }
  }, [workflowContext])

  const latestQuickActions = useMemo(
    () => messages.findLast((message) => message.quickActions?.length)?.quickActions ?? starterPrompts,
    [messages]
  )

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, open, activeWorkflow])

  useEffect(() => {
    if (!open || activeWorkflow) return
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [activeWorkflow, open])

  useEffect(() => {
    if (!open || !workflowFocusKey) return
    const frame = window.requestAnimationFrame(() => workflowInputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open, workflowFocusKey])

  const sendChatPrompt = useCallback(
    async (prompt: string, options?: { displayContent?: string }) => {
      const message = prompt.trim()
      if (!message || loading || disabled) return

      const userMessage: AssistantMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: options?.displayContent ?? message,
      }
      const nextMessages = [...messages, userMessage]
      setMessages(nextMessages)
      setInput('')
      setOpen(true)
      setLoading(true)

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            messages: toApiMessages(nextMessages),
            conversationId,
            locale,
          }),
        })
        const data = (await response.json()) as Partial<AssistantResponse> & { error?: string }

        if (!response.ok) {
          throw new Error(data.error ?? 'Unable to run assistant.')
        }
        if (data.conversationId) setConversationId(data.conversationId)
        if (data.intent?.startsWith('create_') || data.intent?.startsWith('delete_') || data.intent === 'mark_invoice_paid') setWorkflowContext(null)

        setMessages((current) => [
          ...current,
          {
            id: data.id ?? crypto.randomUUID(),
            role: 'assistant',
            content: data.answer ?? 'No grounded answer was returned.',
            citations: data.citations ?? [],
            quickActions: data.quickActions ?? [],
            model: data.model,
            ambiguity: data.ambiguity ?? null,
          },
        ])
      } catch (error) {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: error instanceof Error ? error.message : 'The assistant is unavailable right now.',
            quickActions: starterPrompts,
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [conversationId, disabled, loading, locale, messages]
  )

  const startWorkflow = useCallback(
    async (kind: WorkflowKind, sourcePrompt: string) => {
      setOpen(true)
      setInput('')
      const context = await loadWorkflowContext()
      const definition = workflowDefinitions[locale][kind]
      const values = initialWorkflowValues(definition)
      for (const step of definition.steps) {
        if (!values[step.id] && step.optionSource) {
          const options = optionsForStep(context, step)
          if (options.length === 1 && isWorkflowStepRequired(kind, step, context)) values[step.id] = options[0].value
        }
      }

      setActiveWorkflow({
        kind,
        stepIndex: 0,
        values,
      })
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: quickActionLabel(sourcePrompt.trim(), locale),
        },
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: definition.intro,
          quickActions: [],
          model: 'guided workflow creator',
        },
      ])
    },
    [loadWorkflowContext, locale]
  )

  const submitPrompt = useCallback(
    async (prompt: string) => {
      const message = prompt.trim()
      if (!message || loading || disabled) return

      const workflowKind = detectWorkflowKind(message)
      if (workflowKind) {
        void startWorkflow(workflowKind, message)
        return
      }

      await sendChatPrompt(message)
    },
    [disabled, loading, sendChatPrompt, startWorkflow]
  )

  const completeWorkflow = useCallback(
    async (workflow: ActiveWorkflow) => {
      const prompt = buildWorkflowPrompt(workflow.kind, workflow.values, workflowContext)
      const displayContent = buildWorkflowSummary(locale, workflow.kind, workflow.values, workflowContext)
      setActiveWorkflow(null)
      await sendChatPrompt(prompt, { displayContent })
    },
    [locale, sendChatPrompt, workflowContext]
  )

  const advanceWorkflow = useCallback(
    async (skip = false) => {
      if (!activeWorkflow) return

      const definition = workflowDefinitions[locale][activeWorkflow.kind]
      const step = definition.steps[activeWorkflow.stepIndex]
      const currentValue = skip ? '' : compactValue(activeWorkflow.values[step.id])
      if (isWorkflowStepRequired(activeWorkflow.kind, step, workflowContext) && !currentValue) return

      const nextWorkflow = {
        ...activeWorkflow,
        values: {
          ...activeWorkflow.values,
          [step.id]: currentValue,
        },
      }

      if (activeWorkflow.stepIndex >= definition.steps.length - 1) {
        await completeWorkflow(nextWorkflow)
        return
      }

      setActiveWorkflow({
        ...nextWorkflow,
        stepIndex: activeWorkflow.stepIndex + 1,
      })
    },
    [activeWorkflow, completeWorkflow, locale, workflowContext]
  )

  const cancelWorkflow = useCallback(() => {
    if (!activeWorkflow) return
    const definition = workflowDefinitions[locale][activeWorkflow.kind]
    setActiveWorkflow(null)
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: definition.cancelled,
        quickActions: starterPrompts,
        model: 'guided workflow creator',
      },
    ])
  }, [activeWorkflow, locale])

  useEffect(() => {
    function onOpenAssistant(event: Event) {
      const detail = (event as CustomEvent<{ prompt?: string }>).detail
      setOpen(true)
      if (detail?.prompt) {
        void submitPrompt(detail.prompt)
      }
    }

    window.addEventListener('taskit:open-ai-assistant', onOpenAssistant)
    return () => window.removeEventListener('taskit:open-ai-assistant', onOpenAssistant)
  }, [submitPrompt])

  if (disabled) return null

  const workflowDefinition = activeWorkflow ? workflowDefinitions[locale][activeWorkflow.kind] : null
  const workflowStep = workflowDefinition && activeWorkflow ? workflowDefinition.steps[activeWorkflow.stepIndex] : null
  const workflowValue = workflowStep && activeWorkflow ? activeWorkflow.values[workflowStep.id] ?? '' : ''
  const workflowOptions = workflowStep ? optionsForStep(workflowContext, workflowStep) : []
  const showWorkflowSelect = Boolean(workflowStep?.optionSource && workflowOptions.length > 0)
  const workflowStepRequired = Boolean(activeWorkflow && workflowStep && isWorkflowStepRequired(activeWorkflow.kind, workflowStep, workflowContext))

  return (
    <>
      {!open && (
        <button
          type="button"
          className="ai-assistant-launcher"
          onClick={() => setOpen(true)}
          aria-label={t('ai.open')}
          title={t('ai.panel')}
        >
          <BrainCircuit size={20} />
          <span>{t('ai.launcher')}</span>
        </button>
      )}

      {open && (
        <section className="ai-assistant-panel" aria-label={t('ai.panel')} dir={direction}>
          <header className="ai-assistant-header">
            <div className="ai-assistant-title">
              <span className="ai-assistant-mark">
                <Bot size={18} />
              </span>
              <span>
                <strong>{t('ai.title')}</strong>
                <small>{t('ai.subtitle')}</small>
              </span>
            </div>
            <div className="ai-assistant-header-actions">
              <span className="ai-assistant-policy" title="Role-based data access is enforced server-side">
                <ShieldCheck size={13} />
                {t('ai.scoped')}
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('ai.close')}>
                <X size={16} />
              </button>
            </div>
          </header>

          <div className="ai-assistant-suggestions" aria-label={t('ai.suggestions')}>
            {latestQuickActions.slice(0, 5).map((prompt) => (
              <button key={prompt} type="button" onClick={() => submitPrompt(prompt)} disabled={loading || Boolean(activeWorkflow)}>
                <Sparkles size={13} />
                <span>{quickActionLabel(prompt, locale)}</span>
              </button>
            ))}
          </div>

          <div ref={scrollRef} className="ai-assistant-messages">
            {messages.map((message) => (
              <article key={message.id} className={`ai-assistant-message ${message.role}`}>
                <div className="ai-assistant-message-body">
                  {message.role === 'assistant' ? <FormattedAssistantContent content={message.content} /> : message.content}
                </div>
                {message.role === 'assistant' && message.ambiguity ? (
                  <AmbiguityPanel
                    payload={message.ambiguity}
                    onSelect={(option) =>
                      void sendChatPrompt(ambiguitySelectionPrompt(message.ambiguity!, option), {
                        displayContent: option.label,
                      })
                    }
                  />
                ) : null}
                {message.citations?.length ? (
                  <div className="ai-assistant-citations">
                    <ClipboardList size={13} />
                    {message.citations.slice(0, 4).map((citation) =>
                      citation.href ? (
                        <a key={`${citation.type}-${citation.id}`} href={citation.href}>
                          {citation.label}
                        </a>
                      ) : (
                        <span key={`${citation.type}-${citation.id}`}>{citation.label}</span>
                      )
                    )}
                  </div>
                ) : null}
                {message.model && message.role === 'assistant' ? <div className="ai-assistant-model">{message.model}</div> : null}
              </article>
            ))}
            {loading && (
              <div className="ai-assistant-thinking">
                <Loader2 size={15} />
                {t('ai.thinking')}
              </div>
            )}
          </div>

          {activeWorkflow && workflowDefinition && workflowStep ? (
            <form
              className="ai-assistant-workflow-composer"
              onSubmit={(event) => {
                event.preventDefault()
                void advanceWorkflow(false)
              }}
            >
              <div className="ai-assistant-workflow-progress">
                <span>{workflowDefinition.title}</span>
                <small>
                  {activeWorkflow.stepIndex + 1}/{workflowDefinition.steps.length}
                </small>
              </div>
              <label htmlFor={`ai-workflow-${workflowStep.id}`}>
                <span>{workflowStep.label}</span>
                {!workflowStepRequired ? <em>{workflowDefinition.optionalLabel}</em> : null}
              </label>
              {workflowContextError ? <div className="ai-assistant-workflow-hint">{workflowContextError}</div> : null}
              {workflowContextLoading ? <div className="ai-assistant-workflow-hint">{t('ai.thinking')}</div> : null}
              {showWorkflowSelect ? (
                <select
                  id={`ai-workflow-${workflowStep.id}`}
                  ref={workflowInputRef as React.RefObject<HTMLSelectElement>}
                  value={workflowValue}
                  onChange={(event) =>
                    setActiveWorkflow((current) =>
                      current ? { ...current, values: { ...current.values, [workflowStep.id]: event.target.value } } : current
                    )
                  }
                >
                  <option value="">{!workflowStepRequired ? workflowDefinition.skipLabel : workflowStep.placeholder}</option>
                  {workflowOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}{option.description ? ` - ${option.description}` : ''}
                    </option>
                  ))}
                </select>
              ) : workflowStep.optionSource ? (
                <div className="ai-assistant-workflow-empty">
                  {workflowStep.emptyLabel ?? workflowStep.placeholder}
                </div>
              ) : workflowStep.multiline ? (
                <textarea
                  id={`ai-workflow-${workflowStep.id}`}
                  ref={workflowInputRef as React.RefObject<HTMLTextAreaElement>}
                  value={workflowValue}
                  rows={3}
                  placeholder={workflowStep.placeholder}
                  onChange={(event) =>
                    setActiveWorkflow((current) =>
                      current ? { ...current, values: { ...current.values, [workflowStep.id]: event.target.value } } : current
                    )
                  }
                />
              ) : (
                <input
                  id={`ai-workflow-${workflowStep.id}`}
                  ref={workflowInputRef as React.RefObject<HTMLInputElement>}
                  value={workflowValue}
                  inputMode={workflowStep.inputMode}
                  placeholder={workflowStep.placeholder}
                  onChange={(event) =>
                    setActiveWorkflow((current) =>
                      current ? { ...current, values: { ...current.values, [workflowStep.id]: event.target.value } } : current
                    )
                  }
                />
              )}
              <div className="ai-assistant-workflow-actions">
                <button type="button" className="ghost" onClick={cancelWorkflow}>
                  <X size={14} />
                  {workflowDefinition.cancelLabel}
                </button>
                {activeWorkflow.stepIndex > 0 ? (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() =>
                      setActiveWorkflow((current) =>
                        current ? { ...current, stepIndex: Math.max(0, current.stepIndex - 1) } : current
                      )
                    }
                  >
                    <ChevronLeft size={14} />
                    {workflowDefinition.backLabel}
                  </button>
                ) : null}
                {!workflowStepRequired ? (
                  <button type="button" className="ghost" onClick={() => void advanceWorkflow(true)}>
                    {workflowDefinition.skipLabel}
                  </button>
                ) : null}
                <button type="submit" className="primary" disabled={workflowStepRequired && !workflowValue.trim()}>
                  {activeWorkflow.stepIndex >= workflowDefinition.steps.length - 1 ? <CheckCircle2 size={15} /> : <ChevronUp size={15} />}
                  {activeWorkflow.stepIndex >= workflowDefinition.steps.length - 1
                    ? workflowDefinition.createLabel
                    : workflowDefinition.nextLabel}
                </button>
              </div>
            </form>
          ) : (
            <form
              className="ai-assistant-composer"
              onSubmit={(event) => {
                event.preventDefault()
                void submitPrompt(input)
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                rows={2}
                placeholder={t('ai.placeholder')}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void submitPrompt(input)
                  }
                }}
              />
              <button type="submit" disabled={!input.trim() || loading} aria-label={t('ai.send')}>
                {loading ? <ChevronUp size={16} /> : <Send size={16} />}
              </button>
            </form>
          )}
        </section>
      )}
    </>
  )
}
