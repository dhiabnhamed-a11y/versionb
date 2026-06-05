import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Compare TASKIT OS with Alternatives',
  description: 'See how TASKIT OS compares to Monday.com, Asana, ClickUp, Wrike, Notion, and other project management and agency operations tools.',
  openGraph: {
    title: 'TASKIT OS vs Alternatives — Comparison',
    description: 'See how TASKIT OS compares to Monday.com, Asana, ClickUp, and more.',
  },
}

const comparisons = [
  { competitor: 'Monday.com', slug: 'monday-vs-taskit', description: 'TASKIT has built-in billing, client portal, and AI automation that Monday.com charges extra for.' },
]

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-[#07090e] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight">TASKIT</Link>
          <nav className="flex items-center gap-6 text-sm text-white/60">
            <Link href="/features">Features</Link>
            <Link href="/pricing">Pricing</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-24">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">TASKIT vs Alternatives</h1>
        <p className="mb-12 text-lg text-white/60">
          Honest comparisons showing where TASKIT wins, where competitors win, and what matters for your agency.
        </p>

        <div className="grid gap-4">
          {comparisons.map((cmp) => (
            <Link
              key={cmp.slug}
              href={`/compare/${cmp.slug}`}
              className="block rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-blue-500/50"
            >
              <h2 className="mb-1 text-xl font-semibold">TASKIT vs {cmp.competitor}</h2>
              <p className="text-sm text-white/50">{cmp.description}</p>
            </Link>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-white/30">More comparisons coming soon.</p>
      </main>
    </div>
  )
}
