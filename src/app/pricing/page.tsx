import type { Metadata } from 'next'
import Link from 'next/link'
import { FaqSchema } from '@/components/seo/FaqSchema'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, transparent pricing for TASKIT OS. Start free, scale as you grow. Agency operations, project management, client portal, billing, and AI included.',
  openGraph: {
    title: 'TASKIT OS — Pricing',
    description: 'Simple, transparent pricing for TASKIT OS. Start free, scale as you grow.',
  },
}

const plans = [
  {
    name: 'Starter',
    price: '$19',
    period: '/month per user',
    description: 'For small teams getting started',
    features: [
      'Project & task management',
      'Client portal',
      'Basic invoicing',
      'Team collaboration',
      'Real-time alerts',
      'Mobile access',
    ],
    cta: 'Start free trial',
    href: '/signup',
    highlighted: false,
  },
  {
    name: 'Team',
    price: '$39',
    period: '/month per user',
    description: 'For growing agencies and teams',
    features: [
      'Everything in Starter',
      'Advanced billing & invoicing',
      'AI workflow automation',
      'Client approval flows',
      'Custom roles & permissions',
      'API access',
      'Priority support',
    ],
    cta: 'Start free trial',
    href: '/signup',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations',
    features: [
      'Everything in Team',
      'SSO / SAML / OIDC',
      'Custom integrations',
      'Dedicated support',
      'On-premise option',
      'SLA guarantee',
      'Custom contracts',
    ],
    cta: 'Contact sales',
    href: '/contact',
    highlighted: false,
  },
]

export default function PricingPage() {
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
          <h1 className="mb-4 text-5xl font-bold tracking-tight">Simple, transparent pricing</h1>
          <p className="mx-auto max-w-2xl text-lg text-white/60">
            Start free. No credit card required. Upgrade when you need more power.
          </p>
        </section>

        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-2xl border p-8 ${
                plan.highlighted
                  ? 'border-blue-500 bg-blue-950/20'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <h2 className="mb-1 text-xl font-semibold">{plan.name}</h2>
              <p className="mb-4 text-sm text-white/40">{plan.description}</p>
              <p className="mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-sm text-white/40">{plan.period}</span>
              </p>
              <ul className="mb-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-white/80">
                    <span className="mt-0.5 text-blue-400">&#10003;</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`block rounded-lg px-6 py-3 text-center text-sm font-medium ${
                  plan.highlighted
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border border-white/20 text-white hover:bg-white/10'
                }`}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>

        <section className="mt-24 text-center">
          <h2 className="mb-4 text-2xl font-bold">Frequently asked questions</h2>
          <div className="mx-auto max-w-2xl space-y-6 text-left">
            {[
              { q: 'Can I cancel anytime?', a: 'Yes. No contracts. Cancel anytime with one click.' },
              { q: 'Is there a free trial?', a: 'Yes. 14-day free trial with full access. No credit card required.' },
              { q: 'Can I switch plans?', a: 'Upgrade or downgrade anytime. Changes apply immediately.' },
              { q: 'Do you offer SSO?', a: 'SSO / SAML / OIDC is available on the Enterprise plan.' },
            ].map((faq) => (
              <details key={faq.q} className="rounded-lg border border-white/10 p-4">
                <summary className="cursor-pointer font-medium">{faq.q}</summary>
                <p className="mt-2 text-sm text-white/60">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <FaqSchema
        items={[
          { question: 'Can I cancel anytime?', answer: 'Yes. No contracts. Cancel anytime with one click.' },
          { question: 'Is there a free trial?', answer: 'Yes. 14-day free trial with full access. No credit card required.' },
          { question: 'Can I switch plans?', answer: 'Upgrade or downgrade anytime. Changes apply immediately.' },
          { question: 'Do you offer SSO?', answer: 'SSO / SAML / OIDC is available on the Enterprise plan.' },
        ]}
      />
    </div>
  )
}
