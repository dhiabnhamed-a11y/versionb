'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Hexagon, User, Mail, Lock, Shield, Briefcase, UserCheck, ArrowRight, Loader2, Layers } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'OWNER' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) setError(data.error || 'Registration failed')
    else router.push('/login?registered=1')
  }

  const roles = [
    { value: 'OWNER', label: 'Owner', desc: 'Full workspace control', icon: Shield },
    { value: 'MANAGER', label: 'Manager', desc: 'Projects, tasks & alerts', icon: Briefcase },
    { value: 'EMPLOYEE', label: 'Member', desc: 'Focus on your assignments', icon: UserCheck },
  ]

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-brand-mark">
            <Hexagon size={26} color="white" strokeWidth={2.2} />
          </div>
          <h1>One workspace. Every commitment, visible.</h1>
          <p>
            Onboard your organization in minutes. Tasked keeps roles, projects, and urgent signals aligned — without
            another generic dashboard clone.
          </p>
        </div>
        <div className="auth-brand-footer flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-1.5">
            <Layers size={12} className="text-amber-400/90" />
            Role-aware from day one
          </span>
          <span className="hidden sm:inline" style={{ opacity: 0.35 }}>
            ·
          </span>
          <span>Tasked</span>
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
              Create your account
            </p>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              Choose a role — you can refine permissions later.
            </p>
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
                <Mail size={13} /> Email
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
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Account type
              </label>
              <div className="flex flex-col gap-2">
                {roles.map((r) => {
                  const Icon = r.icon
                  const selected = form.role === r.value
                  return (
                    <label
                      key={r.value}
                      className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-2.5 transition-colors"
                      style={{
                        borderColor: selected ? 'var(--accent-ring)' : 'var(--border)',
                        background: selected ? 'var(--accent-subtle)' : 'transparent',
                      }}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={r.value}
                        checked={selected}
                        onChange={(e) => setForm({ ...form, role: e.target.value })}
                        className="accent-teal-600"
                      />
                      <Icon size={17} style={{ color: selected ? 'var(--accent)' : 'var(--text-muted)' }} />
                      <div>
                        <div className="text-sm font-semibold">{r.label}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {r.desc}
                        </div>
                      </div>
                    </label>
                  )
                })}
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

            <button className="btn-primary mt-1 flex h-11 items-center justify-center gap-2" type="submit" disabled={loading}>
              {loading ? (
                <Loader2 size={18} style={{ animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <>
                  <span>Get started</span>
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
