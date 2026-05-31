'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Home, LifeBuoy, RefreshCw, ShieldCheck } from 'lucide-react'
import { BrandMark } from '@/components/brand/BrandMark'

interface ErrorLayoutProps {
  title?: string
  subtitle?: string
  code?: string
  children?: React.ReactNode
  showRobot?: boolean
  showDiagnostics?: boolean
  showRecovery?: boolean
}

const statusItems = [
  'Your workspace data remains protected.',
  'Our team can use the reference code to trace this event.',
  'You can retry safely or return to your dashboard.',
]

export default function ErrorLayout({
  title = 'Something went wrong',
  subtitle = 'We could not load this page, but your workspace is still secure. Please try again or return to your dashboard.',
  code = 'ERR_500',
  children,
  showDiagnostics = true,
}: ErrorLayoutProps) {
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(247,248,250,0.95) 48%, rgba(238,241,245,1) 100%)',
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-72 border-b border-[var(--border)]"
          style={{
            background:
              'radial-gradient(circle at 24% 20%, rgba(8,145,178,0.12), transparent 32rem), radial-gradient(circle at 78% 10%, rgba(217,119,6,0.1), transparent 26rem)',
          }}
        />

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-5xl"
          aria-labelledby="error-title"
        >
          <div
            className={`grid overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-[var(--shadow-premium)] ${
              showDiagnostics ? 'lg:grid-cols-[1.08fr_0.92fr]' : ''
            }`}
          >
            <div className="flex min-h-[560px] flex-col justify-between p-6 sm:p-8 lg:p-10">
              <div>
                <Link
                  href="/"
                  className="inline-flex items-center gap-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]"
                >
                  <BrandMark className="h-9 w-9" />
                  <span>TASKIT OS</span>
                </Link>

                <div className="mt-14 max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[var(--success-border)] bg-[var(--success-light)] px-3 py-1 text-xs font-semibold text-[var(--success-text)]">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Secure recovery screen
                  </div>

                  <p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    Reference {code}
                  </p>
                  <h1 id="error-title" className="mt-3 text-3xl font-bold tracking-normal text-[var(--text-primary)] sm:text-5xl">
                    {title}
                  </h1>
                  <p className="mt-5 max-w-xl text-base leading-7 text-[var(--text-secondary)]">
                    {subtitle}
                  </p>
                </div>
              </div>

              <div className="mt-10">
                {children ? (
                  <div className="flex flex-col gap-3 sm:flex-row">{children}</div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="btn-primary"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Try again
                    </button>
                    <Link href="/dashboard" className="btn-secondary">
                      <Home className="h-4 w-4" aria-hidden="true" />
                      Go to dashboard
                    </Link>
                  </div>
                )}

                <Link
                  href="/"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to homepage
                </Link>
              </div>
            </div>

            {showDiagnostics && (
              <aside className="border-t border-[var(--border)] bg-[var(--bg-elevated)] p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
                <div className="flex h-full flex-col justify-between gap-8">
                  <div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--info-border)] bg-[var(--info-light)] text-[var(--info-text)]">
                      <LifeBuoy className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h2 className="mt-6 text-lg font-bold text-[var(--text-primary)]">
                      What happens next
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                      This is a temporary application error page. It does not mean your account,
                      files, billing, or workspace permissions were exposed.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {statusItems.map((item) => (
                      <div
                        key={item}
                        className="flex gap-3 rounded-lg border border-[var(--border)] bg-white p-4 text-sm text-[var(--text-secondary)]"
                      >
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden="true" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-[var(--border)] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      Support reference
                    </p>
                    <p className="mt-2 font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {code}
                    </p>
                  </div>
                </div>
              </aside>
            )}
          </div>
        </motion.section>
      </div>
    </main>
  )
}
