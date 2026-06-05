import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Security',
  description: 'TASKIT OS enterprise-grade security. MFA, session revocation, RBAC, audit logging, encryption, and compliance-ready infrastructure.',
  openGraph: {
    title: 'TASKIT OS — Security',
    description: 'Enterprise-grade security for your operations. MFA, RBAC, audit logs, encryption.',
  },
}

const controls = [
  {
    title: 'Authentication',
    items: [
      'bcrypt password hashing (12 rounds)',
      'TOTP multi-factor authentication',
      'Brute-force protection with account lockout',
      'Session JTI revocation',
      'Secure HTTP-only cookies',
    ],
  },
  {
    title: 'Authorization',
    items: [
      'Role-based access control (RBAC)',
      'Permission-based resource access',
      'Tenant-scoped data isolation',
      'Super admin governance controls',
      'API request signing (HMAC)',
    ],
  },
  {
    title: 'Data Protection',
    items: [
      'Encrypted connections (TLS 1.3)',
      'Database connection pooling with SSL',
      'Environment variable validation',
      'Cloudinary secure media delivery',
      'Camera credential encryption',
    ],
  },
  {
    title: 'Compliance',
    items: [
      'Full audit logging',
      'Legal consent management',
      'GDPR-compliant policies',
      'Data processing agreement (DPA)',
      'Acceptable use policy enforcement',
    ],
  },
]

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-[#07090e] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight">TASKIT</Link>
          <nav className="flex items-center gap-6 text-sm text-white/60">
            <Link href="/features">Features</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/login" className="text-white">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-24">
        <section className="mb-16 text-center">
          <h1 className="mb-4 text-5xl font-bold tracking-tight">Enterprise-grade security</h1>
          <p className="mx-auto max-w-2xl text-lg text-white/60">
            Your data is protected by industry-standard security controls, encryption, and access management.
          </p>
        </section>

        <div className="grid gap-8 md:grid-cols-2">
          {controls.map((control) => (
            <article
              key={control.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-8"
            >
              <h2 className="mb-4 text-xl font-bold">{control.title}</h2>
              <ul className="space-y-3">
                {control.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-white/70">
                    <span className="mt-0.5 text-green-400">&#10003;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <section className="mt-16 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <h2 className="mb-2 text-xl font-bold">Vulnerability disclosure</h2>
          <p className="text-sm text-white/60">
            Report security issues to <a href="mailto:security@taskit.app" className="text-blue-400 underline">security@taskit.app</a>.
            We practice responsible disclosure and aim to resolve confirmed issues within 72 hours.
          </p>
        </section>

        <div className="mt-8 text-center text-xs text-white/30">
          <p>Last security review: June 2026</p>
        </div>
      </main>
    </div>
  )
}
