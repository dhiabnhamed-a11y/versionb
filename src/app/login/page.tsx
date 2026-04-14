'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) {
      setError('Invalid email or password')
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg-primary)' }}>
      {/* Subtle gradient blobs */}
      <div style={{ position: 'fixed', top: '15%', left: '10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 60%)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '10%', right: '15%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(6,182,212,0.04) 0%, transparent 60%)', borderRadius: '50%', pointerEvents: 'none' }} />

      <div className="animate-slide-up" style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div className="icon-box" style={{ width: '52px', height: '52px', background: 'var(--accent-gradient)', margin: '0 auto 16px', boxShadow: '0 8px 24px var(--accent-glow)' }}>
            <Zap size={24} color="white" />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '6px' }} className="gradient-text">TaskForce</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Sign in to your workspace</p>
        </div>

        {/* Form Card */}
        <div className="glass" style={{ borderRadius: '14px', padding: '28px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <Mail size={13} /> Email address
              </label>
              <input id="login-email" className="input" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <Lock size={13} /> Password
              </label>
              <input id="login-password" className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <button id="login-submit" className="btn-primary" type="submit" disabled={loading} style={{ marginTop: '4px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {loading ? <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 0.7s linear infinite' }} /> : <><span>Sign In</span><ArrowRight size={15} /></>}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" style={{ color: 'var(--accent-hover)', fontWeight: '600', textDecoration: 'none' }}>Create one</Link>
          </div>
        </div>

        <div style={{ marginTop: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', opacity: 0.7 }}>
          Sign up as <strong style={{ color: 'var(--text-secondary)' }}>Owner</strong> to get full admin access
        </div>
      </div>
    </div>
  )
}
