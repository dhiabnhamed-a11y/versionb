'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Image from 'next/image'
import logo from '@/app/logo.png'
import { Mail, Lock, ArrowRight, Loader2, Sparkles, Eye, EyeOff } from 'lucide-react'

async function readLoginCheckData(response: Response) {
  return (await response.json().catch(() => ({}))) as { error?: string }
}

function getSignInErrorMessage(error?: string | null) {
  if (error === 'Configuration') {
    return 'Sign in is not configured correctly on the server. Check the production database and auth environment variables.'
  }

  return 'Invalid email or password'
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const registrationState = searchParams.get('registered')
  const inactiveReason = searchParams.get('reason')

  const notice =
    registrationState === 'pending'
      ? 'Registration submitted. A Super Admin must approve your company before you can sign in.'
      : registrationState === '1'
        ? 'Your account was created successfully.'
        : inactiveReason === 'inactive'
          ? 'This account is not currently active. Please contact the Super Admin.'
          : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const trimmedEmail = email.trim()
    const loginCheck = await fetch('/api/auth/login-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail, password }),
    }).catch(() => null)

    if (!loginCheck) {
      setLoading(false)
      setError('Unable to reach the sign-in service. Please try again.')
      return
    }

    const loginCheckData = await readLoginCheckData(loginCheck)
    if (!loginCheck.ok) {
      setLoading(false)
      setError(loginCheckData.error || getSignInErrorMessage(loginCheck.status >= 500 ? 'Configuration' : null))
      return
    }

    const res = await signIn('credentials', { email: trimmedEmail, password, redirect: false }).catch(() => null)
    setLoading(false)
    if (!res || res.error) {
      setError(getSignInErrorMessage(res?.error))
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-brand-mark">
            <Image src={logo} alt="TASKIT logo" width={64} height={64} className="h-16 w-16 object-contain" priority />
          </div>
          <h1>Calm control for how your team ships work.</h1>
          <p>
            TASKIT brings projects, ownership, and live signals into one refined surface so nothing important gets lost in
            the noise.
          </p>
        </div>
        <div className="auth-brand-footer flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-cyan-200/80" />
            Crafted for clarity
          </span>
          <span className="hidden sm:inline" style={{ opacity: 0.35 }}>
            .
          </span>
          <span>Copyright TASKIT</span>
        </div>
      </div>

      <div className="auth-panel">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-8 text-center md:text-left">
            <p className="font-display text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Welcome back</p>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              Sign in to your approved workspace
            </p>
          </div>

          {notice && (
            <div
              className="mb-4 rounded-[var(--radius-sm)] border px-3.5 py-2.5 text-sm"
              style={{
                background: 'rgba(19, 141, 136, 0.06)',
                borderColor: 'rgba(19, 141, 136, 0.16)',
                color: 'var(--text-secondary)',
              }}
            >
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                <Mail size={13} strokeWidth={2} /> Email
              </label>
              <input
                id="login-email"
                className="input"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                <Lock size={13} strokeWidth={2} /> Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  className="input pr-11"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
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

            <button
              id="login-submit"
              className="btn-primary mt-1 flex h-11 items-center justify-center gap-2"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight size={16} strokeWidth={2.25} />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Have an invite?{' '}
            <Link href="/signup" className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline">
              Join your workspace
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}
