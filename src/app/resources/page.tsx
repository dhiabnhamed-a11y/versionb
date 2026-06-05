import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Resources',
  description: 'Agency operations guides, best practices, and resources for running a high-performance agency with TASKIT OS.',
  openGraph: {
    title: 'TASKIT OS — Resources',
    description: 'Agency operations guides, best practices, and resources.',
  },
}

const articles = [
  {
    title: 'How to choose the right agency management software',
    description: 'A comprehensive guide to evaluating agency operations platforms for your team.',
    slug: 'choose-agency-management-software',
    date: 'Coming soon',
  },
  {
    title: 'Agency workflow automation with AI',
    description: 'How AI is transforming agency operations from task management to client delivery.',
    slug: 'agency-workflow-automation-ai',
    date: 'Coming soon',
  },
  {
    title: 'Client portal best practices for agencies',
    description: 'How to streamline client communication, approvals, and file sharing.',
    slug: 'client-portal-best-practices',
    date: 'Coming soon',
  },
  {
    title: 'Agency billing guide: from invoices to payments',
    description: 'Everything you need to know about agency billing, invoicing, and payment collection.',
    slug: 'agency-billing-guide',
    date: 'Coming soon',
  },
]

export default function ResourcesPage() {
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
          <h1 className="mb-4 text-5xl font-bold tracking-tight">Resources</h1>
          <p className="mx-auto max-w-2xl text-lg text-white/60">
            Guides, best practices, and insights for running a high-performance agency.
          </p>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          {articles.map((article) => (
            <article
              key={article.slug}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-blue-500/50"
            >
              <time className="mb-2 block text-xs text-white/30">{article.date}</time>
              <h2 className="mb-2 text-lg font-semibold">{article.title}</h2>
              <p className="text-sm text-white/60">{article.description}</p>
            </article>
          ))}
        </div>

        <section className="mt-16 text-center">
          <p className="text-white/40">More resources coming soon. Stay tuned.</p>
        </section>
      </main>
    </div>
  )
}
