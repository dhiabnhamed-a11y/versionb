'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import NextImage from 'next/image'
import logo from '@/app/logo.png'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Download,
  FileText,
  Grid3X3,
  Image as ImageIcon,
  Layers3,
  Megaphone,
  Monitor,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  TrendingUp,
  Upload,
  UserRound,
  UsersRound,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import styles from './TaskitLandingPage.module.css'

type TaskitLandingPageProps = {
  dashboardHref: string
  isSignedIn: boolean
}

type ChatMessage = {
  id: string
  role: 'user' | 'ai'
  content: string
  action?: string
  report?: boolean
}

type Feature = {
  title: string
  description: string
  icon: LucideIcon
  tone?: 'blue' | 'cyan' | 'green'
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
  { label: 'Total Revenue', value: '$148,240', delta: '+12.5%' },
  { label: 'Active Campaigns', value: '24', delta: '+6.2%' },
  { label: 'Tasks Completed', value: '92%', delta: '+14.3%' },
  { label: 'Team Capacity', value: '78%', delta: '+6.1%', warm: true },
]

const insights = [
  { text: '3 campaigns at risk', link: 'View details', icon: AlertTriangle, tone: 'orange' },
  { text: 'Team overload detected', link: 'Balance workload', icon: Zap, tone: 'blue' },
  { text: 'Invoice overdue', link: 'Send reminder', icon: Bell, tone: 'red' },
  { text: 'Client engagement down', link: 'See analysis', icon: TrendingUp, tone: 'green' },
]

const activities = [
  { text: "Campaign 'Brand Launch' approved", time: '2m ago', icon: Megaphone },
  { text: 'New Invoice #INV-1240 paid', time: '10m ago', icon: FileText },
  { text: 'Design assets uploaded', time: '32m ago', icon: Upload },
]

const tasks = [
  { name: 'Create campaign brief', badge: 'High', tone: 'high' },
  { name: 'Review deliverables', badge: 'Medium', tone: 'medium' },
  { name: 'Client presentation', badge: 'Low', tone: 'low' },
]

const logos = ['inspire', 'vertex', 'brightly', 'horizon', 'nova', 'stack', 'craftwork']

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

const initialChat: ChatMessage[] = [
  { id: 'risk-question', role: 'user', content: 'Which campaigns are at risk?' },
  {
    id: 'risk-answer',
    role: 'ai',
    content: 'I found 3 campaigns at risk due to delays and pending approvals.',
    action: 'View at risk campaigns',
  },
  { id: 'report-question', role: 'user', content: 'Generate weekly performance report' },
  {
    id: 'report-answer',
    role: 'ai',
    content: 'Weekly performance report is ready.',
    report: true,
  },
]

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

export default function TaskitLandingPage({ dashboardHref, isSignedIn }: TaskitLandingPageProps) {
  const [scrolled, setScrolled] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [chat, setChat] = useState<ChatMessage[]>(initialChat)

  const primaryHref = isSignedIn ? dashboardHref : '/signup'
  const loginHref = isSignedIn ? dashboardHref : '/login'
  const primaryLabel = isSignedIn ? 'Open workspace' : 'Get started'
  const heroPrimaryLabel = isSignedIn ? 'Open workspace' : 'Start free trial'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const chatMessages = useMemo(() => chat.slice(-6), [chat])

  const sendAiMessage = () => {
    const value = aiInput.trim()
    if (!value) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: value,
    }
    const reply: ChatMessage = {
      id: `ai-${Date.now()}`,
      role: 'ai',
      content: "Processing your request. I'll analyze the live workspace data and return the next best action.",
      action: 'Run analysis',
    }

    setChat((current) => [...current, userMessage, reply])
    setAiInput('')
  }

  return (
    <main id="main-content" className={styles.landing}>
      <header className={cx(styles.nav, scrolled && styles.navScrolled)}>
        <Link href="/" className={styles.navLogo} aria-label="TASKIT OS home">
          <LogoMark />
          TASKIT OS
        </Link>

        <nav className={styles.navLinks} aria-label="Landing navigation">
          <a href="#product">Product <ChevronDown size={12} aria-hidden="true" /></a>
          <a href="#features">Solutions <ChevronDown size={12} aria-hidden="true" /></a>
          <a href="#ai-assistant">Resources <ChevronDown size={12} aria-hidden="true" /></a>
          <a href="#cta">Pricing</a>
          <a href="#features">Enterprise</a>
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
            Manage clients, campaigns, teams, finances and operations in one intelligent platform. Built to scale your agency to the next level.
          </p>
          <div className={styles.heroCtas}>
            <Link href={primaryHref} className={cx(styles.btnHero, styles.btnHeroPrimary)}>
              {heroPrimaryLabel}
              <ArrowIcon />
            </Link>
            <a href="#ai-assistant" className={cx(styles.btnHero, styles.btnHeroSecondary)}>
              Book a demo
            </a>
          </div>
          <div className={styles.heroTrust}>
            <div className={styles.trustAvatars} aria-hidden="true">
              <span>H</span>
              <span>A</span>
              <span>M</span>
              <span>S</span>
            </div>
            <p>Trusted by <strong>2,500+ agencies</strong> worldwide</p>
          </div>
        </div>

        <DashboardMockup />
      </section>

      <section className={styles.logosStrip} aria-label="Trusted agencies">
        <p>Trusted by leading agencies</p>
        <div className={styles.logosRow}>
          {logos.map((logo, index) => (
            <span key={logo} className={styles.logoBrand}>
              {index % 3 === 0 ? <Sparkles size={18} aria-hidden="true" /> : null}
              {logo}
            </span>
          ))}
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
            TASKIT OS unifies your entire workflow with AI-powered automation, live analytics, and seamless collaboration. Built for speed, built for scale, built for agencies.
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
          <div>
            <div className={styles.aiEyebrow}>AI Assistant</div>
            <h2 className={styles.aiTitle}>
              Your agency copilot,
              <br />
              <span>available 24/7.</span>
            </h2>
            <p>Ask anything. Get insights. Automate tasks. Make smarter decisions, faster.</p>
            <Link href={primaryHref} className={cx(styles.btnHero, styles.btnHeroPrimary)}>
              Try AI Assistant
              <ArrowIcon />
            </Link>
          </div>

          <div className={styles.aiChatDemo}>
            <div className={styles.aiChatHeader}>
              <div className={styles.aiAvatar}><LogoMark compact /></div>
              <div>
                <strong>TASKIT AI</strong>
                <span>Online</span>
              </div>
            </div>
            <div className={styles.aiMessages}>
              {chatMessages.map((message) => (
                <div key={message.id} className={cx(styles.msg, message.role === 'user' ? styles.msgUser : styles.msgAi)}>
                  {message.content}
                  {message.action ? (
                    <div className={styles.msgActionLink}>
                      {message.action}
                      <ArrowRight size={12} aria-hidden="true" />
                    </div>
                  ) : null}
                  {message.report ? (
                    <div className={styles.msgReportBadge}>
                      <span>Report ready</span>
                      <span>
                        Download report
                        <Download size={11} aria-hidden="true" />
                      </span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className={styles.aiInputRow}>
              <input
                className={styles.aiInput}
                type="text"
                value={aiInput}
                placeholder="Ask anything..."
                onChange={(event) => setAiInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') sendAiMessage()
                }}
              />
              <button type="button" className={styles.aiSend} onClick={sendAiMessage} aria-label="Send AI demo message">
                <Send size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.ctaBand} id="cta">
        <h2>
          Ready to run your agency
          <br />
          like an <span>operating system?</span>
        </h2>
        <p>Join 2,500+ agencies already using TASKIT OS to scale smarter.</p>
        <div className={styles.ctaBtns}>
          <Link href={primaryHref} className={cx(styles.btnHero, styles.btnHeroPrimary)}>
            {heroPrimaryLabel}
            <ArrowIcon />
          </Link>
          <a href="#ai-assistant" className={cx(styles.btnHero, styles.btnHeroSecondary)}>
            Book a demo
          </a>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link href="/" className={styles.footerLogo}>
          <LogoMark compact />
          TASKIT OS
        </Link>
        <div className={styles.footerLinks}>
          <a href="#product">Product</a>
          <a href="#cta">Pricing</a>
          <a href="#features">About</a>
          <a href="#ai-assistant">Blog</a>
          <a href="#cta">Careers</a>
          <a href="#cta">Privacy</a>
          <a href="#cta">Terms</a>
        </div>
        <p>© 2026 TASKIT OS. All rights reserved.</p>
      </footer>
    </main>
  )
}

function DashboardMockup() {
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
            <button type="button"><Plus size={11} /> New</button>
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
            <div className={styles.dashWelcome}>Welcome back, Hamed</div>
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
                <div className={styles.chartTitle}>Revenue overview <span>This month</span></div>
                <div className={styles.chartArea}>
                  <div className={styles.chartTooltip}>$148,240</div>
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
