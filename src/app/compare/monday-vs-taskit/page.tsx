import type { Metadata } from 'next'
import Link from 'next/link'
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema'
import { FaqSchema } from '@/components/seo/FaqSchema'

export const metadata: Metadata = {
  title: 'Monday.com vs TASKIT OS — Comparison for Agency Operations',
  description: 'See how TASKIT OS compares to Monday.com for agency operations. Built-in billing, client portal, AI automation, and real-time collaboration in one platform.',
  openGraph: {
    title: 'Monday.com vs TASKIT OS — Which is better for your agency?',
    description: 'Compare Monday.com and TASKIT OS for agency operations, project management, billing, and client portals.',
  },
}

export default function MondayVsTaskitPage() {
  return (
    <div className="min-h-screen bg-[#07090e] text-white">
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Compare', url: '/compare' },
        { name: 'Monday.com vs TASKIT OS', url: '/compare/monday-vs-taskit' },
      ]} />

      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight">TASKIT</Link>
          <nav className="flex items-center gap-6 text-sm text-white/60">
            <Link href="/features">Features</Link>
            <Link href="/pricing">Pricing</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">Monday.com vs TASKIT OS</h1>
        <p className="mb-12 text-lg text-white/60">
          Both platforms help teams manage work, but TASKIT OS goes further with built-in billing, client portals, AI automation, and financial operations — features Monday.com requires paid integrations for.
        </p>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="p-4 text-left font-medium">Feature</th>
                <th className="p-4 text-left font-medium text-blue-400">TASKIT OS</th>
                <th className="p-4 text-left font-medium text-white/60">Monday.com</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Project & task management', 'Built-in', 'Built-in'],
                ['Client portal', 'Built-in', 'Third-party only'],
                ['Invoicing & billing', 'Built-in (Stripe, Dodo)', 'Third-party only'],
                ['AI workflow automation', 'Built-in', 'Third-party only'],
                ['Double-entry accounting', 'Built-in', 'Not available'],
                ['Contract management', 'Built-in', 'Not available'],
                ['Client approval flows', 'Built-in', 'Third-party only'],
                ['Real-time presence', 'Built-in (Socket.IO)', 'Basic'],
                ['Multi-language (AR/FR)', 'Built-in', 'Limited'],
                ['RBAC + MFA', 'Built-in', 'Enterprise only'],
                ['API access', 'Included', 'Included'],
                ['Starting price', '$19/user/month', '$12/user/month'],
              ].map(([feature, taskit, monday]) => (
                <tr key={feature} className="border-b border-white/5">
                  <td className="p-4 font-medium">{feature}</td>
                  <td className="p-4"><span className="text-green-400">&#10003;</span> {taskit}</td>
                  <td className="p-4 text-white/50">{monday}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-12 text-center">
          <h2 className="mb-4 text-2xl font-bold">Ready to try TASKIT?</h2>
          <Link href="/signup" className="inline-block rounded-lg bg-blue-600 px-8 py-3 text-sm font-medium hover:bg-blue-700">
            Start free trial
          </Link>
        </section>
      </main>

      <FaqSchema items={[
        { question: 'Is TASKIT better than Monday.com?', answer: 'TASKIT OS offers more built-in features for agencies including invoicing, client portal, AI automation, and financial operations — features Monday.com requires separate subscriptions for.' },
        { question: 'Can I migrate from Monday.com to TASKIT?', answer: 'Yes. We offer migration support on our Team and Enterprise plans. Contact us for a migration plan.' },
        { question: 'Does TASKIT have the same features as Monday.com?', answer: 'TASKIT covers all core project management features of Monday.com plus built-in billing, client portals, contracts, and AI automation.' },
      ]} />
    </div>
  )
}
