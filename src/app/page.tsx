import Link from 'next/link'
import { auth } from '@/lib/auth'
import { BrandMark } from '@/components/brand/BrandMark'
import {
  ArrowRight,
  BellRing,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CheckCircle2,
  Eye,
  Layers3,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

const featureCards = [
  {
    title: 'Role-aware control',
    description: 'Give owners, managers, and employees the exact view they need without extra setup noise.',
    icon: ShieldCheck,
  },
  {
    title: 'Live alerts that surface fast',
    description: 'Escalate urgent issues instantly so blockers do not stay hidden in chat threads or spreadsheets.',
    icon: BellRing,
  },
  {
    title: 'Projects, tasks, and progress together',
    description: 'Track execution from planning to delivery in one place with clear ownership at every stage.',
    icon: Layers3,
  },
  {
    title: 'A calm operating rhythm',
    description: 'Replace scattered tools with a focused workspace that keeps the team aligned without visual clutter.',
    icon: ChartNoAxesCombined,
  },
]

const workflowSteps = [
  {
    title: 'Set up your workspace',
    description: 'Create your organization, invite the team, and get a clean command center in minutes.',
  },
  {
    title: 'Run the work visibly',
    description: 'Organize projects, assign tasks, and keep deadlines, priorities, and accountability in view.',
  },
  {
    title: 'Respond in real time',
    description: 'Use alerts and live status changes to react quickly when work needs attention.',
  },
]

function getDashboardHref(role?: string) {
  return role === 'EMPLOYEE' ? '/dashboard/employee' : '/dashboard/admin'
}

export default async function HomePage() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  const dashboardHref = getDashboardHref(role)
  const primaryHref = session ? dashboardHref : '/signup'
  const primaryLabel = session ? 'Open workspace' : 'Start free'
  const secondaryHref = session ? dashboardHref : '/login'
  const secondaryLabel = session ? 'Go to dashboard' : 'Sign in'

  return (
    <div className="marketing-shell">
      <div className="marketing-orb marketing-orb-left" />
      <div className="marketing-orb marketing-orb-right" />

      <header className="marketing-nav-wrap">
        <nav className="marketing-nav glass">
          <Link href="/" className="flex items-center gap-3 text-[var(--text-primary)] no-underline">
            <div className="brand-chip">
              <BrandMark className="h-12 w-12" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-[-0.04em]">TASKIT</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                Team operating system
              </div>
            </div>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium text-[var(--text-secondary)] lg:flex">
            <a href="#features" className="transition-colors hover:text-[var(--text-primary)]">
              Features
            </a>
            <a href="#workflow" className="transition-colors hover:text-[var(--text-primary)]">
              Workflow
            </a>
            <a href="#why-taskit" className="transition-colors hover:text-[var(--text-primary)]">
              Why TASKIT
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link href={secondaryHref} className="btn-secondary hidden sm:inline-flex">
              {secondaryLabel}
            </Link>
            <Link href={primaryHref} className="btn-primary inline-flex items-center gap-2">
              <span>{primaryLabel}</span>
              <ArrowRight size={16} strokeWidth={2.2} />
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-24 px-5 pb-20 pt-10 md:px-8 md:pb-24 md:pt-12">
        <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:gap-14">
          <div className="max-w-3xl">
            <div className="marketing-pill mb-6 inline-flex items-center gap-2">
              <Sparkles size={14} />
              <span>Free right now. No pricing wall. No credit card required.</span>
            </div>

            <h1 className="max-w-4xl font-display text-[clamp(3.25rem,8vw,6.3rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-[var(--text-primary)]">
              Run projects, tasks, and urgent team signals from one focused landing point.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-secondary)] md:text-xl">
              TASKIT gives growing teams a cleaner operating surface for planning work, assigning ownership, and reacting
              fast when something important changes.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link href={primaryHref} className="btn-primary inline-flex min-h-12 items-center justify-center gap-2 px-6 text-sm">
                <span>{primaryLabel}</span>
                <ArrowRight size={17} strokeWidth={2.2} />
              </Link>
              <Link href="#features" className="btn-secondary inline-flex min-h-12 items-center justify-center px-6 text-sm">
                See what is inside
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { value: 'Real-time alerts', label: 'For blockers and urgent calls' },
                { value: 'Role-aware views', label: 'For owners, managers, and team members' },
                { value: 'Free for now', label: 'Start without a pricing step' },
              ].map((item) => (
                <div key={item.value} className="marketing-stat">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{item.value}</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="marketing-hero-card glass-elevated">
            <div className="marketing-hero-glow" />

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="marketing-panel-label">Operations overview</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                  A more professional front door for your workspace
                </h2>
              </div>
              <div className="brand-chip brand-chip-lg">
                <BrandMark className="h-20 w-20 md:h-24 md:w-24" />
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="marketing-panel-card">
                <div className="marketing-panel-label">Today</div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="marketing-mini-icon">
                    <BriefcaseBusiness size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-[var(--text-primary)]">Project control</div>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                      See what is active, who owns it, and what needs attention first.
                    </p>
                  </div>
                </div>
              </div>

              <div className="marketing-panel-card">
                <div className="marketing-panel-label">Signals</div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="marketing-mini-icon">
                    <BellRing size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-[var(--text-primary)]">Urgent alerts</div>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                      Push important updates immediately when a task or deadline needs eyes on it.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              {[
                'Professional landing page structure with clearer placement of every section',
                'Palette tuned to the logo with electric blue, cyan, and lime accents',
                'Bigger transparent logo treatment so the old blue block is gone',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-[18px] border border-[var(--border)] bg-white/70 px-4 py-3">
                  <CheckCircle2 size={18} className="text-[var(--accent)]" />
                  <span className="text-sm font-medium text-[var(--text-secondary)]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="marketing-section">
          <div className="marketing-section-head">
            <div className="marketing-panel-label">Core features</div>
            <h2 className="mt-3 font-display text-5xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
              Everything is placed to feel simpler and more intentional.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
              The new presentation is built around clarity: better spacing, stronger grouping, and sections that explain
              the product quickly without adding clutter.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((feature) => {
              const Icon = feature.icon
              return (
                <article key={feature.title} className="marketing-feature-card">
                  <div className="marketing-mini-icon">
                    <Icon size={18} />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{feature.description}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section id="workflow" className="marketing-section grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <div className="marketing-panel-label">Workflow</div>
            <h2 className="mt-3 font-display text-5xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
              From setup to execution, the path is easy to understand.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-[var(--text-secondary)]">
              Instead of a vague marketing page, the landing experience now shows exactly how a team would begin and why
              the product feels useful from day one.
            </p>
          </div>

          <div className="grid gap-4">
            {workflowSteps.map((step, index) => (
              <article key={step.title} className="marketing-step-card">
                <div className="marketing-step-number">0{index + 1}</div>
                <div>
                  <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{step.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="why-taskit" className="marketing-section grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="marketing-why-card">
            <div className="marketing-panel-label">Why TASKIT</div>
            <h2 className="mt-3 font-display text-5xl font-semibold tracking-[-0.05em] text-white">
              Designed to feel polished, modern, and ready to trust.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-cyan-50/80">
              The new palette follows the logo instead of fighting it, the sections breathe more, and the page presents
              the SaaS as free to start right now.
            </p>
          </div>

          <div className="grid gap-4">
            {[
              {
                title: 'Clearer hierarchy',
                description: 'The hero, proof points, features, and call to action now flow in a more professional order.',
                icon: Eye,
              },
              {
                title: 'Brand-aligned palette',
                description: 'Color now leans into the logo glow instead of the older warm editorial direction.',
                icon: Sparkles,
              },
              {
                title: 'Confident product framing',
                description: 'The copy speaks like a SaaS product, but without a pricing section blocking signups.',
                icon: ShieldCheck,
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <article key={item.title} className="marketing-feature-card">
                  <div className="marketing-mini-icon">
                    <Icon size={18} />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{item.description}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section className="marketing-cta glass-elevated">
          <div className="max-w-3xl">
            <div className="marketing-panel-label">Start now</div>
            <h2 className="mt-3 font-display text-5xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
              Launch TASKIT for free and give your team a better place to operate.
            </h2>
            <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
              No pricing page, no paywall, and no confusing first step. Just open the workspace and start organizing work.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={primaryHref} className="btn-primary inline-flex min-h-12 items-center justify-center gap-2 px-6 text-sm">
              <span>{primaryLabel}</span>
              <ArrowRight size={17} strokeWidth={2.2} />
            </Link>
            <Link href={secondaryHref} className="btn-secondary inline-flex min-h-12 items-center justify-center px-6 text-sm">
              {secondaryLabel}
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
