'use client'

import { type CSSProperties, type Dispatch, type ReactNode, type SetStateAction, useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Ambulance,
  ArrowLeft,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Database,
  GraduationCap,
  Globe2,
  HardHat,
  HeartPulse,
  Hospital,
  Landmark,
  Languages,
  Loader2,
  Lock,
  Mail,
  Plus,
  Scale,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
  Trash2,
  User,
} from 'lucide-react'
import logo from '@/app/logo.png'
import type { CompanyType } from '@/lib/company-types'
import { getWorkspaceHomePath } from '@/lib/workspace-routing'
import {
  getTemplate,
  getTemplateForCompanyType,
  ONBOARDING_STEPS,
  ONBOARDING_TEMPLATES,
  ENTERPRISE_ERP_MODULES,
  persistOnboardingProgress,
  readOnboardingProgress,
  TEMPLATE_ORDER,
  trackOnboardingEvent,
  type OnboardingStepId,
  type OnboardingTemplateId,
} from '@/lib/onboarding-engine'
import styles from './SignupOnboardingClient.module.css'
import type { OnboardingSelection } from '@/components/onboarding/OnboardingFlow'
import { isBlockedOwnerEmailDomain } from '@/lib/signup-hints'
import { getCountryCurrencyOptions } from '@/lib/currencies'
import {
  calculateWorkspacePlanTotal,
  clampSeatCount,
  getDefaultIsolation,
  getDefaultPlanForWorkspace,
  getWorkspacePlan,
  getWorkspacePricing,
  isFreePlan,
  type BillingCycle,
} from '@/lib/workspace-pricing'
import {
  evaluatePasswordPolicy,
  PASSWORD_MIN_LENGTH,
} from '@/modules/security/password-policy'

const WorkspacePreview = dynamic(() => import('./onboarding/WorkspacePreview'), {
  loading: () => <PreviewSkeleton />,
})

const GenerationExperience = dynamic(() => import('./onboarding/GenerationExperience'), {
  loading: () => <GenerationSkeleton />,
})

const OnboardingFlow = dynamic(() => import('@/components/onboarding/OnboardingFlow'), {
  loading: () => <PreviewSkeleton />,
})

const smartOnboardingEnabled = String(process.env.NEXT_PUBLIC_SMART_ONBOARDING || '').toLowerCase() === 'true'

const templateIcons = {
  briefcase: BriefcaseBusiness,
  heartPulse: HeartPulse,
  hospital: Hospital,
  building: Building2,
  server: ServerCog,
  scale: Scale,
  hardHat: HardHat,
  landmark: Landmark,
  graduationCap: GraduationCap,
  database: Database,
  sparkles: Sparkles,
  ambulance: Ambulance,
} as const

type SignupRole = 'OWNER' | 'MANAGER' | 'EMPLOYEE'

type InvitePreview = {
  code: string
  invitedEmailMasked: string
  role: SignupRole
  companyName: string
  companyType: CompanyType
  expiresAt: string
}

type InviteRow = {
  id: string
  email: string
  role: 'Manager' | 'Member' | 'Finance'
  department: string
}

type SetupForm = {
  name: string
  email: string
  password: string
  companyName: string
  companySize: string
  country: string
  language: string
}

type LegalConsentState = {
  termsAccepted: boolean
  privacyAccepted: boolean
  marketingEmailsAccepted: boolean
  aiUsageDisclosureAcknowledged: boolean
}

type PersistedOnboarding = {
  step: OnboardingStepId
  templateId: OnboardingTemplateId
  companyType?: CompanyType
  form: SetupForm
  invites: InviteRow[]
}

const companySizes = ['1-10', '11-50', '51-200', '201-1000', '1000+']
const languages = ['English', 'Arabic', 'French', 'Spanish', 'German']
const countries = getCountryCurrencyOptions().map((option) => option.value)
const translationTargets = [
  { code: 'ar', label: 'Arabic' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'tr', label: 'Turkish' },
  { code: 'zh-CN', label: 'Chinese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ru', label: 'Russian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'sv', label: 'Swedish' },
  { code: 'more', label: 'More languages' },
] as const

const blankForm: SetupForm = {
  name: '',
  email: '',
  password: '',
  companyName: '',
  companySize: '11-50',
  country: 'United States',
  language: 'English',
}

export default function SignupOnboardingClient({
  initialInviteCode,
  initialCompanyType,
}: {
  initialInviteCode: string
  initialCompanyType: CompanyType
}) {
  const router = useRouter()
  const initialTemplateId = getTemplateForCompanyType(initialCompanyType)
  const [step, setStep] = useState<OnboardingStepId>(initialCompanyType !== 'OTHER' ? 'generating' : 'welcome')
  const [templateId, setTemplateId] = useState<OnboardingTemplateId>(initialTemplateId)
  const [selectedCompanyType, setSelectedCompanyType] = useState<CompanyType>(initialCompanyType)
  const [form, setForm] = useState<SetupForm>(blankForm)
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [inviteDraft, setInviteDraft] = useState({ email: '', role: 'Member' as InviteRow['role'], department: '' })
  const [legalConsent, setLegalConsent] = useState<LegalConsentState>({
    termsAccepted: false,
    privacyAccepted: false,
    marketingEmailsAccepted: false,
    aiUsageDisclosureAcknowledged: false,
  })
  const [legalTouched, setLegalTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null)
  const [validatingInvite, setValidatingInvite] = useState(false)
  const [workspaceHomePath, setWorkspaceHomePath] = useState(() =>
    getWorkspaceHomePath({ role: 'OWNER', companyType: initialCompanyType })
  )

  const inviteCode = initialInviteCode.trim()
  const inviteMode = Boolean(inviteCode)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [seatCount, setSeatCount] = useState(1)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [isolationEnabled, setIsolationEnabled] = useState(false)
  const template = getTemplate(templateId)
  const hasRequiredLegalConsent = legalConsent.termsAccepted && legalConsent.privacyAccepted
  const passwordPolicy = evaluatePasswordPolicy(form.password, {
    email: form.email.trim(),
    name: form.name.trim(),
  })
  const ownerEmailBlocked = !inviteMode && isBlockedOwnerEmailDomain(form.email)
  const canSubmitSetup =
    form.name.trim().length > 1 &&
    form.email.includes('@') &&
    passwordPolicy.ok &&
    form.companyName.trim().length > 1 &&
    form.country.trim().length > 1 &&
    hasRequiredLegalConsent &&
    !ownerEmailBlocked

  const generationComplete = useCallback(() => {
    trackOnboardingEvent('generation_complete', { templateId })
    setStep('setup')
  }, [templateId])

  useEffect(() => {
    const saved = readOnboardingProgress<PersistedOnboarding>()
    if (!saved || inviteMode) return
    if (initialCompanyType !== 'OTHER') return

    setStep(saved.step === 'generating' ? 'company-type' : saved.step)
    setTemplateId(saved.templateId)
    setSelectedCompanyType(saved.companyType ?? getTemplate(saved.templateId).companyType)
    setForm(saved.form)
    setInvites(saved.invites)
  }, [inviteMode, initialCompanyType])

  useEffect(() => {
    if (inviteMode) return
    persistOnboardingProgress({ step, templateId, companyType: selectedCompanyType, form, invites } satisfies PersistedOnboarding)
  }, [form, invites, inviteMode, selectedCompanyType, step, templateId])

  useEffect(() => {
    if (inviteMode) return
    const defaultPlan = getDefaultPlanForWorkspace(selectedCompanyType)
    setSelectedPlan(defaultPlan.id)
    setSeatCount(defaultPlan.seats ?? 1)
    setIsolationEnabled(getDefaultIsolation(defaultPlan))
  }, [inviteMode, selectedCompanyType])

  useEffect(() => {
    trackOnboardingEvent('step_viewed', { step, templateId })
  }, [step, templateId])

  useEffect(() => {
    if (!inviteMode) return

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        setValidatingInvite(true)
        const response = await fetch(`/api/invites/${encodeURIComponent(inviteCode)}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const data = (await response.json()) as InvitePreview & { error?: string }

        if (!response.ok) {
          setError(data.error || 'Invite not found.')
          setInvitePreview(null)
          return
        }

        setInvitePreview(data)
        setTemplateId(getTemplateForCompanyType(data.companyType))
        setSelectedCompanyType(data.companyType)
        setStep('setup')
      } catch (fetchError) {
        if ((fetchError as Error).name !== 'AbortError') {
          setError('Unable to validate this invite right now.')
        }
      } finally {
        setValidatingInvite(false)
      }
    }, 180)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [inviteCode, inviteMode])

  function updateForm<Key extends keyof SetupForm>(key: Key, value: SetupForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
    setError('')
  }

  function goTo(nextStep: OnboardingStepId) {
    setStep(nextStep)
    setError('')
  }

  function applySmartOnboardingSelection(selection: OnboardingSelection) {
    setTemplateId(selection.templateId)
    setSelectedCompanyType(selection.companyType)
  }

  function addInvite() {
    const email = inviteDraft.email.trim()
    if (!email || !email.includes('@')) return

    setInvites((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        email,
        role: inviteDraft.role,
        department: inviteDraft.department.trim() || template.departments[0] || 'Operations',
      },
    ])
    setInviteDraft({ email: '', role: 'Member', department: '' })
    trackOnboardingEvent('invite_queued', { templateId })
  }

  async function submitRegistration(nextStep: OnboardingStepId = 'success') {
    setLegalTouched(true)
    if (!canSubmitSetup) {
      if (ownerEmailBlocked) {
        setError('Owner signup requires a company email address (not Gmail, Yahoo, Outlook, iCloud, etc.).')
        return
      }
      if (!passwordPolicy.ok) {
        setError(passwordPolicy.errors.join(' '))
        return
      }
      setError('Complete the required account and workspace fields to continue.')
      return
    }

    setLoading(true)
    setError('')

    const registrationToken = createPendingRegistrationToken(form.companyName, form.email)

    const body = inviteMode
      ? {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: invitePreview?.role ?? 'EMPLOYEE',
          inviteCode,
          locale: navigator.language,
          legalConsent,
        }
      : {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: 'OWNER',
          companyName: form.companyName.trim(),
          country: form.country.trim(),
          industry: `${template.industryDefault} (${form.companySize})`,
          registrationNumber: registrationToken,
          companyType: selectedCompanyType,
          locale: navigator.language,
          legalConsent,
          onboarding: {
            companySize: form.companySize,
            preferredLanguage: form.language,
            templateId,
            queuedInvites: invites,
          },
          billingSelection: {
            planId: selectedPlan ?? getDefaultPlanForWorkspace(selectedCompanyType).id,
            seatCount,
            isolationEnabled,
            billingCycle,
          },
        }

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = (await response.json().catch(() => ({}))) as {
      error?: string
      details?: { password?: string[] }
      checkoutUrl?: string | null
      billingCheckoutWarning?: string | null
      message?: string
      workspaceHomePath?: string
    }
    setLoading(false)

    if (!response.ok) {
      const passwordErrors = Array.isArray(data.details?.password) ? data.details.password : []
      const errorMessage = passwordErrors.length > 0 ? passwordErrors.join(' ') : data.error || 'Registration failed.'
      if (response.status === 409 && /email|registered|exists/i.test(errorMessage)) {
        setError('This account was already created. Sign in with this email, then open Billing to finish payment setup.')
        return
      }
      setError(errorMessage)
      return
    }

    trackOnboardingEvent('registration_submitted', { templateId, inviteMode, inviteCount: invites.length })
    setWorkspaceHomePath(
      data.workspaceHomePath ??
        getWorkspaceHomePath({
          role: inviteMode ? invitePreview?.role : 'OWNER',
          companyType: selectedCompanyType,
        })
    )
    if (!inviteMode && invites.length > 0) {
      window.localStorage.setItem(
        'taskit:onboarding:queued-invites',
        JSON.stringify({
          companyName: form.companyName.trim(),
          invites,
          templateId,
          at: new Date().toISOString(),
        })
      )
    }
    window.localStorage.removeItem('taskit:onboarding:v2')
    window.localStorage.setItem(
      'taskit:onboarding:selected-plan',
      JSON.stringify({
        billingCycle,
        isolationEnabled,
        planId: selectedPlan,
        seatCount,
        workspaceType: selectedCompanyType,
      })
    )
    if (!inviteMode && data.checkoutUrl) {
      window.location.assign(data.checkoutUrl)
      return
    }
    setStep(nextStep)
  }

  let content: ReactNode = null

  if (validatingInvite) {
    content = (
      <main className={styles.centerStage} id="main-content">
        <GenerationSkeleton label="Validating secure invite" />
      </main>
    )
  } else {
    switch (step) {
      case 'welcome':
        content = <WelcomeStep onStart={() => goTo('company-type')} />
        break
      case 'company-type':
        content = smartOnboardingEnabled ? (
          <OnboardingFlow
            onSelect={applySmartOnboardingSelection}
            onSubmit={(selection) => {
              applySmartOnboardingSelection(selection)
              trackOnboardingEvent('template_selected', {
                templateId: selection.templateId,
                companyType: selection.companyType,
              })
              goTo('generating')
            }}
            onBack={() => goTo('welcome')}
          />
        ) : (
          <CompanyTypeStep
            selected={templateId}
            onSelect={(next) => {
              setTemplateId(next)
              setSelectedCompanyType(ONBOARDING_TEMPLATES[next].companyType)
              trackOnboardingEvent('template_selected', { templateId: next })
            }}
            onBack={() => goTo('welcome')}
            onGenerate={() => goTo('generating')}
          />
        )
        break
      case 'generating':
        content = <GenerationExperience templateId={templateId} onComplete={generationComplete} />
        break
      case 'setup':
        content = (
          <SetupStep
            form={form}
            error={error}
            inviteMode={inviteMode}
            invitePreview={invitePreview}
            legalConsent={legalConsent}
            legalTouched={legalTouched}
            loading={loading}
            templateId={templateId}
            canSubmit={canSubmitSetup}
            passwordErrors={passwordPolicy.errors}
            ownerEmailBlocked={ownerEmailBlocked}
            onBack={() => goTo(inviteMode ? 'setup' : 'company-type')}
            onLegalTouched={() => setLegalTouched(true)}
            onLegalChange={setLegalConsent}
            onChange={updateForm}
            onContinue={() => (inviteMode ? submitRegistration('success') : goTo('team'))}
          />
        )
        break
      case 'team':
        content = (
          <TeamStep
            draft={inviteDraft}
            invites={invites}
            loading={loading}
            templateId={templateId}
            error={error}
            onDraftChange={setInviteDraft}
            onAddInvite={addInvite}
            onRemoveInvite={(id) => setInvites((current) => current.filter((invite) => invite.id !== id))}
            onBack={() => goTo('setup')}
            onSkip={() => goTo('plan')}
            onFinish={() => goTo('plan')}
          />
        )
        break
      case 'plan':
        content = (
          <PlanStep
            companyType={selectedCompanyType}
            selectedPlan={selectedPlan}
            seatCount={seatCount}
            billingCycle={billingCycle}
            isolationEnabled={isolationEnabled}
            loading={loading}
            onSelect={setSelectedPlan}
            onSeatCountChange={setSeatCount}
            onBillingCycleChange={setBillingCycle}
            onIsolationChange={setIsolationEnabled}
            onBack={() => goTo('team')}
            onNext={() => submitRegistration('success')}
          />
        )
        break
      case 'success':
        content = (
          <SuccessStep
            companyName={form.companyName}
            invites={invites}
            templateId={templateId}
            inviteMode={inviteMode}
            selectedPlan={selectedPlan}
            workspaceHomePath={workspaceHomePath}
            onEnter={() => {
              const params = new URLSearchParams({
                registered: inviteMode ? '1' : 'workspace',
                callbackUrl: workspaceHomePath,
              })
              if (selectedPlan) params.set('plan', selectedPlan)
              router.push(`/login?${params.toString()}`)
            }}
          />
        )
        break
      default:
        content = null
    }
  }

  return (
    <div className={styles.shell}>
      <Header step={step} inviteMode={inviteMode} />
      <AnimatePresence mode="wait">
        <motion.div
          key={validatingInvite ? 'validating' : step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Header({ step, inviteMode }: { step: OnboardingStepId; inviteMode: boolean }) {
  const visibleSteps = ONBOARDING_STEPS.filter((item) => !inviteMode || ['setup', 'success'].includes(item.id))
  const visibleStepIndex = Math.max(0, visibleSteps.findIndex((item) => item.id === step))

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="TASKIT home">
        <Image src={logo} alt="" width={38} height={38} priority />
        <span>TASKIT</span>
      </Link>

      <nav className={styles.progressNav} aria-label="Onboarding progress">
        {visibleSteps.map((item, index) => {
          const isCurrent = item.id === step
          const isDone = index < visibleStepIndex

          return (
            <span key={item.id} className={`${styles.progressDot} ${isCurrent ? styles.progressDotActive : ''} ${isDone ? styles.progressDotDone : ''}`}>
              {isDone ? <Check size={12} /> : index + 1}
              <span>{item.label}</span>
            </span>
          )
        })}
      </nav>

      <div className={styles.headerActions}>
        <TranslationMenu />
        <Link href="/login" className={styles.loginLink}>
          Sign in
        </Link>
      </div>
    </header>
  )
}

function TranslationMenu() {
  const [targetLanguage, setTargetLanguage] = useState<(typeof translationTargets)[number]['code']>('fr')

  function translateSignupFlow() {
    if (typeof window === 'undefined') return

    if (targetLanguage === 'more') {
      window.open('https://translate.google.com/?op=websites', '_blank', 'noopener,noreferrer')
      return
    }

    const translatedUrl = new URL('https://translate.google.com/translate')
    translatedUrl.searchParams.set('sl', 'auto')
    translatedUrl.searchParams.set('tl', targetLanguage)
    translatedUrl.searchParams.set('u', window.location.href)
    window.open(translatedUrl.toString(), '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={styles.translationMenu}>
      <label className={styles.translationLabel}>
        <Languages size={15} aria-hidden="true" />
        <span>Translate</span>
      </label>
      <select
        value={targetLanguage}
        onChange={(event) => setTargetLanguage(event.target.value as (typeof translationTargets)[number]['code'])}
        aria-label="Choose signup translation language"
        title="Translate signup steps"
      >
        {translationTargets.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
      <button type="button" onClick={translateSignupFlow} aria-label="Translate signup steps">
        <Globe2 size={15} aria-hidden="true" />
      </button>
    </div>
  )
}

function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <main className={styles.welcomeStage} id="main-content">
      <div className={styles.welcomeBackdrop} aria-hidden="true">
        <div className={styles.signalGrid}>
          {Array.from({ length: 42 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>

      <section className={styles.welcomeHero} aria-labelledby="welcome-title">
        <div className={styles.logoHero}>
          <Image src={logo} alt="TASKIT logo" width={82} height={82} priority />
        </div>
        <p className={styles.stepKicker}>
          <Zap size={15} />
          AI-native ERP provisioning
        </p>
        <h1 id="welcome-title">Provision your enterprise operating system in under <span>60 seconds.</span></h1>
        <p>
          TASKIT generates a tenant-isolated workspace graph with modules, dashboards, RBAC, audit trails, workflows,
          copilots, realtime collaboration, and event-driven automations before your team configures anything.
        </p>
        <button type="button" className={styles.primaryCta} onClick={onStart}>
          <Bot size={18} />
          Start AI setup
          <ArrowRight size={18} />
        </button>
      </section>
    </main>
  )
}

function CompanyTypeStep({
  selected,
  onSelect,
  onBack,
  onGenerate,
}: {
  selected: OnboardingTemplateId
  onSelect: (id: OnboardingTemplateId) => void
  onBack: () => void
  onGenerate: () => void
}) {
  const template = getTemplate(selected)

  return (
    <main className={styles.selectionStage} id="main-content">
      <section className={styles.selectionCopy}>
        <button type="button" className={styles.ghostButton} onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
        <p className={styles.stepKicker}>
          <Bot size={14} />
          Workspace fit intelligence
        </p>
        <h1>Choose the operating model TASKIT should <span>provision.</span></h1>
        <p>
          Pick the closest workspace outcome. ERP is tuned for finance, procurement, inventory, HR, and payroll.
          EMS is tuned for dispatch, fleet readiness, incidents, hospitals, protocols, and response analytics.
        </p>

        <div className={styles.templateGrid} role="radiogroup" aria-label="Company type">
          {TEMPLATE_ORDER.map((id) => {
            const option = ONBOARDING_TEMPLATES[id]
            const isSelected = selected === id
            const OptionIcon = templateIcons[option.icon as keyof typeof templateIcons] ?? Zap

            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`${styles.templateTile} ${isSelected ? styles.templateTileSelected : ''}`}
                style={{ '--template-accent': option.accent, '--template-soft': option.softAccent } as CSSProperties}
                onClick={() => onSelect(id)}
              >
                <span className={styles.templateIcon}>
                  <OptionIcon size={18} aria-hidden="true" />
                </span>
                <strong>{option.title}</strong>
                <span>{option.sentence}</span>
              </button>
            )
          })}
        </div>

        <div className={styles.selectionActionBar}>
          <div>
            <strong>{template.title} OS</strong>
            <span>{template.whyItMatters}</span>
          </div>
          <button type="button" className={styles.primaryCta} onClick={onGenerate}>
            Generate workspace
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <WorkspacePreview templateId={selected} />
    </main>
  )
}

function SetupStep({
  form,
  templateId,
  inviteMode,
  invitePreview,
  legalConsent,
  legalTouched,
  loading,
  error,
  canSubmit,
  passwordErrors,
  ownerEmailBlocked,
  onChange,
  onLegalChange,
  onLegalTouched,
  onBack,
  onContinue,
}: {
  form: SetupForm
  templateId: OnboardingTemplateId
  inviteMode: boolean
  invitePreview: InvitePreview | null
  legalConsent: LegalConsentState
  legalTouched: boolean
  loading: boolean
  error: string
  canSubmit: boolean
  passwordErrors: string[]
  ownerEmailBlocked: boolean
  onChange: <Key extends keyof SetupForm>(key: Key, value: SetupForm[Key]) => void
  onLegalChange: Dispatch<SetStateAction<LegalConsentState>>
  onLegalTouched: () => void
  onBack: () => void
  onContinue: () => void
}) {
  return (
    <main className={styles.setupStage} id="main-content">
      <section className={styles.setupPanel}>
        {!inviteMode && (
          <button type="button" className={styles.ghostButton} onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </button>
        )}

        <p className={styles.stepKicker}>
          <ShieldCheck size={14} />
          Secure workspace identity
        </p>
        {inviteMode ? (
          <h1>Secure your invited <span>account.</span></h1>
        ) : (
          <h1>Create your owner account and workspace <span>identity.</span></h1>
        )}
        <p className={styles.setupLead}>
          {inviteMode && invitePreview
            ? `You are joining ${invitePreview.companyName}. Finish your account to access the approved workspace.`
            : 'We only ask for the details needed to create the tenant, localize the workspace, and keep ownership clear from day one.'}
        </p>

        <div className={styles.formGrid}>
          <p className={styles.requiredNote}>All fields required unless marked optional</p>
          <p className={styles.sectionLabel}>Account info</p>
          <Field label="Your name" icon={<User size={15} />} required>
            <input className={styles.input} value={form.name} onChange={(event) => onChange('name', event.target.value)} autoComplete="name" />
          </Field>

          <Field label="Work email" icon={<Mail size={15} />} required>
            <input
              className={styles.input}
              type="email"
              value={form.email}
              onChange={(event) => onChange('email', event.target.value)}
              autoComplete="email"
              placeholder={inviteMode ? 'you@company.com' : 'owner@yourcompany.com'}
            />
            {!inviteMode && (
              <p className={styles.fieldHint}>
                Use your company domain email. Personal inboxes (Gmail, Yahoo, Outlook, iCloud, etc.) are not accepted for
                owner accounts.
              </p>
            )}
            {ownerEmailBlocked && (
              <p className={styles.fieldError}>This email domain cannot be used for owner signup. Use your company email.</p>
            )}
          </Field>

          <Field label="Password" icon={<Lock size={15} />} required>
            <input
              className={styles.input}
              type="password"
              minLength={PASSWORD_MIN_LENGTH}
              value={form.password}
              onChange={(event) => onChange('password', event.target.value)}
              autoComplete="new-password"
              placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
            />
            {form.password.length > 0 && (
              <PasswordStrengthBar password={form.password} />
            )}
            {form.password.length > 0 && passwordErrors.length > 0 && (
              <p className={styles.fieldError}>{passwordErrors.join(' ')}</p>
            )}
          </Field>

          <div className={styles.sectionDivider} />
          <p className={styles.sectionLabel}>Your company</p>

          <Field label="Company name" icon={<Zap size={15} />} required>
            <input
              className={styles.input}
              value={form.companyName}
              onChange={(event) => onChange('companyName', event.target.value)}
              autoComplete="organization"
              placeholder="Acme Agency"
              disabled={inviteMode}
            />
          </Field>

          {!inviteMode && (
            <>
              <Field label="Company size" icon={<ShieldCheck size={15} />} required>
                <SegmentedControl
                  value={form.companySize}
                  options={companySizes}
                  onChange={(value) => onChange('companySize', value)}
                />
              </Field>

              <Field label="Country" icon={<Globe2 size={15} />} required>
                <select className={styles.input} value={form.country} onChange={(event) => onChange('country', event.target.value)}>
                  {countries.map((country) => (
                    <option key={country}>{country}</option>
                  ))}
                </select>
              </Field>

              <Field label="Preferred language" icon={<Globe2 size={15} />} required>
                <select className={styles.input} value={form.language} onChange={(event) => onChange('language', event.target.value)}>
                  {languages.map((language) => (
                    <option key={language}>{language}</option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </div>

        <section className={`${styles.legalBox} ${legalTouched && !canSubmit ? styles.legalBoxInvalid : ''}`} aria-label="Legal consent">
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={legalConsent.termsAccepted && legalConsent.privacyAccepted}
              onBlur={onLegalTouched}
              onChange={(event) => {
                const checked = event.target.checked
                onLegalChange((current) => ({
                  ...current,
                  termsAccepted: checked,
                  privacyAccepted: checked,
                  aiUsageDisclosureAcknowledged: checked,
                }))
              }}
            />
            <span>
              I agree to the <Link href="/terms">Terms</Link>, <Link href="/privacy">Privacy Policy</Link>, and{' '}
              <Link href="/ai-transparency">AI Transparency Policy</Link>.
            </span>
          </label>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={legalConsent.marketingEmailsAccepted}
              onChange={(event) => onLegalChange((current) => ({ ...current, marketingEmailsAccepted: event.target.checked }))}
            />
            <span>Send me useful product and compliance updates.</span>
          </label>
        </section>

        {error && (
          <div className={styles.errorBox} role="alert">
            {error}
          </div>
        )}

        <div className={styles.formActions}>
          <button type="button" className={styles.primaryCta} onClick={onContinue} disabled={loading || !canSubmit}>
            {loading ? <Loader2 size={18} className={styles.spin} /> : inviteMode ? <CheckCircle2 size={18} /> : <ArrowRight size={18} />}
            {loading ? 'Creating workspace...' : inviteMode ? 'Join workspace' : 'Continue'}
          </button>
        </div>
      </section>

      <WorkspacePreview templateId={templateId} compact />
    </main>
  )
}

function TeamStep({
  draft,
  invites,
  templateId,
  loading,
  error,
  onDraftChange,
  onAddInvite,
  onRemoveInvite,
  onBack,
  onSkip,
  onFinish,
}: {
  draft: { email: string; role: InviteRow['role']; department: string }
  invites: InviteRow[]
  templateId: OnboardingTemplateId
  loading: boolean
  error: string
  onDraftChange: Dispatch<SetStateAction<{ email: string; role: InviteRow['role']; department: string }>>
  onAddInvite: () => void
  onRemoveInvite: (id: string) => void
  onBack: () => void
  onSkip: () => void
  onFinish: () => void
}) {
  const template = getTemplate(templateId)

  return (
    <main className={styles.teamStage} id="main-content">
      <section className={styles.setupPanel}>
        <button type="button" className={styles.ghostButton} onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
        <p className={styles.stepKicker}>
          <User size={14} />
          Optional team setup
        </p>
        <h1>Invite the first people into the <span>operating system.</span></h1>
        <p className={styles.setupLead}>Skip this for now or queue teammates with roles and departments.</p>

        <div className={styles.inviteComposer}>
          <input
            className={styles.input}
            type="email"
            placeholder="teammate@company.com"
            value={draft.email}
            onChange={(event) => onDraftChange((current) => ({ ...current, email: event.target.value }))}
          />
          <select
            className={styles.input}
            value={draft.role}
            onChange={(event) => onDraftChange((current) => ({ ...current, role: event.target.value as InviteRow['role'] }))}
          >
            <option>Member</option>
            <option>Manager</option>
            <option>Finance</option>
          </select>
          <select
            className={styles.input}
            value={draft.department}
            onChange={(event) => onDraftChange((current) => ({ ...current, department: event.target.value }))}
          >
            <option value="">Department</option>
            {template.departments.map((department) => (
              <option key={department}>{department}</option>
            ))}
          </select>
          <button type="button" className={styles.iconButton} onClick={onAddInvite} aria-label="Add invite">
            <Plus size={18} />
          </button>
        </div>

        <div className={styles.inviteList} aria-live="polite">
          {invites.length === 0 ? (
            <div className={styles.emptyInvite}>
              <Mail size={18} />
              <span>No invites queued yet. Your workspace can launch without them.</span>
            </div>
          ) : (
            invites.map((invite) => (
              <div key={invite.id} className={styles.inviteRow}>
                <div>
                  <strong>{invite.email}</strong>
                  <span>
                    {invite.role} - {invite.department}
                  </span>
                </div>
                <button type="button" onClick={() => onRemoveInvite(invite.id)} aria-label={`Remove ${invite.email}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {error && (
          <div className={styles.errorBox} role="alert">
            {error}
          </div>
        )}

        <div className={styles.splitActions}>
          <button type="button" className={styles.secondaryCta} onClick={onSkip} disabled={loading}>
            Skip for now
          </button>
          <button type="button" className={styles.primaryCta} onClick={onFinish} disabled={loading}>
            {loading ? <Loader2 size={18} className={styles.spin} /> : <CheckCircle2 size={18} />}
            {loading ? 'Creating workspace...' : 'Create workspace'}
          </button>
        </div>
      </section>

      <WorkspacePreview templateId={templateId} compact />
    </main>
  )
}

function PlanStep({
  companyType,
  selectedPlan,
  seatCount,
  billingCycle,
  isolationEnabled,
  loading,
  onSelect,
  onSeatCountChange,
  onBillingCycleChange,
  onIsolationChange,
  onBack,
  onNext,
}: {
  companyType: CompanyType
  selectedPlan: string | null
  onSelect: (plan: string | null) => void
  seatCount: number
  billingCycle: BillingCycle
  isolationEnabled: boolean
  loading: boolean
  onSeatCountChange: (seats: number) => void
  onBillingCycleChange: (cycle: BillingCycle) => void
  onIsolationChange: (enabled: boolean) => void
  onBack: () => void
  onNext: () => void
}) {
  const { key, pricing } = getWorkspacePricing(companyType)
  const activePlan = getWorkspacePlan(companyType, selectedPlan) ?? getDefaultPlanForWorkspace(companyType)
  const activeSeatCount = clampSeatCount(pricing, seatCount)
  const total = calculateWorkspacePlanTotal({
    billingCycle,
    isolationEnabled,
    plan: activePlan,
    pricing,
    seatCount: activeSeatCount,
  })

  function selectPlan(planId: string) {
    const plan = getWorkspacePlan(companyType, planId)
    if (!plan) return
    onSelect(plan.id)
    onSeatCountChange(plan.seats ?? activeSeatCount)
    onIsolationChange(getDefaultIsolation(plan))
  }

  return (
    <main className={`${styles.setupStage} ${styles.planStage}`} id="main-content">
      <section className={`${styles.setupPanel} ${styles.planPanel}`}>
        <button type="button" className={styles.ghostButton} onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
        <p className={styles.stepKicker}>
          <CreditCard size={14} />
          {key} pricing
        </p>
        <h1>Pick the right plan for this <span>workspace.</span></h1>
        <p className={styles.setupLead}>
          Only plans for the selected workspace type are shown. Paid plans include a 14 day trial before billing starts.
        </p>

        <div className={styles.billingControls}>
          <div className={styles.segmentedControl}>
            <button type="button" className={billingCycle === 'monthly' ? styles.segmentedActive : ''} onClick={() => onBillingCycleChange('monthly')}>
              Monthly
            </button>
            <button type="button" className={billingCycle === 'annual' ? styles.segmentedActive : ''} onClick={() => onBillingCycleChange('annual')}>
              Annual - 20% off
            </button>
          </div>
          {pricing.billing === 'per-seat' && (
            <Field label="Seats" icon={<Users size={15} />}>
              <input
                className={styles.input}
                type="number"
                min={1}
                value={activeSeatCount}
                onChange={(event) => onSeatCountChange(Math.max(1, Number(event.target.value || 1)))}
              />
            </Field>
          )}
        </div>

        <div className={styles.pricingGrid}>
          {pricing.plans.map((plan) => {
            const isSelected = activePlan.id === plan.id
            const planIsolation = plan.id === activePlan.id ? isolationEnabled : getDefaultIsolation(plan)
            const planTotal = calculateWorkspacePlanTotal({
              billingCycle,
              isolationEnabled: planIsolation,
              plan,
              pricing,
              seatCount: plan.seats ?? activeSeatCount,
            })
            return (
              <article
                key={plan.id}
                className={`${styles.pricingCard} ${isSelected ? styles.pricingCardSelected : ''} ${plan.featured ? styles.pricingCardFeatured : ''}`}
              >
                {plan.featured && <span className={styles.featuredBadge}>Popular</span>}
                <button
                  type="button"
                  onClick={() => selectPlan(plan.id)}
                  aria-pressed={isSelected}
                  className={styles.pricingCardButton}
                >
                  <span className={styles.planMeta}>
                    <strong>{plan.name}</strong>
                    <span>{isFreePlan(plan) ? 'Free plan' : `$${plan.price}/${plan.unit}`}</span>
                  </span>
                  <span className={styles.planRadio} aria-hidden="true" />
                </button>
                <ul className={styles.pricingFeatures}>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={14} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <label className={`${styles.isolationToggle} ${plan.isolationLocked ? styles.isolationToggleLocked : ''}`}>
                  <input
                    type="checkbox"
                    checked={plan.id === activePlan.id ? isolationEnabled : planIsolation}
                    disabled={plan.isolationLocked || plan.id !== activePlan.id}
                    onChange={(event) => onIsolationChange(event.target.checked)}
                  />
                  <span>Isolation {plan.isolationIncluded ? 'included' : plan.isolationCost ? `+$${plan.isolationCost}/${plan.isolationUnit}` : 'off'}</span>
                </label>
                <div className={styles.planTotal}>
                  <strong>{isFreePlan(plan) ? '$0' : `$${planTotal.checkoutTotal.toFixed(0)}`}</strong>
                  <span>{billingCycle === 'annual' && !isFreePlan(plan) ? 'first year after discount' : isFreePlan(plan) ? 'no checkout' : 'estimated checkout total'}</span>
                </div>
              </article>
            )
          })}
        </div>

        <p className={styles.planFootnote}>
          {pricing.billing === 'per-seat'
            ? 'Per-seat workspaces multiply both plan price and isolation cost by the selected seat count.'
            : 'Flat-rate workspaces charge once per workspace, with isolation priced monthly when not included.'}
        </p>

        <div className={styles.checkoutSummary}>
          <strong>{activePlan.name}</strong>
          <span>
            {isFreePlan(activePlan)
              ? 'Free plan skips Dodo checkout and opens the workspace after signup.'
              : `Estimated ${billingCycle === 'annual' ? 'annual' : 'monthly'} total: $${total.checkoutTotal.toFixed(0)}.`}
          </span>
        </div>

        <div className={styles.splitActions}>
          <button type="button" className={styles.secondaryCta} onClick={onBack} disabled={loading}>
            Back
          </button>
          <button
            type="button"
            className={styles.primaryCta}
            onClick={onNext}
            disabled={!activePlan || loading}
          >
            {loading ? <Loader2 size={18} className={styles.spin} /> : isFreePlan(activePlan) ? <CheckCircle2 size={18} /> : <CreditCard size={18} />}
            {loading ? 'Creating workspace...' : isFreePlan(activePlan) ? 'Create free workspace' : 'Create workspace and checkout'}
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
    </main>
  )
}

function SuccessStep({
  companyName,
  templateId,
  invites,
  inviteMode,
  selectedPlan,
  workspaceHomePath,
  onEnter,
}: {
  companyName: string
  templateId: OnboardingTemplateId
  invites: InviteRow[]
  inviteMode: boolean
  selectedPlan: string | null
  workspaceHomePath: string
  onEnter: () => void
}) {
  const template = getTemplate(templateId)
  const planLabel = selectedPlan
    ? ({ STARTER_MONTHLY: 'Starter plan', TEAM_MONTHLY: 'Team plan', LIFETIME: 'Lifetime plan' } as Record<string, string>)[selectedPlan] ?? ''
    : 'Free trial'
  const generated = [
    `${template.departments.length} departments`,
    `${template.workflows.length} workflows`,
    `${template.dashboards.length} dashboards`,
    `${template.copilots.length} AI copilots`,
    `${template.assets.length} asset groups`,
    `${template.finance.length} finance modules`,
    'Realtime collaboration',
    `${ENTERPRISE_ERP_MODULES.length} connected ERP modules`,
    'Tenant RBAC and audit layer',
    'Event-driven automation engine',
    invites.length ? `${invites.length} queued invites` : 'Team invites ready later',
    planLabel,
  ]

  return (
    <main className={styles.successStage} id="main-content">
      <section className={styles.successPanel}>
        <div className={styles.successMark}>
          <CheckCircle2 size={34} />
        </div>
        <p className={styles.stepKicker}>
          <Zap size={14} />
          Workspace generated
        </p>
        <h1>{inviteMode ? 'Your account is ready.' : <>{companyName || 'Your company'} OS is ready for <span>approval.</span></>}</h1>
        <p>
          {selectedPlan
            ? `You selected the ${planLabel}. After signing in, head to Billing in the sidebar to complete payment and activate your subscription.`
            : `TASKIT generated the structure, defaults, copilots, dashboards, workflows, assets, finance layer, automation graph,
          RBAC, audit layer, and realtime collaboration system for a ${template.title.toLowerCase()} team. Your 7-day free trial has started.`}
        </p>

        <div className={styles.generatedGrid}>
          {generated.map((item) => (
            <span key={item}>
              <CheckCircle2 size={15} />
              {item}
            </span>
          ))}
        </div>

        <button type="button" className={styles.primaryCta} onClick={onEnter}>
          Enter {workspaceHomePath.startsWith('/erp') ? 'ERP Workspace' : 'Workspace'}
          <ChevronRight size={18} />
        </button>
      </section>

      <WorkspacePreview templateId={templateId} compact />
    </main>
  )
}

function Field({ label, icon, children }: { label: string; icon: ReactNode; required?: boolean; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span>
        {icon}
        {label}
      </span>
      {children}
    </label>
  )
}

function SegmentedControl({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className={styles.segmentedControl}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={value === option ? styles.segmentedActive : ''}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

function PasswordStrengthBar({ password }: { password: string }) {
  let met = 0
  if (password.length >= PASSWORD_MIN_LENGTH) met++
  if (/[a-z]/.test(password)) met++
  if (/[A-Z]/.test(password)) met++
  if (/[0-9]/.test(password)) met++
  if (/[^a-zA-Z0-9]/.test(password)) met++
  const pct = (met / 5) * 100
  const label = met <= 1 ? 'Weak' : met === 2 ? 'Fair' : met === 3 ? 'Strong' : 'Very Strong'
  const color = met <= 1 ? '#ef4444' : met === 2 ? '#f59e0b' : met === 3 ? '#22c55e' : '#00D4FF'

  return (
    <div className={styles.strengthBar}>
      <div className={styles.strengthBarTrack}>
        <div className={styles.strengthBarFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.strengthLabel} style={{ color }}>{label}</span>
    </div>
  )
}

function PreviewSkeleton() {
  return (
    <div className={`${styles.previewShell} ${styles.skeletonPreview}`} aria-hidden="true">
      <div />
      <div />
      <div />
    </div>
  )
}

function GenerationSkeleton({ label = 'Loading AI workspace engine' }: { label?: string }) {
  return (
    <section className={styles.generationShell} aria-live="polite">
      <div className={styles.generationOrb}>
        <Loader2 size={34} className={styles.spin} />
      </div>
      <div className={styles.generationCopy}>
        <p className={styles.stepKicker}>
          <Zap size={14} />
          {label}
        </p>
        <h1>Preparing TASKIT AI...</h1>
        <p>Loading workspace intelligence, tenant policy, automation templates, and generation system.</p>
      </div>
    </section>
  )
}

function createPendingRegistrationToken(companyName: string, email: string) {
  const companySlug = companyName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 18)
  const domain = email.split('@')[1]?.toUpperCase().replace(/[^A-Z0-9]+/g, '-') || 'DOMAIN'
  return `AI-${companySlug || 'WORKSPACE'}-${domain.slice(0, 12)}-${Date.now().toString(36).toUpperCase()}`
}
