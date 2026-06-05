import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'TASKIT OS — Plateforme de gestion d\'agence tout-en-un',
  description: 'TASKIT OS remplace vos outils de gestion de projet, CRM, facturation, portail client et reporting par une plateforme unifiée pour agences et équipes opérationnelles.',
  alternates: { canonical: '/fr' },
  openGraph: {
    title: 'TASKIT OS — Plateforme de gestion d\'agence',
    description: 'Gestion de projet, portail client, facturation, IA et collaboration en temps réel.',
    locale: 'fr_FR',
  },
}

export default function FrenchLanding() {
  return (
    <div className="min-h-screen bg-[#07090e] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/fr" className="text-lg font-bold tracking-tight">TASKIT</Link>
          <nav className="flex items-center gap-6 text-sm text-white/60">
            <Link href="/features">Fonctionnalités</Link>
            <Link href="/pricing">Tarifs</Link>
            <Link href="/fr" className="text-white">Français</Link>
            <Link href="/" className="text-white/40">English</Link>
            <Link href="/ar" className="text-white/40">العربية</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="mb-6 text-5xl font-bold tracking-tight">La plateforme opérationnelle pour les agences modernes</h1>
        <p className="mx-auto mb-12 max-w-2xl text-lg text-white/60">
          Projets, clients, facturation, IA, contrats et collaboration en temps réel — un seul outil, pas dix.
        </p>
        <Link href="/signup" className="inline-block rounded-lg bg-blue-600 px-8 py-3 text-sm font-medium hover:bg-blue-700">
          Essai gratuit
        </Link>
      </main>
    </div>
  )
}
