'use client'

import { useState, useEffect } from 'react'
import { useLocale } from '@/components/i18n/LocaleProvider'
import { X, ArrowRight, Check, LayoutDashboard, ListTodo, Users, Bell, ShieldCheck } from 'lucide-react'

const STEPS = [
  {
    icon: LayoutDashboard,
    titleKey: 'tour.welcome.title',
    descKey: 'tour.welcome.desc',
  },
  {
    icon: ListTodo,
    titleKey: 'tour.tasks.title',
    descKey: 'tour.tasks.desc',
  },
  {
    icon: Users,
    titleKey: 'tour.team.title',
    descKey: 'tour.team.desc',
  },
  {
    icon: Bell,
    titleKey: 'tour.alerts.title',
    descKey: 'tour.alerts.desc',
  },
  {
    icon: ShieldCheck,
    titleKey: 'tour.done.title',
    descKey: 'tour.done.desc',
  },
] as const

export default function WorkspaceTour() {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const seen = localStorage.getItem('taskit:tour:seen')
    if (!seen) {
      const timer = setTimeout(() => setOpen(true), 600)
      return () => clearTimeout(timer)
    }
  }, [])

  function dismiss() {
    localStorage.setItem('taskit:tour:seen', '1')
    setOpen(false)
  }

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1)
    else dismiss()
  }

  if (!open) return null

  const s = STEPS[step]
  const Icon = s.icon
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 max-w-md rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-8 shadow-2xl">
        <button onClick={dismiss} className="absolute right-4 top-4 rounded-xl p-2 hover:bg-black/5" aria-label="Close">
          <X size={18} />
        </button>
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] text-white">
          <Icon size={28} />
        </div>
        <h2 className="mb-2 text-xl font-bold text-[var(--text-primary)]">{t(s.titleKey)}</h2>
        <p className="mb-8 text-[15px] leading-relaxed text-[var(--text-secondary)]">{t(s.descKey)}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-2 w-2 rounded-full transition ${i === step ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
            ))}
          </div>
          <button onClick={next} className="flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] active:scale-95">
            {isLast ? <Check size={16} /> : <ArrowRight size={16} />}
            {isLast ? t('tour.getStarted') : t('tour.next')}
          </button>
        </div>
      </div>
    </div>
  )
}
