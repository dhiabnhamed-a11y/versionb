import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@/lib/auth'
import { COMPANY_TYPE_OPTIONS, getCompanyTypeSlug } from '@/lib/company-types'
import { getRoleHomePath } from '@/lib/security'
import logo from '@/app/logo.png'
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Tags,
  UsersRound,
  Zap,
  Target,
  TrendingUp,
} from 'lucide-react'

const featureCards = [
  {
    title: 'Operational structure',
    description: 'Rooms, projects, and tasks stay separated so managers can see ownership, progress, and blockers without searching.',
    icon: Building2,
  },
  {
    title: 'Creative delivery',
    description: 'Client categories, campaigns, briefs, uploads, and handoffs live in one workspace from assignment to final review.',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Role-based focus',
    description: 'Owners, managers, and employees each see the tools and context they need for their part of the work.',
    icon: ShieldCheck,
  },
  {
    title: 'Live awareness',
    description: 'Alerts, progress, and team activity surface quickly so urgent work does not disappear inside long lists.',
    icon: BellRing,
  },
]

const workflowSteps = [
  {
    title: 'Select the right operating model',
    description: 'Start with industry, digital agency, or standard workspace settings before creating the company account.',
  },
  {
    title: 'Set up teams and responsibility',
    description: 'Invite owners, managers, and employees into a workspace that already matches their day-to-day flow.',
  },
  {
    title: 'Run work with clear visibility',
    description: 'Assign tasks, review deliverables, monitor progress, and respond to alerts from a single focused system.',
  },
]

const trustPoints = [
  {
    title: 'Structured onboarding',
    description: 'Every company begins with the workspace model that fits its operating style.',
    icon: ClipboardCheck,
  },
  {
    title: 'Controlled access',
    description: 'Role-aware views keep sensitive controls with the right people.',
    icon: LockKeyhole,
  },
  {
    title: 'Scalable foundation',
    description: 'One product supports operational teams, agencies, and flexible project teams.',
    icon: BadgeCheck,
  },
]

const workspaceHighlights = [
  'Industry teams organize work by room, project, and task.',
  'Digital agencies group clients by category, then track campaigns and deliverables.',
  'Standard teams keep a clean project workspace with less setup.',
]

const cockpitRows = [
  { label: 'Assembly room', value: '12 active tasks', tone: 'strong' },
  { label: 'Retail client category', value: '4 campaigns ready', tone: 'warm' },
  { label: 'Client rollout', value: '86% complete', tone: 'cool' },
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
        : 'Start standard setup',
}))

export default async function HomePage() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  const dashboardHref = getRoleHomePath(role)
  const primaryHref = session ? dashboardHref : '#company-types'
  const primaryLabel = session ? 'Open workspace' : 'Choose workspace type'
  const secondaryHref = session ? dashboardHref : '/login'
  const secondaryLabel = session ? 'Go to dashboard' : 'Sign in'

  return (
    <div className="marketing-shell">
      <header className="marketing-nav-wrap">
        <nav className="marketing-nav">
          <Link href="/" className="marketing-brand" aria-label="TASKIT home">
            <span className="brand-chip">
              <Image src={logo} alt="" width={48} height={48} className="h-11 w-11 object-contain" priority />
            </span>
            <span>
              <span className="marketing-brand-name">TASKIT</span>
              <span className="marketing-brand-line">Team operating workspace</span>
            </span>
          </Link>

          <div className="marketing-nav-links">
            <a href="#company-types">Workspace types</a>
            <a href="#features">Capabilities</a>
            <a href="#workflow">Workflow</a>
            <a href="#trust">Security</a>
          </div>

          <div className="marketing-nav-actions">
            <Link href={secondaryHref} className="btn-secondary hidden sm:inline-flex">
              {secondaryLabel}
            </Link>
            <Link href={primaryHref} className="btn-primary inline-flex items-center gap-2 px-4 sm:px-5">
              <span>{primaryLabel}</span>
              <ArrowRight size={16} strokeWidth={2.2} />
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="marketing-hero">
          <div className="marketing-hero-inner">
            <div className="marketing-hero-copy">
              <div className="marketing-pill">
                <Sparkles size={15} />
                <span>The professional workspace for teams that demand operational excellence</span>
              </div>

              <h1>
                <span className="gradient-text">TASKIT</span> delivers the workspace discipline teams need to execute at their best.
              </h1>

              <p className="marketing-hero-lede">
                Choose the workspace model that fits your company, then manage clients, categories, projects, tasks,
                creative deliverables, alerts, and team access from one unified, professional system.
              </p>

              <div className="marketing-hero-actions">
                <Link href={primaryHref} className="btn-primary">
                  <span>{primaryLabel}</span>
                  <ArrowRight size={17} strokeWidth={2.2} />
                </Link>
                <Link href="#features" className="btn-secondary">
                  Explore capabilities
                </Link>
              </div>

              <div className="marketing-proof-strip" aria-label="TASKIT workspace highlights">
                {[
                  { value: '3', label: 'workspace models' },
                  { value: 'Role-based', label: 'views and permissions' },
                  { value: 'Live', label: 'alerts and progress' },
                ].map((item) => (
                  <div key={item.value} className="marketing-stat">
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="marketing-product-frame" aria-label="TASKIT workspace preview">
              <div className="marketing-product-toolbar">
                <div>
                  <span className="marketing-panel-label">Workspace command</span>
                  <h2>Operations overview</h2>
                </div>
                <div className="marketing-live-badge">
                  <span />
                  Live
                </div>
              </div>

              <div className="marketing-product-grid">
                <div className="marketing-product-main">
                  <div className="marketing-product-row-head">
                    <div>
                      <span>Priority work</span>
                      <strong>Today</strong>
                    </div>
                    <Gauge size={22} />
                  </div>

                  <div className="marketing-progress-card">
                    <div className="marketing-progress-meta">
                      <span>Delivery health</span>
                      <strong>86%</strong>
                    </div>
                    <div className="marketing-progress-track">
                      <span style={{ width: '86%' }} />
                    </div>
                    <p>12 tasks complete, 4 waiting for review, 2 urgent alerts.</p>
                  </div>

                  <div className="marketing-cockpit-list">
                    {cockpitRows.map((row) => (
                      <div key={row.label} className={`marketing-cockpit-row marketing-cockpit-row-${row.tone}`}>
                        <div>
                          <strong>{row.label}</strong>
                          <span>{row.value}</span>
                        </div>
                        <CheckCircle2 size={18} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="marketing-product-side">
                  <div className="marketing-mini-panel">
                    <UsersRound size={20} />
                    <strong>Team access</strong>
                    <span>Owner, manager, employee</span>
                  </div>
                  <div className="marketing-mini-panel marketing-mini-panel-dark">
                    <Tags size={20} />
                    <strong>Client categories</strong>
                    <span>Agency work grouped by account type</span>
                  </div>
                  <div className="marketing-mini-panel">
                    <BellRing size={20} />
                    <strong>Urgent alerts</strong>
                    <span>Escalations stay visible</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-trust-band">
          <div className="marketing-band-inner">
            {trustPoints.map((point) => {
              const Icon = point.icon
              return (
                <article key={point.title} className="marketing-trust-card">
                  <div className="marketing-mini-icon">
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3>{point.title}</h3>
                    <p>{point.description}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section id="company-types" className="marketing-section">
          <div className="marketing-section-head">
            <span className="marketing-panel-label">Workspace types</span>
            <h2>Start with the structure your company actually needs.</h2>
            <p>
              TASKIT adapts at signup, so each company enters the product with the right labels, hierarchy, and workflow
              from the first session. Agencies can structure clients by category before campaigns become briefs and tasks.
            </p>
          </div>

          <div className="marketing-track-grid">
            {companyTracks.map((track) => {
              const Icon = track.icon
              return (
                <article key={track.value} className="marketing-feature-card">
                  <div className="marketing-card-topline">
                    <div className="marketing-mini-icon">
                      <Icon size={18} />
                    </div>
                    <span>{track.workspaceLabel}</span>
                  </div>
                  <h3>{track.label}</h3>
                  <p>{track.description}</p>
                  <div className="marketing-card-list">
                    {track.bullets.map((bullet) => (
                      <div key={bullet}>
                        <CheckCircle2 size={15} />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                  <Link href={track.href} className="btn-primary">
                    <span>{track.cta}</span>
                    <ArrowRight size={16} strokeWidth={2.2} />
                  </Link>
                </article>
              )
            })}
          </div>
        </section>

        <section id="features" className="marketing-section marketing-section-split">
          <div className="marketing-section-head">
            <span className="marketing-panel-label">Capabilities</span>
            <h2>Professional task control without forcing every team into the same workflow.</h2>
            <p>
              Keep the product simple for employees while giving owners and managers enough structure to control real
              work across departments, clients, and projects.
            </p>
          </div>

          <div className="marketing-feature-grid">
            {featureCards.map((feature) => {
              const Icon = feature.icon
              return (
                <article key={feature.title} className="marketing-feature-card">
                  <div className="marketing-mini-icon">
                    <Icon size={18} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section id="workflow" className="marketing-section marketing-workflow">
          <div className="marketing-section-head">
            <span className="marketing-panel-label">Workflow</span>
            <h2>From signup to daily execution, every step has a clear purpose.</h2>
          </div>

          <div className="marketing-step-grid">
            {workflowSteps.map((step, index) => (
              <article key={step.title} className="marketing-step-card">
                <span className="marketing-step-number">0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="trust" className="marketing-section marketing-dark-section">
          <div className="marketing-dark-copy">
            <span className="marketing-panel-label">Security and clarity</span>
            <h2>Enterprise-grade governance. Everyday team simplicity.</h2>
            <p>
              TASKIT keeps accountability transparent, enforces role-based access control, and provides teams a reliable
              system for tracking work from assignment through completion.
            </p>
          </div>

          <div className="marketing-highlight-list">
            {workspaceHighlights.map((item) => (
              <div key={item} className="marketing-highlight-row">
                <ShieldCheck size={18} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="marketing-cta">
          <div>
            <span className="marketing-panel-label">Start now</span>
            <h2>Choose your workspace type and launch TASKIT with the right structure.</h2>
            <p>Configure your company, invite your team, and begin executing work with professional operational discipline.</p>
          </div>

          <div className="marketing-cta-actions">
            <Link href={primaryHref} className="btn-primary">
              <span>{primaryLabel}</span>
              <ArrowRight size={17} strokeWidth={2.2} />
            </Link>
            <Link href={secondaryHref} className="btn-secondary">
              {secondaryLabel}
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
