import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@/lib/auth'
import { COMPANY_TYPE_OPTIONS, getCompanyTypeSlug } from '@/lib/company-types'
import { getRoleHomePath } from '@/lib/security'
import logo from '@/app/logo.png'
import {
  ArrowRight,
  BadgeCheck,
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
    title: 'Industry structure built in',
    description: 'Separate work by rooms, let each room hold its own projects, and keep tasks moving inside every project.',
    icon: Building2,
  },
  {
    title: 'Digital agency delivery flow',
    description: 'Assign image, affiche, and video briefs to employees, then collect uploaded deliverables inside the same workspace.',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Role-aware control',
    description: 'Give owners, managers, and employees the exact permissions they need with less noise and clearer responsibility.',
    icon: ShieldCheck,
  },
  {
    title: 'Live alerts and progress together',
    description: 'Escalate urgent issues quickly while keeping projects, tasks, and delivery progress visible in one place.',
    icon: ChartNoAxesCombined,
  },
]

const workflowSteps = [
  {
    title: 'Choose your company type',
    description: 'Pick industry, digital agency, or other before signup so TASKIT starts with the right structure from day one.',
  },
  {
    title: 'Launch the matching workspace',
    description: 'Create your company, verify the owner domain, and let TASKIT prepare the workflow that fits how your team already works.',
  },
  {
    title: 'Invite the team and execute',
    description: 'Bring in managers and employees, assign work, collect updates, and keep delivery moving in real time.',
  },
]

const trustPoints = [
  {
    title: 'Type-aware onboarding',
    description: 'Every workspace begins with the structure that matches the company that is signing up.',
    icon: Building2,
  },
  {
    title: 'Permissioned by role',
    description: 'Owners, managers, and employees each get the right operating view.',
    icon: LockKeyhole,
  },
  {
    title: 'One platform, multiple workflows',
    description: 'Industry teams, agencies, and standard project teams can all run on the same TASKIT foundation.',
    icon: BadgeCheck,
  },
]

const customerAccessRules = [
  'Industry workspaces split work into rooms, then projects, then tasks.',
  'Digital agencies send creative briefs, collect uploads, and review finished work.',
  'Other companies keep the current TASKIT interface with no extra complexity.',
]

const companyTracks = COMPANY_TYPE_OPTIONS.map((option, index) => ({
  ...option,
  href: `/signup?companyType=${getCompanyTypeSlug(option.value)}`,
  icon: index === 0 ? Building2 : index === 1 ? BriefcaseBusiness : Layers3,
  cta:
    option.value === 'INDUSTRY'
      ? 'Start industry setup'
      : option.value === 'DIGITAL_AGENCY'
        ? 'Start agency setup'
        : 'Use standard setup',
}))

export default async function HomePage() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  const dashboardHref = getRoleHomePath(role)
  const primaryHref = session ? dashboardHref : '#company-types'
  const primaryLabel = session ? 'Open workspace' : 'Choose company type'
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
            <a href="#company-types" className="transition-colors hover:text-[var(--text-primary)]">
              Company types
            </a>
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
              <span>Choose the right workflow before signup. Free to start. No pricing wall right now.</span>
            </div>

            <h1 className="max-w-4xl font-display text-[clamp(3.25rem,8vw,6.3rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-[var(--text-primary)]">
              One workspace that adapts to industry teams, digital agencies, and everyone else.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-secondary)] md:text-xl">
              TASKIT now starts with a company-type choice before signup, so each team gets the right operating model:
              rooms to projects to tasks, creative briefs to deliverable uploads, or the same clean interface you already know.
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
                { value: 'Industry mode', label: 'Rooms, projects, and tasks stay separated and easy to follow' },
                { value: 'Agency mode', label: 'Briefs turn into uploads and handoff-ready deliverables' },
                { value: 'Standard mode', label: 'Keep the current TASKIT interface when that is all you need' },
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
                <div className="marketing-panel-label">Signup paths</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                  Pick the workflow your company needs before anyone creates the workspace
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
                  <div className="marketing-panel-label">Three workspace modes</div>
                  <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                    Choose the system that matches how your company already operates
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

            <div className="mt-6 grid gap-4">
              {companyTracks.map((track) => {
                const Icon = track.icon
                return (
                  <div key={track.value} className="marketing-panel-card">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="marketing-mini-icon">
                          <Icon size={18} />
                        </div>
                        <div>
                          <div className="text-base font-semibold text-[var(--text-primary)]">{track.label}</div>
                          <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{track.title}</p>
                        </div>
                      </div>
                      <Link href={track.href} className="btn-secondary px-4 py-2 text-xs">
                        {track.cta}
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 grid gap-4">
              {[
                'A clearer first decision before signup so teams enter the right workflow immediately',
                'Sharper typography and stronger section hierarchy for a more premium first impression',
                'Type-aware framing that explains industry, agency, and standard use cases at a glance',
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

        <section id="company-types" className="marketing-section">
          <div className="marketing-section-head">
            <div className="marketing-panel-label">Company types</div>
            <h2 className="mt-3 font-display text-5xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
              Signup now starts by asking what kind of company you have.
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--text-secondary)]">
              That first choice changes the workspace you create. Industry companies get rooms, digital agencies get
              creative brief delivery, and other teams keep the current TASKIT interface.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {companyTracks.map((track) => {
              const Icon = track.icon
              return (
                <article key={track.value} className="marketing-feature-card">
                  <div className="marketing-mini-icon">
                    <Icon size={18} />
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{track.label}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{track.description}</p>
                  <div className="mt-4 grid gap-2">
                    {track.bullets.map((bullet) => (
                      <div key={bullet} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <CheckCircle2 size={15} className="text-[var(--accent)]" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                  <Link href={track.href} className="btn-primary mt-6 inline-flex items-center gap-2 px-5 py-3 text-sm">
                    <span>{track.cta}</span>
                    <ArrowRight size={16} strokeWidth={2.2} />
                  </Link>
                </article>
              )
            })}
          </div>
        </section>

        <section id="features" className="marketing-section">
          <div className="marketing-section-head">
            <div className="marketing-panel-label">Core features</div>
            <h2 className="mt-3 font-display text-5xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
              Everything important is visible without forcing every company into the same shape.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
              TASKIT combines clearer typography, stronger grouping, and workflow-specific structure so teams can trust
              what they are looking at immediately.
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
              From company choice to daily execution, the path stays easy to follow.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-[var(--text-secondary)]">
              The landing page now explains how teams begin, how access is controlled, and how work moves from setup to
              daily delivery inside each workspace type.
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
              Designed to feel serious enough for real company operations and creative delivery.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-cyan-50/80">
              From the first screen, the product now communicates role structure, workflow clarity, and a cleaner
              operating standard that teams can trust.
            </p>
          </div>

          <div className="grid gap-4">
            {[
              {
                title: 'Clear company-type framing',
                description: 'The homepage now shows exactly how industry teams, agencies, and standard workspaces fit the product.',
                icon: Eye,
              },
              {
                title: 'Sharper brand presentation',
                description: 'Typography, spacing, and visual contrast now feel more premium and more credible at a glance.',
                icon: Sparkles,
              },
              {
                title: 'Confident product trust cues',
                description: 'The page highlights role-aware visibility, workflow choice, and live response without sounding vague.',
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
              Pick your company type, launch TASKIT for free, and start with the right workflow from the first screen.
            </h2>
            <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
              No pricing wall, no confusing setup, and no generic one-size-fits-all onboarding. Just choose the mode and
              start organizing the work that matters.
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
