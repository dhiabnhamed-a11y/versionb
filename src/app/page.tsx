import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@/lib/auth'
import logo from '@/app/logo.png'
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Building2,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CheckCircle2,
  Eye,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react'

const featureCards = [
  {
    title: 'Role-aware control',
    description: 'Give owners, managers, and employees the exact permissions they need with less noise and clearer responsibility.',
    icon: ShieldCheck,
  },
  {
    title: 'Live alerts that surface fast',
    description: 'Escalate urgent issues instantly so blockers do not stay buried in chat threads, calls, or spreadsheets.',
    icon: BellRing,
  },
  {
    title: 'Projects, tasks, and progress together',
    description: 'Track execution from planning to delivery in one place with clear ownership, deadlines, and status at every stage.',
    icon: Layers3,
  },
  {
    title: 'A calmer operating rhythm',
    description: 'Replace scattered tools with a focused workspace that keeps customer-facing teams aligned without visual clutter.',
    icon: ChartNoAxesCombined,
  },
]

const workflowSteps = [
  {
    title: 'Launch a private workspace',
    description: 'Create your company space, assign ownership, and invite only the people who should see operational work.',
  },
  {
    title: 'Run the work visibly',
    description: 'Organize projects, assign tasks, and keep deadlines, priorities, and accountability in one clear view.',
  },
  {
    title: 'Respond in real time',
    description: 'Use alerts and live status changes to react quickly when work needs attention from customer operations teams.',
  },
]

const trustPoints = [
  {
    title: 'Customer workspaces only',
    description: 'Reserved for verified customer organizations and their invited staff.',
    icon: Building2,
  },
  {
    title: 'Permissioned by role',
    description: 'Owners, managers, and employees each get the right operating view.',
    icon: LockKeyhole,
  },
  {
    title: 'Made for live coordination',
    description: 'Urgent alerts, project updates, and task ownership stay visible in one place.',
    icon: BadgeCheck,
  },
]

const customerAccessRules = [
  'This website is only for customer users and invited team members.',
  'Access is intended for active workspaces, not open public browsing.',
  'Each workspace keeps role-based visibility for owners, managers, and employees.',
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
              <Image src={logo} alt="TASKIT logo" width={48} height={48} className="h-12 w-12 object-contain" priority />
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
            <a href="#trust" className="transition-colors hover:text-[var(--text-primary)]">
              Trust
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
              <span>Private customer workspace. Free to start. No pricing wall right now.</span>
            </div>

            <h1 className="max-w-4xl font-display text-[clamp(3.25rem,8vw,6.3rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-[var(--text-primary)]">
              A more trusted front door for customer operations, delivery, and urgent team coordination.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-secondary)] md:text-xl">
              TASKIT helps customer teams manage projects, assign accountability, and send urgent operational alerts from
              one calmer, professional workspace.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link href={primaryHref} className="btn-primary inline-flex min-h-12 items-center justify-center gap-2 px-6 text-sm">
                <span>{primaryLabel}</span>
                <ArrowRight size={17} strokeWidth={2.2} />
              </Link>
              <Link href="#features" className="btn-secondary inline-flex min-h-12 items-center justify-center px-6 text-sm">
                Explore the workspace
              </Link>
            </div>

            <div className="marketing-proof-strip mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { value: 'Private access', label: 'Built for customer organizations and invited teams' },
                { value: 'Role-aware views', label: 'Owners, managers, and employees see the right controls' },
                { value: 'Real-time alerts', label: 'Urgent changes surface immediately when action is needed' },
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
                <div className="marketing-panel-label">Workspace trust brief</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                  Built to look credible the moment a customer team lands on it
                </h2>
              </div>
              <div className="brand-chip brand-chip-lg">
                <Image src={logo} alt="TASKIT logo" width={96} height={96} className="h-20 w-20 object-contain md:h-24 md:w-24" />
              </div>
            </div>

            <div className="marketing-audience-card mt-8">
              <div className="marketing-audience-head">
                <div className="marketing-mini-icon">
                  <UsersRound size={18} />
                </div>
                <div>
                  <div className="marketing-panel-label">Customer access only</div>
                  <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                    This website is only for customer users
                  </h3>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {customerAccessRules.map((rule) => (
                  <div key={rule} className="marketing-audience-rule">
                    <CheckCircle2 size={17} className="text-[var(--accent)]" />
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="marketing-panel-card">
                <div className="marketing-panel-label">Operations</div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="marketing-mini-icon">
                    <BriefcaseBusiness size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-[var(--text-primary)]">Project control</div>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                      See what is active, who owns it, and what needs attention before customers feel the delay.
                    </p>
                  </div>
                </div>
              </div>

              <div className="marketing-panel-card">
                <div className="marketing-panel-label">Response</div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="marketing-mini-icon">
                    <BellRing size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-[var(--text-primary)]">Urgent alerts</div>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                      Push important updates immediately when a task, deadline, or callback needs eyes on it.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              {[
                'A polished first impression for teams managing active customer work',
                'Sharper typography and clearer section flow to improve confidence and readability',
                'Trust cues that explain who the product is for before people sign in',
              ].map((item) => (
                <div key={item} className="marketing-trust-row">
                  <CheckCircle2 size={18} className="text-[var(--accent)]" />
                  <span className="text-sm font-medium text-[var(--text-secondary)]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-trust-band">
          {trustPoints.map((point) => {
            const Icon = point.icon
            return (
              <article key={point.title} className="marketing-trust-card">
                <div className="marketing-mini-icon">
                  <Icon size={18} />
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{point.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{point.description}</p>
              </article>
            )
          })}
        </section>

        <section id="features" className="marketing-section">
          <div className="marketing-section-head">
            <div className="marketing-panel-label">Core features</div>
            <h2 className="mt-3 font-display text-5xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
              Everything important is visible without feeling crowded.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
              TASKIT combines clearer typography, stronger grouping, and focused product framing so teams understand the
              value quickly and trust what they are looking at.
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
              From onboarding to execution, the path stays easy to follow.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-[var(--text-secondary)]">
              The landing page now explains how real customer teams begin, how access is controlled, and how work moves
              from setup to daily delivery.
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

        <section id="trust" className="marketing-section grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="marketing-why-card">
            <div className="marketing-panel-label">Trust layer</div>
            <h2 className="mt-3 font-display text-5xl font-semibold tracking-[-0.05em] text-white">
              Designed to look serious enough for real customer operations.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-cyan-50/80">
              From the first screen, the product now communicates private access, structured roles, and a cleaner
              operating standard that teams can trust.
            </p>
          </div>

          <div className="grid gap-4">
            {[
              {
                title: 'Customer-first framing',
                description: 'The homepage now makes it clear that TASKIT serves customer organizations and invited team members.',
                icon: Eye,
              },
              {
                title: 'Sharper brand presentation',
                description: 'Typography, spacing, and visual contrast now feel more premium and more credible at a glance.',
                icon: Sparkles,
              },
              {
                title: 'Confident product trust cues',
                description: 'The page highlights private access, live response, and role-aware visibility without sounding vague.',
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
              Launch TASKIT for free and give your customer team a more trusted place to operate.
            </h2>
            <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
              No pricing wall, no confusing setup, and no noisy first impression. Just open the workspace and start
              organizing the work that matters.
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
