import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'TASKIT OS — منصة إدارة العمليات للوكالات',
  description: 'TASKIT OS تجمع إدارة المشاريع، علاقات العملاء، الفواتير، بوابة العميل، أتمتة الذكاء الاصطناعي، والتعاون في الوقت الفعلي في منصة واحدة.',
  alternates: { canonical: '/ar' },
  openGraph: {
    title: 'TASKIT OS — منصة إدارة العمليات',
    description: 'إدارة المشاريع، بوابة العميل، الفواتير، الذكاء الاصطناعي، والتعاون في الوقت الفعلي.',
    locale: 'ar_AE',
  },
}

export default function ArabicLanding() {
  return (
    <div className="min-h-screen bg-[#07090e] text-white" dir="rtl">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/ar" className="text-lg font-bold tracking-tight">TASKIT</Link>
          <nav className="flex items-center gap-6 text-sm text-white/60">
            <Link href="/features">الميزات</Link>
            <Link href="/pricing">الأسعار</Link>
            <Link href="/ar" className="text-white">العربية</Link>
            <Link href="/" className="text-white/40">English</Link>
            <Link href="/fr" className="text-white/40">Français</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="mb-6 text-5xl font-bold tracking-tight">منصة العمليات للوكالات الحديثة</h1>
        <p className="mx-auto mb-12 max-w-2xl text-lg text-white/60">
          المشاريع، العملاء، الفواتير، الذكاء الاصطناعي، العقود، والتعاون في الوقت الفعلي — أداة واحدة بدلاً من عشرة.
        </p>
        <Link href="/signup" className="inline-block rounded-lg bg-blue-600 px-8 py-3 text-sm font-medium hover:bg-blue-700">
          تجربة مجانية
        </Link>
      </main>
    </div>
  )
}
