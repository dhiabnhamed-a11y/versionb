import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Integrations',
  description: 'Connect TASKIT OS with your favorite tools. Stripe, Dodo Payments, Cloudinary, Supabase, OpenAI, Redis, and more.',
  openGraph: {
    title: 'TASKIT OS — Integrations',
    description: 'Connect TASKIT OS with your favorite tools. Stripe, Cloudinary, OpenAI, and more.',
  },
}

const integrations = [
  { name: 'Stripe', description: 'Payment processing, subscriptions, invoicing', category: 'Payments' },
  { name: 'Dodo Payments', description: 'Alternative payment processing for global teams', category: 'Payments' },
  { name: 'Cloudinary', description: 'Media delivery, image optimization, video streaming', category: 'Media' },
  { name: 'Supabase', description: 'Database, authentication, storage, real-time subscriptions', category: 'Infrastructure' },
  { name: 'OpenAI', description: 'AI-powered workflow automation, content generation, insights', category: 'AI' },
  { name: 'Redis', description: 'In-memory caching, real-time pub/sub, queue management', category: 'Infrastructure' },
  { name: 'Firebase', description: 'Push notifications, cloud messaging', category: 'Notifications' },
  { name: 'YouTube', description: 'Social analytics and content performance', category: 'Social' },
  { name: 'TikTok', description: 'Social analytics and content scheduling', category: 'Social' },
  { name: 'Instagram', description: 'Social analytics and engagement tracking', category: 'Social' },
  { name: 'LinkedIn', description: 'Social analytics and professional content', category: 'Social' },
  { name: 'Spotify', description: 'Audio content analytics and performance', category: 'Social' },
]

export default function IntegrationsPage() {
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
          <h1 className="mb-4 text-5xl font-bold tracking-tight">Integrations</h1>
          <p className="mx-auto max-w-2xl text-lg text-white/60">
            Connect TASKIT with the tools you already use. Payments, media, AI, analytics, and more.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration) => (
            <article
              key={integration.name}
              className="rounded-xl border border-white/10 bg-white/5 p-5"
            >
              <span className="mb-1 inline-block rounded bg-blue-900/40 px-2 py-0.5 text-xs text-blue-300">
                {integration.category}
              </span>
              <h2 className="mb-1 text-lg font-semibold">{integration.name}</h2>
              <p className="text-sm text-white/50">{integration.description}</p>
            </article>
          ))}
        </div>

        <section className="mt-16 text-center">
          <h2 className="mb-4 text-2xl font-bold">Need a custom integration?</h2>
          <p className="mb-8 text-white/60">We build custom integrations on our Enterprise plan.</p>
          <Link
            href="/pricing"
            className="inline-block rounded-lg bg-blue-600 px-8 py-3 text-sm font-medium hover:bg-blue-700"
          >
            See Enterprise plans
          </Link>
        </section>
      </main>
    </div>
  )
}
