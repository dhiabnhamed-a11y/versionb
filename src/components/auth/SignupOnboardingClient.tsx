'use client'

import { type CSSProperties, type Dispatch, type ReactNode, type SetStateAction, useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Globe2,
  Infinity,
  Loader2,
  Lock,
  Mail,
  Plus,
  ShieldCheck,
  Users,
  Zap,
  Trash2,
  User,
} from 'lucide-react'
import logo from '@/app/logo.png'
import type { CompanyType } from '@/lib/company-types'
import {
  getTemplate,
  getTemplateForCompanyType,
  ONBOARDING_STEPS,
  ONBOARDING_TEMPLATES,
  persistOnboardingProgress,
  readOnboardingProgress,
  TEMPLATE_ORDER,
  trackOnboardingEvent,
  type OnboardingStepId,
  type OnboardingTemplateId,
} from '@/lib/onboarding-engine'
import styles from './SignupOnboardingClient.module.css'
import { isBlockedOwnerEmailDomain } from '@/lib/signup-hints'
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
  form: SetupForm
  invites: InviteRow[]
}

const companySizes = ['1-10', '11-50', '51-200', '201-1000', '1000+']
const languages = ['English', 'Arabic', 'French', 'Spanish', 'German']
const countries = ['United States', 'Tunisia', 'France', 'United Kingdom', 'Germany', 'Canada', 'United Arab Emirates']

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
  const [step, setStep] = useState<OnboardingStepId>('welcome')
  const [templateId, setTemplateId] = useState<OnboardingTemplateId>(initialTemplateId)
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

  const inviteCode = initialInviteCode.trim()
  const inviteMode = Boolean(inviteCode)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
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

    setStep(saved.step === 'generating' ? 'company-type' : saved.step)
    setTemplateId(saved.templateId)
    setForm(saved.form)
    setInvites(saved.invites)
  }, [inviteMode])

  useEffect(() => {
    if (inviteMode) return
    persistOnboardingProgress({ step, templateId, form, invites } satisfies PersistedOnboarding)
  }, [form, invites, inviteMode, step, templateId])

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
          companyType: template.companyType,
          locale: navigator.language,
          legalConsent,
          onboarding: {
            companySize: form.companySize,
            preferredLanguage: form.language,
            templateId,
            queuedInvites: invites,
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
    }
    setLoading(false)

    if (!response.ok) {
      const passwordErrors = Array.isArray(data.details?.password) ? data.details.password : []
      setError(passwordErrors.length > 0 ? passwordErrors.join(' ') : data.error || 'Registration failed.')
      return
    }

    trackOnboardingEvent('registration_submitted', { templateId, inviteMode, inviteCount: invites.length })
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
            onSelect={setTemplateId}
            onSubmit={() => goTo('generating')}
            onBack={() => goTo('welcome')}
          />
        ) : (
          <CompanyTypeStep
            selected={templateId}
            onSelect={(next) => {
              setTemplateId(next)
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
            onSkip={() => submitRegistration('plan')}
            onFinish={() => submitRegistration('plan')}
          />
        )
        break
      case 'plan':
        content = (
          <PlanStep
            selectedPlan={selectedPlan}
            onSelect={setSelectedPlan}
            onNext={() => goTo('success')}
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
            onEnter={() => router.push(`/login?registered=${inviteMode ? '1' : 'pending'}${selectedPlan ? `&plan=${selectedPlan}` : ''}`)}
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

      <Link href="/login" className={styles.loginLink}>
        Sign in
      </Link>
    </header>
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
          AI-native onboarding
        </p>
        <h1 id="welcome-title">Build your company operating system in under 60 seconds.</h1>
        <p>
          TASKIT understands your company type, generates the workspace structure, and prepares the dashboards, workflows,
          copilots, and collaboration layer before you configure anything.
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
          Adaptive workspace design
        </p>
        <h1>Tell TASKIT what kind of company you run.</h1>
        <p>
          Pick the closest fit. The live preview updates instantly so you can see the operating system TASKIT will create.
        </p>

        <div className={styles.templateGrid} role="radiogroup" aria-label="Company type">
          {TEMPLATE_ORDER.map((id) => {
            const option = ONBOARDING_TEMPLATES[id]
            const isSelected = selected === id

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
                  <Zap size={16} aria-hidden="true" />
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
            <span>{template.suggestions[0]}</span>
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
          Minimal setup
        </p>
        <h1>{inviteMode ? 'Secure your invited account.' : 'Add the essentials. TASKIT handles the structure.'}</h1>
        <p className={styles.setupLead}>
          {inviteMode && invitePreview
            ? `You are joining ${invitePreview.companyName}. Finish your account and TASKIT will connect you to the workspace.`
            : 'No long configuration. Just enough context to name the workspace and prepare approval-ready defaults.'}
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
        <h1>Invite the first people into the operating system.</h1>
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
  selectedPlan,
  onSelect,
  onNext,
}: {
  selectedPlan: string | null
  onSelect: (plan: string | null) => void
  onNext: () => void
}) {
  const PLAN_DETAILS: Record<string, { name: string; price: string; period: string; icon: ReactNode; accent: string; features: string[]; note: string }> = {
    STARTER_MONTHLY: {
      name: 'Starter',
      price: '$3',
      period: '/seat/mo',
      icon: <Zap size={22} />,
      accent: '#3b82f6',
      features: ['All core modules', 'Up to 49 seats', 'AI assistant', 'Client portal'],
      note: 'Best for focused teams',
    },
    TEAM_MONTHLY: {
      name: 'Team',
      price: '$2.50',
      period: '/seat/mo',
      icon: <Users size={22} />,
      accent: '#7c3aed',
      features: ['Everything in Starter', '50+ seats', 'Volume discount', 'SLA support'],
      note: 'Best for growing teams',
    },
    LIFETIME: {
      name: 'Lifetime',
      price: '$99',
      period: '/seat',
      icon: <Infinity size={22} />,
      accent: '#f59e0b',
      features: ['Pay once, use forever', 'All future updates', 'Lifetime support', 'No recurring fees'],
      note: 'One-time access',
    },
  }

  return (
    <main className={`${styles.setupStage} ${styles.planStage}`} id="main-content">
      <section className={`${styles.setupPanel} ${styles.planPanel}`}>
        <p className={styles.stepKicker}>
          <CreditCard size={14} />
          Choose your plan
        </p>
        <h1>Pick the right plan for your team.</h1>
        <p className={styles.setupLead}>
          Start with a free trial - no credit card required. Or pick a plan now to skip the trial.
        </p>

        <div className={styles.planList}>
          {Object.entries(PLAN_DETAILS).map(([key, plan]) => {
            const isSelected = selectedPlan === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(isSelected ? null : key)}
                aria-pressed={isSelected}
                className={`${styles.planOption} ${isSelected ? styles.planOptionSelected : ''}`}
                style={{ '--plan-accent': plan.accent } as CSSProperties}
              >
                <span className={styles.planIcon}>
                  {plan.icon}
                </span>
                <div className={styles.planMeta}>
                  <strong>{plan.name}</strong>
                  <span>
                    {plan.price}
                    {plan.period}
                  </span>
                </div>
                <div className={styles.planSummary}>
                  <strong>{plan.note}</strong>
                  <span>{plan.features.slice(0, 2).join(' / ')}</span>
                </div>
                <span className={styles.planRadio} aria-hidden="true" />
              </button>
            )
          })}
        </div>

        <p className={styles.planFootnote}>
          Free trial: 7 days, up to 5 team members, no payment needed.
        </p>

        <div className={styles.splitActions}>
          <button type="button" className={styles.secondaryCta} onClick={onNext}>
            Start free trial instead
          </button>
          <button
            type="button"
            className={styles.primaryCta}
            onClick={onNext}
            disabled={!selectedPlan}
          >
            {selectedPlan ? `Continue with ${PLAN_DETAILS[selectedPlan].name}` : 'Select a plan'}
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
  onEnter,
}: {
  companyName: string
  templateId: OnboardingTemplateId
  invites: InviteRow[]
  inviteMode: boolean
  selectedPlan: string | null
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
        <h1>{inviteMode ? 'Your account is ready.' : `${companyName || 'Your company'} OS is ready for approval.`}</h1>
        <p>
          {selectedPlan
            ? `You selected the ${planLabel}. After signing in, head to Billing in the sidebar to complete payment and activate your subscription.`
            : `TASKIT generated the structure, defaults, copilots, dashboards, workflows, assets, finance layer, and realtime
          collaboration system for a ${template.title.toLowerCase()} team. Your 7-day free trial has started.`}
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
          Enter Workspace
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
        <p>Loading workspace intelligence, template registry, and generation system.</p>
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
