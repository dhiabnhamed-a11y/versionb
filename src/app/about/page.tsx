import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About',
  description: 'TASKIT OS is an all-in-one agency operations platform built for modern teams. Project management, client portal, billing, AI automation, and real-time collaboration.',
  openGraph: {
    title: 'About TASKIT OS',
    description: 'TASKIT OS is an all-in-one agency operations platform built for modern teams.',
  },
}

export default function AboutPage() {
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

      <main className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="mb-6 text-5xl font-bold tracking-tight">About TASKIT</h1>

        <section className="space-y-6 text-lg leading-relaxed text-white/70">
          <p>
            TASKIT is an all-in-one operations platform purpose-built for agencies, service businesses, and operations teams.
            We replace the fragmented stack of project management tools, CRMs, billing software, client portals, and reporting
            dashboards with one unified surface.
          </p>

          <p>
            Our thesis is simple: every client promise should connect to the work being done, the people responsible,
            the approval trail, the invoice, and the financial result. No more context switching. No more data silos.
          </p>

          <h2 className="pt-6 text-2xl font-bold text-white">Our mission</h2>
          <p>
            Give every operations team a single source of truth for managing work, clients, finances, and team capacity.
            We believe the best tools are the ones you don&apos;t have to think about — they just work.
          </p>

          <h2 className="pt-6 text-2xl font-bold text-white">Why TASKIT?</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Built for real-world agency workflows, not generic project management</li>
            <li>Client portal, billing, and approvals built in — no integrations needed</li>
            <li>AI-powered automation that actually understands your operations</li>
            <li>Real-time collaboration with presence, alerts, and live updates</li>
            <li>Enterprise-grade security with MFA, audit logs, and RBAC</li>
            <li>Multi-language support for global teams (English, French, Arabic)</li>
          </ul>
        </section>
      </main>
    </div>
  )
}
