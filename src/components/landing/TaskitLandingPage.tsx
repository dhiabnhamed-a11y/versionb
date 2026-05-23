'use client'

import { type CSSProperties, useEffect, useState } from 'react'
import Link from 'next/link'
import NextImage from 'next/image'
import { motion } from 'framer-motion'
import logo from '@/app/logo.png'
import { COMPANY_TYPE_OPTIONS, type CompanyType } from '@/lib/company-types'
import LottiePlayer from '@/components/ui/lottie-player'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  Grid3X3,
  Image as ImageIcon,
  Layers,
  Layers3,
  Megaphone,
  Monitor,
  Music2,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  Upload,
  UserRound,
  UsersRound,
  Zap,
  Infinity,
  Users,
  type LucideIcon,
} from 'lucide-react'
import styles from './TaskitLandingPage.module.css'

type TaskitLandingPageProps = {
  dashboardHref: string
  isSignedIn: boolean
  liveStats?: LandingStat[]
}

type Feature = {
  title: string
  description: string
  icon: LucideIcon
  tone?: 'blue' | 'cyan' | 'green'
}

type LandingStat = {
  value: string
  label: string
}

const sidebarItems = [
  { label: 'Command', icon: Grid3X3, active: true },
  { label: 'Clients', icon: UserRound },
  { label: 'Campaigns', icon: Megaphone },
  { label: 'AI Ops', icon: Bot },
  { label: 'Automation', icon: Layers3 },
  { label: 'Teams', icon: UsersRound },
  { label: 'Finance', icon: CircleDollarSign },
  { label: 'Media', icon: ImageIcon },
  { label: 'Reports', icon: BarChart3 },
  { label: 'Settings', icon: Settings },
]

const metrics = [
  { label: 'Client CRM', value: 'Contacts', delta: 'Track' },
  { label: 'Campaign OS', value: 'Briefs', delta: 'Plan' },
  { label: 'Approvals', value: 'Reviews', delta: 'Control' },
  { label: 'Capacity', value: 'Workload', delta: 'Balance', warm: true },
]

const insights = [
  { text: 'Flag delayed campaigns', link: 'Review timeline', icon: AlertTriangle, tone: 'orange' },
  { text: 'Spot workload pressure', link: 'Balance team', icon: Zap, tone: 'blue' },
  { text: 'Surface pending approvals', link: 'Open queue', icon: Bell, tone: 'red' },
  { text: 'Summarize performance trends', link: 'View report', icon: TrendingUp, tone: 'green' },
]

const activities = [
  { text: 'Campaign approval updates', time: 'Live', icon: Megaphone },
  { text: 'Invoice and contract activity', time: 'Synced', icon: FileText },
  { text: 'Creative deliverable uploads', time: 'Tracked', icon: Upload },
]

const tasks = [
  { name: 'Create campaign brief', badge: 'High', tone: 'high' },
  { name: 'Review deliverables', badge: 'Medium', tone: 'medium' },
  { name: 'Client presentation', badge: 'Low', tone: 'low' },
]

const productModules = sidebarItems.map((item) => item.label)

type PricingPlan = {
  key: string
  name: string
  price: string
  priceUnit: string
  desc: string
  features: string[]
  cta: string
  featured?: boolean
  badge?: string
  icon: LucideIcon
  href: string
}

const pricingPlans: PricingPlan[] = [
  {
    key: 'trial',
    name: 'Free Trial',
    price: '$0',
    priceUnit: '7 days free',
    desc: 'Full access to every module for 7 days. No card required.',
    features: [
      'All 10 dashboard modules',
      'Up to 5 team members',
      'AI assistant included',
      'Client portal & CRM',
      'Projects, tasks & campaigns',
    ],
    cta: 'Start free trial',
    icon: Zap,
    href: '/signup',
  },
  {
    key: 'starter',
    name: 'Starter',
    price: '$3',
    priceUnit: '/seat / month',
    desc: 'For teams up to 49 seats. Billed monthly or annually.',
    features: [
      'Everything in Free Trial',
      '1 – 49 seats',
      'Annual billing saves 2 months',
      'Priority support',
      'Seat management dashboard',
    ],
    cta: 'Get started',
    featured: true,
    badge: 'Most popular',
    icon: CheckCircle2,
    href: '/billing/upgrade',
  },
  {
    key: 'team',
    name: 'Team',
    price: '$2.50',
    priceUnit: '/seat / month',
    desc: 'Volume pricing for organisations with 50 or more seats.',
    features: [
      'Everything in Starter',
      '50+ seats (volume pricing)',
      'Dedicated onboarding',
      'SLA-backed support',
      'Advanced usage analytics',
    ],
    cta: 'Talk to us',
    icon: Users,
    href: '/billing/upgrade',
  },
  {
    key: 'lifetime',
    name: 'Lifetime',
    price: '$99',
    priceUnit: '/seat · one-time',
    desc: 'Pay once, own the platform forever. All future updates included.',
    features: [
      'Everything in Team',
      'No recurring subscription',
      'All future updates free',
      'Lifetime support access',
      'Early access to new modules',
    ],
    cta: 'Buy lifetime access',
    icon: Infinity,
    href: '/billing/upgrade',
  },
]

const enterpriseBadges = [
  { label: 'Role-based access', icon: ShieldCheck },
  { label: 'Audit trails', icon: FileText },
  { label: 'Multi-tenant isolation', icon: Building2 },
  { label: 'Realtime ops', icon: Zap },
]

const features: Feature[] = [
  { title: 'Client & CRM', description: 'Manage relationships, track deals, and grow client lifetime value.', icon: UserRound },
  { title: 'Campaign OS', description: 'Plan, execute, and monitor campaigns with complete visibility.', icon: Monitor },
  { title: 'AI Intelligence', description: 'Get AI insights, predictions, and smart recommendations in real time.', icon: Bot, tone: 'cyan' },
  { title: 'Automation', description: 'Automate workflows, approvals, reminders and repetitive tasks.', icon: Layers3 },
  { title: 'Team Management', description: 'Track performance, capacity, workload and keep your team aligned.', icon: UsersRound },
  { title: 'Finance & Billing', description: 'Invoices, subscriptions, expenses and revenue in one place.', icon: CircleDollarSign },
  { title: 'Media & Files', description: 'Organize, preview, approve and manage every creative asset.', icon: FileText },
  { title: 'Analytics & Reports', description: 'Live dashboards and clean reports that drive better decisions.', icon: BarChart3, tone: 'green' },
]

const productStats = [
  { value: String(COMPANY_TYPE_OPTIONS.length), label: 'Workspace types' },
  { value: String(features.length), label: 'Core product areas' },
  { value: String(productModules.length), label: 'Dashboard modules' },
  { value: String(enterpriseBadges.length), label: 'Security & ops controls' },
]

const workflowTypePresentation = {
  INDUSTRY: {
    icon: Building2,
    eyebrow: 'Operations teams',
    accent: '#2dd4bf',
    surface: 'rgba(45, 212, 191, 0.1)',
    outline: 'rgba(45, 212, 191, 0.22)',
    audience: 'Plants, sites, stores, and departments',
    focus: 'Structured execution across separate work areas',
    flow: ['Rooms', 'Projects', 'Tasks'],
  },
  DIGITAL_AGENCY: {
    icon: BriefcaseBusiness,
    eyebrow: 'Creative studios',
    accent: '#fb923c',
    surface: 'rgba(251, 146, 60, 0.1)',
    outline: 'rgba(251, 146, 60, 0.22)',
    audience: 'Design, content, social, and video teams',
    focus: 'Brief-to-upload delivery with faster approvals',
    flow: ['Campaigns', 'Briefs', 'Uploads'],
  },
  CONTENT_CREATION_AGENCY: {
    icon: Music2,
    eyebrow: 'Creator studios',
    accent: '#fb7185',
    surface: 'rgba(251, 113, 133, 0.1)',
    outline: 'rgba(251, 113, 133, 0.22)',
    audience: 'Music, YouTube, Spotify, and social teams',
    focus: 'Release planning with cross-channel performance',
    flow: ['Campaigns', 'Briefs', 'Channel stats'],
  },
  HEALTHCARE: {
    icon: Building2,
    eyebrow: 'Healthcare operations',
    accent: '#22d3ee',
    surface: 'rgba(34, 211, 238, 0.1)',
    outline: 'rgba(34, 211, 238, 0.22)',
    audience: 'Clinics, care networks, and healthcare operations',
    focus: 'Departments, assets, incidents, maintenance, and compliance',
    flow: ['Departments', 'Assets', 'Incidents'],
  },
  ENTERPRISE_OPERATIONS: {
    icon: Layers3,
    eyebrow: 'Enterprise service management',
    accent: '#818cf8',
    surface: 'rgba(129, 140, 248, 0.1)',
    outline: 'rgba(129, 140, 248, 0.22)',
    audience: 'IT, HR, facilities, finance, and shared services',
    focus: 'Service queues, SLAs, approvals, and asset lifecycle',
    flow: ['Departments', 'Queues', 'SLAs'],
  },
  CLINIC_HOSPITAL: {
    icon: ShieldCheck,
    eyebrow: 'Clinic and hospital teams',
    accent: '#34d399',
    surface: 'rgba(52, 211, 153, 0.1)',
    outline: 'rgba(52, 211, 153, 0.22)',
    audience: 'Hospitals, clinics, labs, and care facilities',
    focus: 'Biomedical uptime, facility requests, shifts, and audit evidence',
    flow: ['Clinical ops', 'Devices', 'Compliance'],
  },
  CORPORATE_IT_OPERATIONS: {
    icon: Layers,
    eyebrow: 'Corporate IT',
    accent: '#60a5fa',
    surface: 'rgba(96, 165, 250, 0.1)',
    outline: 'rgba(96, 165, 250, 0.22)',
    audience: 'Service desk, infrastructure, security, and endpoint teams',
    focus: 'Tickets, assets, outages, escalations, and SLA health',
    flow: ['Service desk', 'Assets', 'Uptime'],
  },
  OTHER: {
    icon: Layers3,
    eyebrow: 'Flexible teams',
    accent: '#4a8fff',
    surface: 'rgba(74, 143, 255, 0.1)',
    outline: 'rgba(74, 143, 255, 0.22)',
    audience: 'General project-based collaboration',
    focus: 'Keep the core TASKIT flow and grow later',
    flow: ['Projects', 'Tasks', 'Visibility'],
  },
} as const satisfies Record<
  CompanyType,
  {
    icon: LucideIcon
    eyebrow: string
    accent: string
    surface: string
    outline: string
    audience: string
    focus: string
    flow: readonly string[]
  }
>

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={cx(styles.logoMark, compact && styles.logoMarkCompact)}>
      <NextImage
        src={logo}
        alt=""
        aria-hidden="true"
        className={styles.logoImage}
        sizes={compact ? '24px' : '32px'}
        priority={!compact}
      />
    </span>
  )
}

function ArrowIcon() {
  return <ArrowRight size={16} aria-hidden="true" />
}

export default function TaskitLandingPage({ dashboardHref, isSignedIn, liveStats = [] }: TaskitLandingPageProps) {
  const [scrolled, setScrolled] = useState(false)
  const [annual, setAnnual] = useState(false)

  const primaryHref = isSignedIn ? dashboardHref : '/signup'
  const loginHref = isSignedIn ? dashboardHref : '/login'
  const primaryLabel = isSignedIn ? 'Open workspace' : 'Get started'
  const heroPrimaryLabel = isSignedIn ? 'Open workspace' : 'Create workspace'
  const landingStats = [...liveStats, ...productStats].slice(0, 4)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <main id="main-content" className={styles.landing}>
      <header className={cx(styles.nav, scrolled && styles.navScrolled)}>
        <Link href="/" className={styles.navLogo} aria-label="TASKIT home">
          <NextImage src="/logo.png" alt="" width={110} height={28} style={{ objectFit: 'contain' }} priority />
        </Link>

        <nav className={styles.navLinks} aria-label="Landing navigation">
          <a href="#product">Product</a>
          <a href="#solutions">Solutions</a>
          <a href="#pricing">Pricing</a>
        </nav>

        <div className={styles.navRight}>
          <Link href={loginHref} className={styles.btnGhost}>
            {isSignedIn ? 'Workspace' : 'Log in'}
          </Link>
          <Link href={primaryHref} className={styles.btnPrimary}>
            {primaryLabel}
            <ArrowIcon />
          </Link>
        </div>
      </header>

      <section className={styles.hero} id="product">
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}><span />AI-Powered Agency Operating System</div>
          <h1 className={styles.heroTitle}>
            The operating
            <br />
            system for
            <br />
            <span>modern agencies.</span>
          </h1>
          <p className={styles.heroSub}>
            Manage clients, campaigns, teams, finances, deliverables, reports, and operations in one workspace built from TASKIT modules.
          </p>
          <div className={styles.heroCtas}>
            <Link href={primaryHref} className={cx(styles.btnHero, styles.btnHeroPrimary)}>
              {heroPrimaryLabel}
              <ArrowIcon />
            </Link>
            <a href="#features" className={cx(styles.btnHero, styles.btnHeroSecondary)}>
              View directories
            </a>
          </div>
          <div className={styles.heroClients}>
            <span>Trusted by</span>
            <div className={styles.clientLogos}>
              <span className={styles.clientLogo}>STUDIO NEO</span>
              <span className={styles.clientLogo}>CREATIVE LAB</span>
              <span className={styles.clientLogo}>AGENCY X</span>
              <span className={styles.clientLogo}>BRAND CO.</span>
              <span className={styles.clientLogo}>PIXELWORKS</span>
            </div>
          </div>
          <div className={styles.heroTrust}>
            <div className={styles.trustAvatars} aria-hidden="true">
              <span>C</span>
              <span>A</span>
              <span>T</span>
              <span>R</span>
            </div>
            <p>Built for <strong>clients, approvals, tasks, and reports</strong></p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          viewport={{ once: true }}
          className={styles.heroVisual}
        >
          <LottiePlayer
            src="https://assets10.lottiefiles.com/packages/lf20_jcikwtux.json"
            width={550}
            height={420}
            speed={0.8}
          />
        </motion.div>
      </section>

      <section className={styles.statsBar} aria-label="TASKIT platform facts">
        {landingStats.map((stat) => (
          <div key={stat.label} className={styles.statItem}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </section>

      <section className={styles.logosStrip} aria-label="TASKIT product modules">
        <p>Built around real TASKIT modules</p>
        <div className={styles.logosRow}>
          {productModules.map((module, index) => (
            <span key={module} className={styles.logoBrand}>
              {index % 3 === 0 ? <Zap size={18} aria-hidden="true" /> : null}
              {module}
            </span>
          ))}
        </div>
      </section>

      <section className={styles.productTypes} id="solutions">
        <div className={styles.productTypesHeader}>
          <div>
            <div className={styles.sectionEyebrow}>Product workflows</div>
            <h2 className={styles.productTypesTitle}>
              Choose the operating model
              <br />
              your team actually runs.
            </h2>
          </div>
          <p>
            Start with a purpose-built workspace for operations, agencies, creator teams, healthcare, enterprise service
            management, IT, or the standard TASKIT flow.
          </p>
        </div>

        <div className={styles.productTypesGrid}>
          {COMPANY_TYPE_OPTIONS.map((option) => {
            const presentation = workflowTypePresentation[option.value]
            const Icon = presentation.icon
            const isDefault = option.value === 'OTHER'
            const href = isSignedIn ? dashboardHref : `/signup?companyType=${option.slug}`
            const productStyle = {
              '--workflow-accent': presentation.accent,
              '--workflow-surface': presentation.surface,
              '--workflow-outline': presentation.outline,
            } as CSSProperties

            return (
              <article key={option.value} className={styles.productTypeCard} style={productStyle}>
                <div className={styles.productTypeTop}>
                  <div className={styles.productTypeIcon}>
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <div className={styles.productTypeHeading}>
                    <span>{presentation.eyebrow}</span>
                    <strong>{option.label}</strong>
                  </div>
                  <Link href={href} className={cx(styles.productTypeAction, isDefault && styles.productTypeActionSelected)}>
                    {isSignedIn ? 'Open' : isDefault ? 'Selected' : 'Choose'}
                  </Link>
                </div>

                <div className={styles.productTypeWorkspace}>{option.workspaceLabel}</div>
                <h3>{option.title}</h3>
                <p>{option.description}</p>

                <div className={styles.productTypeFlow} aria-label={`${option.label} workflow`}>
                  {presentation.flow.map((step, index) => (
                    <span key={`${option.value}-${step}`}>
                      {index > 0 ? <ArrowRight size={13} aria-hidden="true" /> : null}
                      {step}
                    </span>
                  ))}
                </div>

                <div className={styles.productTypeMeta}>
                  <span>Best for {presentation.audience}</span>
                  <span>{presentation.focus}</span>
                </div>

                <div className={styles.productTypeBullets}>
                  {option.bullets.map((bullet) => (
                    <div key={bullet}>
                      <CheckCircle2 size={14} aria-hidden="true" />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className={styles.features} id="features">
        <div className={styles.featuresHeader}>
          <div>
            <div className={styles.sectionEyebrow}>All-in-one Platform</div>
            <h2 className={styles.featuresTitle}>
              Everything your agency
              <br />
              needs. <span>One intelligent operating system.</span>
            </h2>
          </div>
          <p>
            TASKIT OS unifies workflow setup, client work, deliverables, approvals, finance, reporting, and collaboration in one product experience.
          </p>
        </div>
        <div className={styles.featuresGrid}>
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <article key={feature.title} className={styles.featureCard} style={{ animationDelay: `${index * 45}ms` }}>
                <div className={cx(styles.featureIconWrap, feature.tone === 'cyan' && styles.featureIconCyan, feature.tone === 'green' && styles.featureIconGreen)}>
                  <Icon size={22} aria-hidden="true" />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <span className={styles.featureArrow} aria-hidden="true">
                  <ArrowRight size={13} />
                </span>
              </article>
            )
          })}
        </div>
      </section>

      <section className={styles.aiSection} id="ai-assistant">
        <div className={styles.aiInner}>
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            viewport={{ once: true }}
          >
            <LottiePlayer
              src="https://lottie.host/753efe02-9bf9-43f7-8560-8e2ad1978b6c/JOcswhdJsa.json"
              width={400}
              height={350}
              speed={0.8}
            />
          </motion.div>
          <div>
            <div className={styles.aiEyebrow}>AI Assistant</div>
            <h2 className={styles.aiTitle}>
              Your agency copilot,
              <br />
              <span>inside your workspace.</span>
            </h2>
            <p>Ask questions, summarize workspace activity, and turn operational context into next steps.</p>
            <Link href={primaryHref} className={cx(styles.btnHero, styles.btnHeroPrimary)}>
              Try AI Assistant
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      <section className={cx(styles.featureShowcase, styles.featureShowcaseAlt)} id="finance">
        <div className={styles.featureShowcaseInner}>
          <div>
            <div className={styles.sectionEyebrow}>Finance & Billing</div>
            <h2><span>Invoices, subscriptions,</span><br />expenses & revenue.</h2>
            <p>Track every dollar in and out of your agency. Create invoices, manage subscriptions, log expenses, and monitor revenue — all inside TASKIT.</p>
          </div>
          <motion.div
            className={styles.featureShowcaseVisual}
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            viewport={{ once: true }}
          >
            <LottiePlayer
              src="https://assets3.lottiefiles.com/packages/lf20_x62chJ.json"
              width={400}
              height={350}
              speed={0.8}
            />
          </motion.div>
        </div>
      </section>

      <section className={styles.featureShowcase} id="realtime">
        <div className={styles.featureShowcaseInner}>
          <motion.div
            className={styles.featureShowcaseVisual}
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            viewport={{ once: true }}
          >
            <LottiePlayer
              src="https://assets5.lottiefiles.com/packages/lf20_vmollwvl.json"
              width={400}
              height={350}
              speed={0.8}
            />
          </motion.div>
          <div>
            <div className={styles.sectionEyebrow}>Realtime Operations</div>
            <h2><span>Live updates,</span><br />automation & alerts.</h2>
            <p>Automate workflows, approvals, reminders, and repetitive tasks. Get notified about overdue items, approvals, and important updates in real time.</p>
          </div>
        </div>
      </section>

      <section className={cx(styles.featureShowcase, styles.featureShowcaseAlt)} id="enterprise-features">
        <div className={styles.featureShowcaseInner}>
          <div>
            <div className={styles.sectionEyebrow}>Enterprise & Team</div>
            <h2><span>Role-based access,</span><br />audit trails & scale.</h2>
            <p>Role-based access, audit trails, tenant-aware data, and health checks built in. Track team performance, capacity, and workload alignment.</p>
          </div>
          <motion.div
            className={styles.featureShowcaseVisual}
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            viewport={{ once: true }}
          >
            <LottiePlayer
              src="https://assets2.lottiefiles.com/packages/lf20_yr6zz3wv.json"
              width={400}
              height={350}
              speed={0.8}
            />
          </motion.div>
        </div>
      </section>

      <section className={styles.enterpriseBand} id="enterprise">
        <div className={styles.enterpriseInner}>
          <div>
            <div className={styles.sectionEyebrow}>Enterprise grade</div>
            <h2 className={styles.enterpriseTitle}>Built for serious SaaS scale</h2>
            <p className={styles.enterpriseCopy}>
              Role-based access, audit trails, tenant-aware data, realtime modules, job queues, and health checks are implemented across the platform.
            </p>
          </div>
          <div className={styles.enterpriseBadges}>
            {enterpriseBadges.map((badge) => {
              const Icon = badge.icon
              return (
                <div key={badge.label} className={styles.enterpriseBadge}>
                  <Icon size={18} aria-hidden="true" />
                  <span>{badge.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className={styles.pricingSection} id="pricing">
        <div className={styles.pricingHeader}>
          <div className={styles.sectionEyebrow}>Pricing</div>
          <h2>Simple, <span>transparent</span> pricing</h2>
          <p>Per-seat pricing that scales with your team. Start free, upgrade when ready.</p>
        </div>

        <div className={styles.pricingToggle}>
          <span className={!annual ? styles.active : ''}>Monthly</span>
          <div className={cx(styles.toggleTrack, annual && styles.active)} onClick={() => setAnnual(!annual)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setAnnual(!annual) }}>
            <div className={styles.toggleThumb} />
          </div>
          <span className={annual ? styles.active : ''}>Annual <span style={{ color: 'var(--landing-blue)', fontSize: 12, fontWeight: 700 }}>Save 20%</span></span>
        </div>

        <div className={styles.pricingGrid}>
          {pricingPlans.map((plan) => {
            const Icon = plan.icon
            return (
              <div
                key={plan.key}
                className={cx(styles.planCard, plan.featured ? styles.planCardFeatured : undefined)}
              >
                {plan.badge && <span className={styles.planBadge}>{plan.badge}</span>}
                <div className={styles.planName}>
                  <Icon size={13} aria-hidden="true" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                  {plan.name}
                </div>
                <div className={styles.planPrice}>
                  <span className={styles.planPriceAmount}>{plan.price}</span>
                  <span className={styles.planPriceUnit}>{plan.priceUnit}</span>
                </div>
                <p className={styles.planDesc}>{plan.desc}</p>
                <ul className={styles.planFeatures}>
                  {plan.features.map((f) => (
                    <li key={f} className={styles.planFeatureItem}>
                      <CheckCircle2 size={14} aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={cx(styles.planCta, plan.featured ? styles.planCtaPrimary : undefined)}
                >
                  {plan.cta}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            )
          })}
        </div>

        <p className={styles.pricingNote}>
          All plans include every module. No hidden fees. 30-day money-back guarantee on paid plans.
        </p>
      </section>

      <section className={styles.ctaBand} id="cta">
        <h2>
          Ready to run your agency
          <br />
          like an <span>operating system?</span>
        </h2>
        <p>Create a real TASKIT workspace and use the modules already built into the platform.</p>
        <Link href={primaryHref} className={cx(styles.btnHero, styles.btnHeroPrimary)}>
          {heroPrimaryLabel}
          <ArrowIcon />
        </Link>
        <div className={styles.ctaTrust}>
          <span>No credit card required</span>
          <span>14-day free trial</span>
          <span>Cancel anytime</span>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link href="/" className={styles.footerLogo}>
          <NextImage src="/logo.png" alt="" width={90} height={22} style={{ objectFit: 'contain' }} />
        </Link>
        <div className={styles.footerLinks}>
          <a href="#solutions">Product</a>
          <a href="#features">Platform</a>
          <a href="#pricing">Pricing</a>
          <Link href="/ai-transparency">AI transparency</Link>
          <Link href="/acceptable-use">Acceptable use</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
        <div className={styles.footerMeta}>
          <p>Developed by Hamed Dhieb</p>
          <p>© 2026 TASKIT OS. All rights reserved.</p>
        </div>
      </footer>
    </main>
  )
}

export function DashboardMockup() {
  return (
    <div className={styles.heroVisual} aria-label="TASKIT OS dashboard preview">
      <div className={styles.dashboardFrame}>
        <div className={styles.dashTopbar}>
          <div className={styles.dashLogo}>
            <LogoMark compact />
            TASKIT OS
          </div>
          <div className={styles.dashSearch}>
            <Search size={12} aria-hidden="true" />
            Search...
          </div>
          <div className={styles.dashActions}>
            <span><Plus size={12} /></span>
            <span><Clock3 size={12} /></span>
            <span><Bell size={12} /></span>
            <span className="pointer-events-none opacity-80"><Plus size={11} /> New</span>
          </div>
        </div>

        <div className={styles.dashBody}>
          <aside className={styles.dashSidebar} aria-label="Preview navigation">
            {sidebarItems.map((item) => {
              const Icon = item.icon
              return (
                <a key={item.label} className={item.active ? styles.active : undefined} href="#product" aria-label={item.label}>
                  <Icon size={13} aria-hidden="true" />
                  {item.label}
                </a>
              )
            })}
          </aside>

          <div className={styles.dashMain}>
            <div className={styles.dashWelcome}>TASKIT workspace preview</div>
            <div className={styles.dashMetrics}>
              {metrics.map((metric) => (
                <div key={metric.label} className={styles.metricCard}>
                  <div className={styles.metricLabel}>{metric.label}</div>
                  <div className={styles.metricValue}>{metric.value}</div>
                  <div className={cx(styles.metricDelta, metric.warm && styles.metricDeltaWarm)}>
                    <TrendingUp size={9} aria-hidden="true" />
                    {metric.delta}
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.dashCharts}>
              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>Workflow overview <span>Preview</span></div>
                <div className={styles.chartArea}>
                  <div className={styles.chartTooltip}>Activity trend</div>
                  <svg className={styles.chartSvg} viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <linearGradient id="taskitRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4a8fff" stopOpacity=".3" />
                        <stop offset="100%" stopColor="#4a8fff" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0 50 C20 45,40 40,60 35 C80 30,90 20,110 15 C130 10,150 8,170 5 C185 3,195 4,200 4" fill="none" stroke="#4a8fff" strokeWidth="1.5" />
                    <path d="M0 50 C20 45,40 40,60 35 C80 30,90 20,110 15 C130 10,150 8,170 5 C185 3,195 4,200 4 L200 60 L0 60 Z" fill="url(#taskitRevenueGradient)" />
                    <circle cx="170" cy="5" r="3" fill="#4a8fff" />
                    <line x1="0" y1="60" x2="200" y2="60" stroke="#1a2540" strokeWidth=".5" />
                  </svg>
                </div>
              </div>

              <div className={cx(styles.chartCard, styles.aiInsights)}>
                <div className={styles.insightTitle}>AI Insights</div>
                {insights.map((insight) => {
                  const Icon = insight.icon
                  return (
                    <div key={insight.text} className={styles.insightItem}>
                      <span className={cx(styles.insightDot, styles[`insight${insight.tone}`])}>
                        <Icon size={10} aria-hidden="true" />
                      </span>
                      <div>
                        <div className={styles.insightText}>{insight.text}</div>
                        <div className={styles.insightLink}>{insight.link} →</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className={styles.dashBottom}>
              <div className={styles.activityCard}>
                <div className={styles.sectionTitleSm}>Recent activity</div>
                {activities.map((activity) => {
                  const Icon = activity.icon
                  return (
                    <div key={activity.text} className={styles.activityItem}>
                      <span className={styles.activityIcon}><Icon size={9} aria-hidden="true" /></span>
                      <div className={styles.activityText}>{activity.text}</div>
                      <div className={styles.activityTime}>{activity.time}</div>
                    </div>
                  )
                })}
              </div>

              <div className={styles.tasksCard}>
                <div className={styles.sectionTitleSm}>Tasks</div>
                {tasks.map((task) => (
                  <div key={task.name} className={styles.taskItem}>
                    <div className={styles.taskName}>{task.name}</div>
                    <span className={cx(styles.taskBadge, styles[`badge${task.tone}`])}>{task.badge}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
