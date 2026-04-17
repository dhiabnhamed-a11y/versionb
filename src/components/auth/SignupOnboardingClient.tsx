'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Image from 'next/image'
import logo from '@/app/logo.png'
import {
  ArrowRight,
  Building2,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react'

type SignupRole = 'OWNER' | 'MANAGER' | 'EMPLOYEE'

type InvitePreview = {
  code: string
  invitedEmailMasked: string
  role: SignupRole
  companyName: string
  expiresAt: string
}

const signupOptions: { value: SignupRole; title: string; description: string }[] = [
  { value: 'OWNER', title: 'Create a Company', description: 'Launch a new company workspace with your business domain.' },
  { value: 'MANAGER', title: 'Join as Manager', description: 'Use an admin invite, or request approval with your company email.' },
  { value: 'EMPLOYEE', title: 'Join as Employee', description: 'Use an employee invite, or request access from your company.' },
]

export default function SignupOnboardingClient({ initialInviteCode }: { initialInviteCode: string }) {
  const router = useRouter()
  const [form, setForm] = useState({
    role: (initialInviteCode ? 'EMPLOYEE' : 'OWNER') as SignupRole,
    name: '',
    email: '',
    password: '',
    companyName: '',
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

  const isOwnerFlow = form.role === 'OWNER'
  const shouldValidateInvite = !isOwnerFlow && form.inviteCode.trim().length > 0

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
        inviteCode: form.inviteCode.trim(),
      }),
    })

    const data = (await response.json()) as { error?: string }
    setLoading(false)

    if (!response.ok) {
      setError(data.error || 'Registration failed')
      return
    }

    router.push('/login?registered=1')
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

  const submitLabel = isOwnerFlow ? 'Create company' : `Join as ${form.role === 'MANAGER' ? 'manager' : 'employee'}`

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-brand-mark">
            <Image src={logo} alt="TASKIT logo" width={64} height={64} className="h-16 w-16 object-contain" priority />
          </div>
          <h1>Enterprise onboarding with domain-aware company access.</h1>
          <p>
            Owners create companies with verified business email domains. Managers and employees join with secure invites,
            or request approval when their company domain is already linked to TASKIT.
          </p>
        </div>
        <div className="auth-brand-footer flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-1.5">
            <Layers size={12} className="text-lime-200/90" />
            Multi-role onboarding
          </span>
          <span className="hidden sm:inline" style={{ opacity: 0.35 }}>
            .
          </span>
          <span>TASKIT</span>
        </div>
      </div>

      <div className="auth-panel">
        <motion.div
          className="auth-card max-w-[500px]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-6 text-center md:text-left">
            <p className="font-display text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Get started</p>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              Choose the right onboarding path for your role.
            </p>
          </div>

          <div className="mb-5 grid gap-2.5">
            {signupOptions.map((option) => {
              const selected = form.role === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setForm((current) => ({ ...current, role: option.value }))
                    setError('')
                    setRequestAccessError('')
                    setRequestAccessSuccess('')
                  }}
                  className="rounded-[var(--radius-sm)] border px-3 py-3 text-left transition-colors"
                  style={{
                    borderColor: selected ? 'var(--accent-ring)' : 'var(--border)',
                    background: selected ? 'var(--accent-subtle)' : 'transparent',
                  }}
                >
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{option.title}</div>
                  <div className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {option.description}
                  </div>
                </button>
              )
            })}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                <User size={13} /> Full name
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
                  placeholder="Acme Operations"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  required
                  autoComplete="organization"
                />
                <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Owners must use a business email domain. Public inboxes like Gmail are blocked.
                </p>
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

            <button className="btn-primary mt-1 flex h-11 items-center justify-center gap-2" type="submit" disabled={loading}>
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
        </motion.div>
      </div>
    </div>
  )
}
