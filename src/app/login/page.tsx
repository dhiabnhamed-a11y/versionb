'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Image from 'next/image'
import logo from '@/app/logo.png'
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

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

    const res = await signIn('credentials', {
      email: trimmedEmail,
      password,
      redirect: false,
      callbackUrl: '/dashboard',
    }).catch(() => null)
    if (!res || res.error) {
      setLoading(false)
      setError(getSignInErrorMessage(res?.error))
    } else {
      window.location.assign(res.url || '/dashboard')
    }
  }

  return (
    <div className="auth-shell">
      <header className="auth-header">
        <Link href="/" className="auth-logo-link" aria-label="TASKIT home">
          <Image src={logo} alt="" width={38} height={38} priority />
          <span>TASKIT</span>
        </Link>
        <Link href="/signup" className="auth-header-link">
          Create workspace
          <ArrowRight size={15} />
        </Link>
      </header>

      <div className="auth-backdrop" aria-hidden="true">
        <div className="auth-signal-grid">
          {Array.from({ length: 42 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>

      <main className="auth-stage" id="main-content">
        <section className="auth-brand" aria-labelledby="login-title">
          <div className="auth-brand-mark">
            <Image src={logo} alt="TASKIT logo" width={72} height={72} priority />
          </div>
          <p className="auth-kicker">
            <Bot size={14} />
            Workspace command center
          </p>
          <h1>Calm control for every operating signal.</h1>
          <p>
            Sign in to the same structured TASKIT operating system built during onboarding, with projects, alerts,
            approvals, finance, and realtime work in one focused surface.
          </p>

          <div className="auth-proof-grid" aria-label="Workspace capabilities">
            <span>
              <CheckCircle2 size={15} />
              Realtime workspace
            </span>
            <span>
              <ShieldCheck size={15} />
              Secure approval flow
            </span>
            <span>
              <Sparkles size={15} />
              AI-native operations
            </span>
          </div>
        </section>

        <div className="auth-panel">
          <motion.section
            className="auth-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            aria-label="Sign in"
          >
            <div className="auth-card-head">
              <p>Welcome back</p>
              <h2 id="login-title">Sign in to your approved workspace.</h2>
            </div>

            {notice && (
              <div className="auth-alert auth-alert-info">
                <ShieldCheck size={16} />
                {notice}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label htmlFor="login-email">
                  <Mail size={14} strokeWidth={2} /> Email
                </label>
                <input
                  id="login-email"
                  className="auth-input"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="auth-field">
                <label htmlFor="login-password">
                  <Lock size={14} strokeWidth={2} /> Password
                </label>
                <div className="auth-password-wrap">
                  <input
                    id="login-password"
                    className="auth-input"
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
                    className="auth-eye-button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="auth-alert auth-alert-danger">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <button id="login-submit" className="auth-primary" type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 size={18} className="auth-spin" />
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight size={16} strokeWidth={2.25} />
                  </>
                )}
              </button>
            </form>

            <p className="auth-card-footer">
              Have an invite? <Link href="/signup">Join your workspace</Link>
            </p>
          </motion.section>

          <aside className="auth-mini-preview" aria-label="Workspace preview">
            <div className="auth-mini-topbar">
              <span />
              <span />
              <span />
              <strong>Live OS</strong>
            </div>
            <div className="auth-mini-row">
              <span>Inbox</span>
              <strong>18</strong>
            </div>
            <div className="auth-mini-row">
              <span>Approvals</span>
              <strong>6</strong>
            </div>
            <div className="auth-mini-row">
              <span>Healthy workflows</span>
              <strong>94%</strong>
            </div>
          </aside>
        </div>
      </main>
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
