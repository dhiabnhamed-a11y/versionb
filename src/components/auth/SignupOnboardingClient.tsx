'use client'

import { type CSSProperties, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Image from 'next/image'
import logo from '@/app/logo.png'
import styles from './SignupOnboardingClient.module.css'
import {
  COMPANY_TYPE_OPTIONS,
  getCompanyTypeCopy,
  isAgencyCompanyType,
  normalizeCompanyType,
  type CompanyType,
} from '@/lib/company-types'
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  KeyRound,
  Layers,
  Layers3,
  Loader2,
  Lock,
  Mail,
  Music2,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react'

type SignupRole = 'OWNER' | 'MANAGER' | 'EMPLOYEE'

type InvitePreview = {
  code: string
  invitedEmailMasked: string
  role: SignupRole
  companyName: string
  companyType: CompanyType
  expiresAt: string
}

const signupOptions: { value: SignupRole; title: string; description: string }[] = [
  { value: 'OWNER', title: 'Create a Company', description: 'Launch a new company workspace with your business domain.' },
  { value: 'MANAGER', title: 'Join as Manager', description: 'Use an admin invite, or request approval with your company email.' },
  { value: 'EMPLOYEE', title: 'Join as Employee', description: 'Use an employee invite, or request access from your company.' },
]

const companyTypePresentation = {
  INDUSTRY: {
    icon: Building2,
    eyebrow: 'Operations teams',
    accent: '#0f766e',
    surface: 'rgba(15, 118, 110, 0.1)',
    outline: 'rgba(15, 118, 110, 0.22)',
    spotlight: 'rgba(45, 212, 191, 0.22)',
    audience: 'Plants, sites, stores, and departments',
    focus: 'Structured execution across separate work areas',
    flow: ['Rooms', 'Projects', 'Tasks'],
  },
  DIGITAL_AGENCY: {
    icon: BriefcaseBusiness,
    eyebrow: 'Creative studios',
    accent: '#ea580c',
    surface: 'rgba(249, 115, 22, 0.1)',
    outline: 'rgba(249, 115, 22, 0.22)',
    spotlight: 'rgba(251, 146, 60, 0.24)',
    audience: 'Design, content, social, and video teams',
    focus: 'Brief-to-upload delivery with faster approvals',
    flow: ['Campaigns', 'Briefs', 'Uploads'],
  },
  CONTENT_CREATION_AGENCY: {
    icon: Music2,
    eyebrow: 'Creator studios',
    accent: '#be123c',
    surface: 'rgba(244, 63, 94, 0.1)',
    outline: 'rgba(244, 63, 94, 0.22)',
    spotlight: 'rgba(251, 113, 133, 0.24)',
    audience: 'Music, YouTube, Spotify, and social teams',
    focus: 'Release planning with cross-channel performance',
    flow: ['Campaigns', 'Briefs', 'Channel stats'],
  },
  OTHER: {
    icon: Layers3,
    eyebrow: 'Flexible teams',
    accent: '#2563eb',
    surface: 'rgba(37, 99, 235, 0.1)',
    outline: 'rgba(37, 99, 235, 0.2)',
    spotlight: 'rgba(96, 165, 250, 0.24)',
    audience: 'General project-based collaboration',
    focus: 'Keep the core TASKIT flow and grow later',
    flow: ['Projects', 'Tasks', 'Visibility'],
  },
} as const satisfies Record<
  CompanyType,
  {
    icon: typeof Building2
    eyebrow: string
    accent: string
    surface: string
    outline: string
    spotlight: string
    audience: string
    focus: string
    flow: readonly string[]
  }
>

const roleOptionMeta: Record<SignupRole, string> = {
  OWNER: 'Creates a brand-new workspace',
  MANAGER: 'Admin access inside an existing company',
  EMPLOYEE: 'Contributor access inside an existing company',
}

export default function SignupOnboardingClient({
  initialInviteCode,
  initialCompanyType,
}: {
  initialInviteCode: string
  initialCompanyType: CompanyType
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    role: (initialInviteCode ? 'EMPLOYEE' : 'OWNER') as SignupRole,
    companyType: initialCompanyType,
    name: '',
    email: '',
    password: '',
    companyName: '',
    country: '',
    industry: '',
    registrationNumber: '',
    inviteCode: initialInviteCode.trim(),
  })
  const [loading, setLoading] = useState(false)
  const [requestingAccess, setRequestingAccess] = useState(false)
  const [validatingInvite, setValidatingInvite] = useState(false)
  const [error, setError] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [requestAccessError, setRequestAccessError] = useState('')
  const [requestAccessSuccess, setRequestAccessSuccess] = useState('')
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null)
  const [legalConsent, setLegalConsent] = useState({
    termsAccepted: false,
    privacyAccepted: false,
    marketingEmailsAccepted: false,
    aiUsageDisclosureAcknowledged: false,
  })
  const [legalTouched, setLegalTouched] = useState(false)

  const isOwnerFlow = form.role === 'OWNER'
  const selectedCompanyType = normalizeCompanyType(form.companyType)
  const companyCopy = getCompanyTypeCopy(selectedCompanyType)
  const companyTheme = companyTypePresentation[selectedCompanyType]
  const roleLocked = !isOwnerFlow && Boolean(invitePreview?.role)
  const companyTypeLocked = !isOwnerFlow && Boolean(invitePreview?.companyType)
  const shouldValidateInvite = !isOwnerFlow && form.inviteCode.trim().length > 0
  const hasRequiredLegalConsent = legalConsent.termsAccepted && legalConsent.privacyAccepted

  useEffect(() => {
    const nextCode = initialInviteCode.trim()
    if (!nextCode) return

    setForm((current) => {
      if (current.inviteCode === nextCode) return current
      return { ...current, inviteCode: nextCode }
    })
  }, [initialInviteCode])

  useEffect(() => {
    if (!shouldValidateInvite) {
      setInvitePreview(null)
      setInviteError('')
      setValidatingInvite(false)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        setValidatingInvite(true)
        setInviteError('')

        const response = await fetch(`/api/invites/${encodeURIComponent(form.inviteCode.trim())}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        const data = (await response.json()) as InvitePreview & { error?: string }

        if (!response.ok) {
          setInvitePreview(null)
          setInviteError(data.error || 'Invite not found.')
          return
        }

        setInvitePreview(data)
      } catch (fetchError) {
        if ((fetchError as Error).name !== 'AbortError') {
          setInvitePreview(null)
          setInviteError('Unable to validate invite right now.')
        }
      } finally {
        setValidatingInvite(false)
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [form.inviteCode, shouldValidateInvite])

  useEffect(() => {
    if (!invitePreview) return
    if (invitePreview.role === form.role) return

    setForm((current) => ({ ...current, role: invitePreview.role }))
  }, [invitePreview, form.role])

  useEffect(() => {
    if (!invitePreview?.companyType) return
    if (invitePreview.companyType === form.companyType) return

    setForm((current) => ({ ...current, companyType: normalizeCompanyType(invitePreview.companyType) }))
  }, [invitePreview, form.companyType])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLegalTouched(true)
    if (!hasRequiredLegalConsent) {
      setError('Accept the Terms of Service and Privacy Policy to continue.')
      return
    }

    setLoading(true)
    setError('')
    setRequestAccessError('')
    setRequestAccessSuccess('')

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        companyName: form.companyName.trim(),
        country: form.country.trim(),
        industry: form.industry.trim(),
        registrationNumber: form.registrationNumber.trim(),
        inviteCode: form.inviteCode.trim(),
        companyType: form.companyType,
        locale: navigator.language,
        legalConsent,
      }),
    })

    const data = (await response.json()) as { error?: string }
    setLoading(false)

    if (!response.ok) {
      setError(data.error || 'Registration failed')
      return
    }

    router.push(`/login?registered=${isOwnerFlow ? 'pending' : '1'}`)
  }

  async function handleRequestAccess() {
    if (!form.name.trim() || !form.email.trim()) {
      setRequestAccessError('Enter your name and company email before requesting access.')
      return
    }

    setRequestingAccess(true)
    setRequestAccessError('')
    setRequestAccessSuccess('')
    setError('')

    const response = await fetch('/api/access-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
      }),
    })

    const data = (await response.json()) as { companyName?: string; error?: string }
    setRequestingAccess(false)

    if (!response.ok) {
      setRequestAccessError(data.error || 'Unable to request access.')
      return
    }

    setRequestAccessSuccess(`Request sent to ${data.companyName}. An admin can now approve and issue your invite.`)
  }

  const inviteRoleLabel =
    invitePreview?.role === 'MANAGER' ? 'Manager access' : invitePreview?.role === 'EMPLOYEE' ? 'Employee access' : 'Owner access'

  const submitLabel = isOwnerFlow
    ? 'Submit company for approval'
    : `Join as ${form.role === 'MANAGER' ? 'manager' : 'employee'}`

  const companyPlaceholder =
    selectedCompanyType === 'INDUSTRY'
      ? 'North Plant Operations'
      : selectedCompanyType === 'DIGITAL_AGENCY'
        ? 'Studio Nova'
        : selectedCompanyType === 'CONTENT_CREATION_AGENCY'
          ? 'Waveform Content Co.'
        : 'Acme Operations'

  const workflowPreviewStyle = {
    '--company-accent': companyTheme.accent,
    '--company-spotlight': companyTheme.spotlight,
  } as CSSProperties

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-brand-mark">
            <Image src={logo} alt="TASKIT logo" width={64} height={64} className="h-16 w-16 object-contain" priority />
          </div>
          <h1>{companyCopy.signupTitle}</h1>
          <p>{companyCopy.signupDescription}</p>

          <div
            className="mt-8 rounded-[var(--radius-md)] border p-4"
            style={{
              borderColor: 'rgba(255, 255, 255, 0.12)',
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/80">{companyCopy.workspaceLabel}</div>
            <div className="mt-2 text-lg font-semibold text-white">{companyCopy.overviewTitle}</div>
            <div className="mt-2 text-sm leading-6 text-slate-300">{companyCopy.overviewDescription}</div>
            <div className="mt-4 grid gap-2">
              {companyCopy.bullets.map((bullet) => (
                <div key={bullet} className="flex items-center gap-2 text-sm text-slate-200">
                  <CheckCircle2 size={14} className="text-lime-200" />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="auth-brand-footer flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-1.5">
            <Layers size={12} className="text-lime-200/90" />
            {companyCopy.workspaceLabel}
          </span>
          <span className="hidden sm:inline" style={{ opacity: 0.35 }}>
            .
          </span>
          <span>TASKIT</span>
        </div>
      </div>

      <div className="auth-panel">
        <motion.div
          className="auth-card max-w-[620px]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={styles.introBlock}>
            <div className={styles.introCaption}>
              <Sparkles size={12} />
              Company-aware onboarding
            </div>
            <p className={styles.introTitle}>Get started</p>
            <p className={styles.introDescription}>
              Start with the workflow your company actually needs, then finish the account setup below.
            </p>
          </div>

          <section className={`${styles.sectionBlock} ${styles.sectionBlockPrimary}`}>
            <div className={styles.sectionHeader}>
              <div>
                <div className={styles.stepBadge}>Step 1</div>
                <div className={styles.sectionTitle}>Choose your company type</div>
                <p className={styles.sectionDescription}>
                  This shapes the workspace structure owners create and the operating model invited teammates will join.
                </p>
              </div>

              <div className={`${styles.contextChip} ${companyTypeLocked ? styles.contextChipLocked : ''}`}>
                {companyTypeLocked ? (
                  <>
                    <Lock size={12} />
                    Invite locked
                  </>
                ) : (
                  <>
                    <Sparkles size={12} />
                    Tailored onboarding
                  </>
                )}
              </div>
            </div>

            <div className={styles.companyGrid}>
              {COMPANY_TYPE_OPTIONS.map((option) => {
                const selected = form.companyType === option.value
                const theme = companyTypePresentation[option.value]
                const Icon = theme.icon
                const optionStyle = {
                  '--company-accent': theme.accent,
                  '--company-surface': theme.surface,
                  '--company-outline': theme.outline,
                  '--company-spotlight': theme.spotlight,
                } as CSSProperties

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={companyTypeLocked}
                    aria-pressed={selected}
                    onClick={() => {
                      setForm((current) => ({ ...current, companyType: option.value }))
                      setError('')
                    }}
                    className={`${styles.companyCard} ${selected ? styles.companyCardSelected : ''}`}
                    style={optionStyle}
                  >
                    <div className={styles.companyCardTop}>
                      <div className={styles.companyIconWrap}>
                        <Icon size={20} />
                      </div>
                      <div className={styles.companyCardHeading}>
                        <span className={styles.companyEyebrow}>{theme.eyebrow}</span>
                        <span className={styles.companyLabel}>{option.label}</span>
                      </div>
                      <div className={styles.companyStatus}>
                        {selected ? <ShieldCheck size={14} /> : <Sparkles size={14} />}
                        <span>{selected ? 'Selected' : 'Choose'}</span>
                      </div>
                    </div>

                    <div className={styles.companyWorkspaceTag}>{option.workspaceLabel}</div>
                    <p className={styles.companyTitle}>{option.title}</p>
                    <p className={styles.companyDescription}>{option.description}</p>

                    <div className={styles.flowRow}>
                      {theme.flow.map((step, index) => (
                        <div key={`${option.value}-${step}`} className={styles.flowStepGroup}>
                          {index > 0 && <ArrowRight size={13} className={styles.flowArrow} />}
                          <span className={styles.flowPill}>{step}</span>
                        </div>
                      ))}
                    </div>

                    <div className={styles.companyMeta}>
                      <span className={styles.metaChip}>Best for {theme.audience}</span>
                      <span className={styles.metaChip}>{theme.focus}</span>
                    </div>

                    <div className={styles.bulletGrid}>
                      {option.bullets.map((bullet) => (
                        <div key={bullet} className={styles.bulletItem}>
                          <CheckCircle2 size={14} className={styles.bulletItemIcon} />
                          <span>{bullet}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className={styles.workflowPreview} style={workflowPreviewStyle}>
              <div className={styles.workflowHeader}>
                <div>
                  <div className={styles.workflowEyebrow}>Selected workflow</div>
                  <div className={styles.workflowTitle}>{companyCopy.overviewTitle}</div>
                </div>
                <div className={styles.workflowBadge}>{companyCopy.workspaceLabel}</div>
              </div>

              <p className={styles.workflowDescription}>{companyCopy.overviewDescription}</p>

              <div className={styles.workflowStats}>
                <div className={styles.workflowStat}>
                  <div className={styles.workflowStatLabel}>Structure</div>
                  <div className={styles.workflowStatValue}>{companyTheme.flow.join(' -> ')}</div>
                </div>
                <div className={styles.workflowStat}>
                  <div className={styles.workflowStatLabel}>Best for</div>
                  <div className={styles.workflowStatValue}>{companyTheme.audience}</div>
                </div>
                <div className={styles.workflowStat}>
                  <div className={styles.workflowStatLabel}>Focus</div>
                  <div className={styles.workflowStatValue}>{companyTheme.focus}</div>
                </div>
              </div>
            </div>
          </section>

          {companyTypeLocked && (
            <div className={styles.lockNotice}>
              <Lock size={14} className={styles.lockNoticeIcon} />
              <span>This workspace type comes from the invite you are joining, so it is locked for this signup.</span>
            </div>
          )}

          <section className={`${styles.sectionBlock} ${styles.roleBlock}`}>
            <div className={styles.sectionHeader}>
              <div>
                <div className={styles.stepBadge}>Step 2</div>
                <div className={styles.sectionTitle}>Choose how you&apos;re joining</div>
                <p className={styles.sectionDescription}>
                  Owners create a new workspace. Managers and employees join an existing company with invite-based access.
                </p>
              </div>

              {roleLocked && (
                <div className={`${styles.contextChip} ${styles.contextChipLocked}`}>
                  <Lock size={12} />
                  Invite role
                </div>
              )}
            </div>

            <div className={styles.roleGrid}>
              {signupOptions.map((option) => {
                const selected = form.role === option.value

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={roleLocked}
                    aria-pressed={selected}
                    onClick={() => {
                      setForm((current) => ({ ...current, role: option.value }))
                      setError('')
                      setRequestAccessError('')
                      setRequestAccessSuccess('')
                    }}
                    className={`${styles.roleCard} ${selected ? styles.roleCardSelected : ''}`}
                  >
                    <div className={styles.roleCardTop}>
                      <div>
                        <div className={styles.roleTitle}>{option.title}</div>
                        <div className={styles.roleDescription}>{option.description}</div>
                      </div>
                      {selected && <ShieldCheck size={16} className="text-[var(--accent)]" />}
                    </div>
                    <div className={styles.roleTag}>{roleOptionMeta[option.value]}</div>
                  </button>
                )
              })}
            </div>
          </section>

          {roleLocked && (
            <div className={styles.lockNotice}>
              <Lock size={14} className={styles.lockNoticeIcon} />
              <span>The invite decides the role for this signup. Clear the invite code if you want to switch to another path.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                <User size={13} /> {isOwnerFlow ? 'Owner name' : 'Full name'}
              </label>
              <input
                className="input"
                placeholder="Alex Morgan"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoComplete="name"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                <Mail size={13} /> Work email
              </label>
              <input
                className="input"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                <Lock size={13} /> Password
              </label>
              <input
                className="input"
                type="password"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {isOwnerFlow ? (
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  <Building2 size={13} /> Company name
                </label>
                <input
                  className="input"
                  placeholder={companyPlaceholder}
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  required
                  autoComplete="organization"
                />
                <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
                  <div>
                    <label
                      className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <Building2 size={13} /> Country
                    </label>
                    <input
                      className="input"
                      placeholder="Tunisia"
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                      required
                      autoComplete="country-name"
                    />
                  </div>

                  <div>
                    <label
                      className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <Layers3 size={13} /> Industry
                    </label>
                    <input
                      className="input"
                      placeholder="Manufacturing"
                      value={form.industry}
                      onChange={(e) => setForm({ ...form, industry: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    <ShieldCheck size={13} /> Company registration number
                  </label>
                  <input
                    className="input"
                    placeholder="RC-2026-001245"
                    value={form.registrationNumber}
                    onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className={styles.fieldHint}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Owners must use a business email domain. Public inboxes like Gmail are blocked, and each company is reviewed manually by a Super Admin.
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {selectedCompanyType === 'INDUSTRY'
                      ? 'Your workspace will start with rooms, then projects inside each room, then tasks inside each project.'
                      : isAgencyCompanyType(selectedCompanyType)
                        ? 'Your workspace will start with campaigns, briefs, employee execution, deliverable uploads, and channel performance tracking.'
                        : 'Your workspace will keep the same TASKIT interface you already use today.'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    After submission, the company stays pending until the Super Admin verifies the registration number and approves activation.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  <KeyRound size={13} /> Invite code
                </label>
                <input
                  className="input"
                  placeholder={`Paste your ${form.role === 'MANAGER' ? 'manager' : 'employee'} invite code`}
                  value={form.inviteCode}
                  onChange={(e) => setForm({ ...form, inviteCode: e.target.value })}
                  autoComplete="one-time-code"
                  required
                />
                {(validatingInvite || invitePreview || inviteError) && (
                  <div className="mt-2 rounded-[var(--radius-sm)] border px-3 py-2.5 text-xs" style={{ borderColor: 'var(--border)' }}>
                    {validatingInvite ? (
                      <div className="flex items-center gap-2 text-[var(--text-muted)]">
                        <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 0.7s linear infinite' }} />
                        Validating invite...
                      </div>
                    ) : invitePreview ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                          <ShieldCheck size={14} className="text-[var(--accent)]" />
                          Invite ready
                        </div>
                        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                          <Building2 size={13} />
                          {invitePreview.companyName}
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          {inviteRoleLabel} for {invitePreview.invitedEmailMasked}
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>{getCompanyTypeCopy(invitePreview.companyType).label} workspace</div>
                      </div>
                    ) : (
                      <div style={{ color: '#b91c1c' }}>{inviteError}</div>
                    )}
                  </div>
                )}

                <div className="mt-3 rounded-[var(--radius-sm)] border px-3 py-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">No invite yet?</div>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    If your company domain is already linked to TASKIT, you can request approval and an admin can send you an
                    invite.
                  </p>
                  <button
                    type="button"
                    onClick={handleRequestAccess}
                    disabled={requestingAccess}
                    className="btn-secondary mt-3"
                    style={{ fontSize: '12px', padding: '8px 12px' }}
                  >
                    {requestingAccess ? 'Submitting...' : 'Request company access'}
                  </button>
                </div>
              </div>
            )}

            {requestAccessError && (
              <div
                className="rounded-[var(--radius-sm)] border px-3.5 py-2.5 text-sm"
                style={{
                  background: 'rgba(239, 68, 68, 0.06)',
                  borderColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#b91c1c',
                }}
              >
                {requestAccessError}
              </div>
            )}

            {requestAccessSuccess && (
              <div
                className="rounded-[var(--radius-sm)] border px-3.5 py-2.5 text-sm"
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  borderColor: 'rgba(16, 185, 129, 0.2)',
                  color: '#047857',
                }}
              >
                {requestAccessSuccess}
              </div>
            )}

            {error && (
              <div
                className="rounded-[var(--radius-sm)] border px-3.5 py-2.5 text-sm"
                style={{
                  background: 'rgba(239, 68, 68, 0.06)',
                  borderColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#b91c1c',
                }}
              >
                {error}
              </div>
            )}

            <section
              className={`${styles.legalConsentBox} ${legalTouched && !hasRequiredLegalConsent ? styles.legalConsentBoxInvalid : ''}`}
              aria-labelledby="signup-legal-consent-title"
            >
              <div className={styles.legalConsentHeader}>
                <ShieldCheck size={16} />
                <div>
                  <div id="signup-legal-consent-title" className={styles.legalConsentTitle}>
                    Legal consent
                  </div>
                  <p className={styles.legalConsentDescription}>
                    Required before TASKIT creates your account and stores the acceptance record.
                  </p>
                </div>
              </div>

              <label className={styles.legalCheckboxRow}>
                <input
                  type="checkbox"
                  checked={hasRequiredLegalConsent}
                  aria-describedby="signup-legal-consent-help signup-legal-consent-error"
                  onBlur={() => setLegalTouched(true)}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setLegalConsent((current) => ({
                      ...current,
                      termsAccepted: checked,
                      privacyAccepted: checked,
                      aiUsageDisclosureAcknowledged: checked,
                    }))
                    if (checked) setError('')
                  }}
                />
                <span>
                  I agree to the{' '}
                  <Link href="/terms" target="_blank" rel="noopener noreferrer">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </Link>
                  , and acknowledge the{' '}
                  <Link href="/ai-transparency" target="_blank" rel="noopener noreferrer">
                    AI Transparency Policy
                  </Link>
                  .
                </span>
              </label>

              <label className={styles.legalCheckboxRow}>
                <input
                  type="checkbox"
                  checked={legalConsent.marketingEmailsAccepted}
                  onChange={(event) => {
                    setLegalConsent((current) => ({ ...current, marketingEmailsAccepted: event.target.checked }))
                  }}
                />
                <span>Send me occasional product updates and compliance notices by email.</span>
              </label>

              <p id="signup-legal-consent-help" className={styles.legalConsentFinePrint}>
                TASKIT records the accepted document versions, timestamp, IP address, user agent, and locale for audit evidence.
              </p>

              {legalTouched && !hasRequiredLegalConsent && (
                <p id="signup-legal-consent-error" className={styles.legalConsentError} role="alert">
                  Terms of Service and Privacy Policy acceptance is required.
                </p>
              )}
            </section>

            <button
              className="btn-primary mt-1 flex h-11 items-center justify-center gap-2"
              type="submit"
              disabled={loading || !hasRequiredLegalConsent}
              aria-disabled={loading || !hasRequiredLegalConsent}
            >
              {loading ? (
                <Loader2 size={18} style={{ animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <>
                  <span>{submitLabel}</span>
                  <ArrowRight size={16} strokeWidth={2.25} />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Already registered?{' '}
            <Link href="/login" className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
          <div className={styles.legalFooterLinks} aria-label="Legal links">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/cookies">Cookies</Link>
            <Link href="/ai-transparency">AI Transparency</Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
