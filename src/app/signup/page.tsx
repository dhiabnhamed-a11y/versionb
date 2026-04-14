'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap, User, Mail, Lock, Shield, Briefcase, UserCheck, ArrowRight, Loader2 } from 'lucide-react'

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
    { value: 'OWNER', label: 'Owner / Admin', desc: 'Full system control', icon: Shield },
    { value: 'MANAGER', label: 'Manager', desc: 'Assign tasks & send alerts', icon: Briefcase },
    { value: 'EMPLOYEE', label: 'Employee', desc: 'View & update tasks', icon: UserCheck },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg-primary)' }}>
      <div style={{ position: 'fixed', top: '20%', right: '12%', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 60%)', borderRadius: '50%', pointerEvents: 'none' }} />

      <div className="animate-slide-up" style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div className="icon-box" style={{ width: '52px', height: '52px', background: 'var(--accent-gradient)', margin: '0 auto 16px', boxShadow: '0 8px 24px var(--accent-glow)' }}>
            <Zap size={24} color="white" />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '6px' }} className="gradient-text">Create Account</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Join TaskForce and supercharge your team</p>
        </div>

        <div className="glass" style={{ borderRadius: '14px', padding: '28px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <User size={13} /> Full Name
              </label>
              <input className="input" placeholder="John Doe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <Mail size={13} /> Email
              </label>
              <input className="input" type="email" placeholder="you@company.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <Lock size={13} /> Password
              </label>
              <input className="input" type="password" placeholder="Min 6 characters" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Account type</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {roles.map(r => {
                  const Icon = r.icon
                  return (
                    <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${form.role === r.value ? 'rgba(59,130,246,0.35)' : 'var(--border)'}`, background: form.role === r.value ? 'rgba(59,130,246,0.06)' : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                      <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={e => setForm({ ...form, role: e.target.value })} style={{ accentColor: '#3b82f6' }} />
                      <Icon size={16} style={{ color: form.role === r.value ? 'var(--accent-hover)' : 'var(--text-muted)' }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '500' }}>{r.label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.desc}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {error && <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '13px' }}>{error}</div>}

            <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: '4px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {loading ? <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> : <><span>Create Account</span><ArrowRight size={15} /></>}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--accent-hover)', fontWeight: '600', textDecoration: 'none' }}>Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
