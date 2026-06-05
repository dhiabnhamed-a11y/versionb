import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Features',
  description: 'Explore TASKIT OS features — project management, client portal, billing, AI automation, real-time collaboration, and enterprise-grade operations tools.',
  openGraph: {
    title: 'TASKIT OS — Features',
    description: 'Explore TASKIT OS features — project management, client portal, billing, AI automation, real-time collaboration.',
  },
}

const features = [
  {
    title: 'Project & Task Management',
    description: 'Kanban boards, task assignments, priority tracking, deadlines, progress tracking, and team workload management.',
    icon: '📋',
  },
  {
    title: 'Client Portal',
    description: 'Token-based secure client portals for approvals, file sharing, comments, and real-time project visibility.',
    icon: '🔗',
  },
  {
    title: 'Billing & Invoicing',
    description: 'Send invoices, track payments, manage subscriptions, and integrate with Stripe or Dodo Payments.',
    icon: '💰',
  },
  {
    title: 'AI Workflow Automation',
    description: 'AI-powered task generation, content suggestions, anomaly detection, cash forecasting, and operational intelligence.',
    icon: '🤖',
  },
  {
    title: 'Real-Time Collaboration',
    description: 'Socket.IO-based real-time presence, typing indicators, live alerts, and instant notifications.',
    icon: '⚡',
  },
  {
    title: 'Financial Operations',
    description: 'Double-entry accounting, chart of accounts, general ledger, trial balance, journal entries, and financial reporting.',
    icon: '📊',
  },
  {
    title: 'Contract Management',
    description: 'AI-generated contracts, e-signatures, version control, clause libraries, and compliance audit trails.',
    icon: '📄',
  },
  {
    title: 'Enterprise Security',
    description: 'MFA, session revocation, audit logging, role-based access control, rate limiting, and production security guards.',
    icon: '🔒',
  },
  {
    title: 'Multi-Language Support',
    description: 'Full English, French, and Arabic (RTL) interface with locale-aware formatting and translations.',
    icon: '🌐',
  },
]

export default function FeaturesPage() {
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
          <h1 className="mb-4 text-5xl font-bold tracking-tight">Everything your agency needs to operate</h1>
          <p className="mx-auto max-w-2xl text-lg text-white/60">
            Replace project management, CRM, billing, client portal, and reporting tools with one unified platform.
          </p>
        </section>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-blue-500/50"
            >
              <span className="mb-4 block text-3xl">{feature.icon}</span>
              <h2 className="mb-2 text-lg font-semibold">{feature.title}</h2>
              <p className="text-sm leading-relaxed text-white/60">{feature.description}</p>
            </article>
          ))}
        </div>

        <section className="mt-24 rounded-2xl border border-blue-500/20 bg-blue-950/10 p-12 text-center">
          <h2 className="mb-4 text-3xl font-bold">Ready to streamline your operations?</h2>
          <p className="mb-8 text-white/60">Start your free trial. No credit card required.</p>
          <Link
            href="/signup"
            className="inline-block rounded-lg bg-blue-600 px-8 py-3 text-sm font-medium hover:bg-blue-700"
          >
            Start free trial
          </Link>
        </section>
      </main>
    </div>
  )
}
