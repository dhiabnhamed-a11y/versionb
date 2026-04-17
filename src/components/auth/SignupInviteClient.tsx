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

type InvitePreview = {
  code: string
  invitedEmailMasked: string
  role: string
  companyName: string
  expiresAt: string
}

export default function SignupInviteClient({ initialInviteCode }: { initialInviteCode: string }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    inviteCode: initialInviteCode.trim(),
  })
  const [loading, setLoading] = useState(false)
  const [validatingInvite, setValidatingInvite] = useState(false)
  const [error, setError] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null)

  useEffect(() => {
    const nextCode = initialInviteCode.trim()
    if (!nextCode) return

    setForm((current) => {
      if (current.inviteCode === nextCode) return current
      return { ...current, inviteCode: nextCode }
    })
  }, [initialInviteCode])

  useEffect(() => {
    const inviteCode = form.inviteCode.trim()
    if (!inviteCode) {
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

        const response = await fetch(`/api/invites/${encodeURIComponent(inviteCode)}`, {
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
  }, [form.inviteCode])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = (await response.json()) as { error?: string }
    setLoading(false)

    if (!response.ok) {
      setError(data.error || 'Registration failed')
      return
    }

    router.push('/login?registered=1')
  }

  const roleLabel =
    invitePreview?.role === 'MANAGER' ? 'Admin access' : invitePreview?.role === 'OWNER' ? 'Owner access' : 'Employee access'

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-brand-mark">
            <Image src={logo} alt="TASKIT logo" width={64} height={64} className="h-16 w-16 object-contain" priority />
          </div>
          <h1>Secure onboarding for every company workspace.</h1>
          <p>
            TASKIT access is invite-only. Use your company-issued code or invite link to join the right workspace with the
            right permissions from the start.
          </p>
        </div>
        <div className="auth-brand-footer flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-1.5">
            <Layers size={12} className="text-lime-200/90" />
            Invite-first onboarding
          </span>
          <span className="hidden sm:inline" style={{ opacity: 0.35 }}>
            .
          </span>
          <span>TASKIT</span>
        </div>
      </div>

      <div className="auth-panel">
        <motion.div
          className="auth-card max-w-[460px]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-6 text-center md:text-left">
            <p className="font-display text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              Join your workspace
            </p>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              Your company admin controls access with one-time invite codes.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                <KeyRound size={13} /> Invite code
              </label>
              <input
                className="input"
                placeholder="Paste your invite code"
                value={form.inviteCode}
                onChange={(e) => setForm({ ...form, inviteCode: e.target.value })}
                required
                autoComplete="one-time-code"
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
                        {roleLabel} for {invitePreview.invitedEmailMasked}
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#b91c1c' }}>{inviteError}</div>
                  )}
                </div>
              )}
            </div>

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
                  <span>Join TASKIT</span>
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
