'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Bot,
  BrainCircuit,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Command,
  FileCheck2,
  FileText,
  FolderKanban,
  Gauge,
  GitBranch,
  Globe2,
  KanbanSquare,
  Layers3,
  LockKeyhole,
  MessageSquareText,
  PanelLeft,
  Play,
  ReceiptText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
  WandSparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import {
  architectureLayers,
  automationBlueprint,
  opsModules,
  roleMatrix,
  type OpsModule,
} from '@/lib/agency-ops-blueprint'

type AgencyOperationsExperienceProps = {
  dashboardHref: string
  isSignedIn: boolean
}

const moduleIcons: Record<string, LucideIcon> = {
  command: Gauge,
  clients: Building2,
  projects: FolderKanban,
  portal: Globe2,
  billing: ReceiptText,
  automation: GitBranch,
  assistant: Bot,
  resources: UsersRound,
}

const navigation = [
  { label: 'Command', icon: Gauge },
  { label: 'Clients', icon: Building2 },
  { label: 'Projects', icon: KanbanSquare },
  { label: 'Portal', icon: Globe2 },
  { label: 'Billing', icon: CircleDollarSign },
  { label: 'Automations', icon: GitBranch },
  { label: 'AI', icon: BrainCircuit },
]

const boardColumns = [
  {
    title: 'Intake',
    count: 9,
    cards: ['Website redesign brief', 'Q3 launch assets', 'Paid media request'],
  },
  {
    title: 'Production',
    count: 24,
    cards: ['Brand system rollout', 'Landing page sprint', 'Podcast edit package'],
  },
  {
    title: 'Review',
    count: 13,
    cards: ['Homepage v4 approval', 'Sales deck annotations', 'Invoice draft review'],
  },
  {
    title: 'Approved',
    count: 38,
    cards: ['May retainer report', 'Launch video final', 'SOP migration pack'],
  },
]

const executiveMetrics = [
  { label: 'Revenue in flight', value: '$1.42M', delta: '+18%', icon: CircleDollarSign },
  { label: 'Projects on track', value: '94%', delta: '+7%', icon: Gauge },
  { label: 'Billable utilization', value: '82%', delta: '+11%', icon: Clock3 },
  { label: 'Client SLA', value: '98.4%', delta: '+3%', icon: BadgeCheck },
]

const clientRows = [
  { name: 'Northstar Labs', health: 96, revenue: '$74k', status: 'Retainer' },
  { name: 'Arc Studio', health: 88, revenue: '$42k', status: 'Campaign' },
  { name: 'Helio Capital', health: 79, revenue: '$118k', status: 'Approval risk' },
]

const integrations = ['Slack', 'Discord', 'Google Drive', 'Figma', 'Zoom', 'Stripe', 'PayPal', 'Calendar', 'Outlook', 'Zapier']

function ModuleIcon({ module }: { module: OpsModule }) {
  const Icon = moduleIcons[module.id] ?? Layers3
  return <Icon size={18} />
}

export default function AgencyOperationsExperience({
  dashboardHref,
  isSignedIn,
}: AgencyOperationsExperienceProps) {
  const [activeModuleId, setActiveModuleId] = useState(opsModules[0]?.id ?? 'command')
  const activeModule = useMemo(
    () => opsModules.find((module) => module.id === activeModuleId) ?? opsModules[0],
    [activeModuleId]
  )

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_2%,rgba(37,99,235,0.24),transparent_27rem),radial-gradient(circle_at_88%_6%,rgba(20,184,166,0.18),transparent_24rem),linear-gradient(180deg,#07090e_0%,#0b1018_52%,#07090e_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07090e]/[0.82] backdrop-blur-2xl">
        <nav className="mx-auto flex min-h-16 w-full max-w-[1480px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-white/5">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
              <Command size={19} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black tracking-[0.14em] text-white">TASKIT OS</span>
              <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Agency operations platform
              </span>
            </span>
          </Link>

          <div className="ml-auto hidden items-center gap-1 rounded-lg border border-white/10 bg-white/[0.035] p-1 lg:flex">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <a
                  key={item.label}
                  href={`#${item.label.toLowerCase()}`}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold text-slate-400 transition hover:bg-white/[0.07] hover:text-white"
                >
                  <Icon size={14} />
                  {item.label}
                </a>
              )
            })}
          </div>

          <Link
            href={isSignedIn ? dashboardHref : '/signup'}
            className="ml-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-cyan-200 px-4 text-sm font-black text-slate-950 shadow-[0_14px_35px_rgba(103,232,249,0.2)] transition hover:bg-white lg:ml-3"
          >
            {isSignedIn ? 'Open workspace' : 'Launch workspace'}
            <ArrowRight size={15} />
          </Link>
        </nav>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid w-full max-w-[1480px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8">
          <aside className="hidden rounded-lg border border-white/10 bg-white/[0.035] p-3 backdrop-blur-xl lg:block">
            <div className="mb-3 flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Workspace</span>
              <PanelLeft size={15} className="text-slate-500" />
            </div>
            <div className="space-y-1">
              {opsModules.map((module) => (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => setActiveModuleId(module.id)}
                  className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition ${
                    activeModuleId === module.id
                      ? 'border-cyan-300/30 bg-cyan-300/10 text-white'
                      : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-white/[0.07] text-cyan-200">
                    <ModuleIcon module={module} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{module.title}</span>
                    <span className="block truncate text-[11px] font-semibold text-slate-500">{module.eyebrow}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.08] p-3">
              <div className="flex items-center gap-2 text-sm font-black text-emerald-100">
                <ShieldCheck size={16} />
                Enterprise control
              </div>
              <p className="mt-2 text-xs leading-5 text-emerald-100/65">
                Tenant isolation, RBAC, audit logs, 2FA-ready auth, encryption boundaries, and GDPR-ready data flows.
              </p>
            </div>
          </aside>

          <div className="min-w-0">
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl"
              >
                <div className="border-b border-white/10 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                        <Sparkles size={14} />
                        Investor-ready agency operating system
                      </div>
                      <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[1.02] tracking-normal text-white sm:text-6xl">
                        Run clients, projects, billing, approvals, automations, and AI from one command surface.
                      </h1>
                    </div>
                    <div className="grid min-w-[160px] gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Live pulse</span>
                      <span className="text-2xl font-black text-cyan-100">2,847</span>
                      <span className="text-xs font-semibold text-slate-400">workflow events today</span>
                    </div>
                  </div>

                  <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
                    This is the premium agency workspace: dense, fast, white-label ready, permission-aware, and built
                    around the full operating lifecycle from client intake to profitable delivery.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={isSignedIn ? dashboardHref : '/signup'}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-slate-950 transition hover:bg-cyan-100"
                    >
                      {isSignedIn ? 'Open live dashboard' : 'Create workspace'}
                      <ArrowRight size={16} />
                    </Link>
                    <a
                      href="#architecture"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/5 px-4 text-sm font-bold text-white transition hover:border-cyan-200/35 hover:bg-cyan-200/10"
                    >
                      View architecture
                      <ChevronRight size={16} />
                    </a>
                  </div>
                </div>

                <div className="grid gap-px bg-white/10 md:grid-cols-4">
                  {executiveMetrics.map((metric) => {
                    const Icon = metric.icon
                    return (
                      <div key={metric.label} className="bg-[#0b1018] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-slate-500">{metric.label}</span>
                          <Icon size={16} className="text-cyan-200" />
                        </div>
                        <div className="mt-3 flex items-end justify-between gap-3">
                          <strong className="text-2xl font-black text-white">{metric.value}</strong>
                          <span className="rounded-full bg-emerald-300/10 px-2 py-1 text-[11px] font-black text-emerald-200">
                            {metric.delta}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>

              <motion.aside
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.08 }}
                className="rounded-lg border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Active module
                    </span>
                    <h2 className="mt-2 text-2xl font-black text-white">{activeModule.title}</h2>
                  </div>
                  <span className="grid h-11 w-11 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
                    <ModuleIcon module={activeModule} />
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{activeModule.description}</p>
                <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="flex items-end justify-between gap-3">
                    <strong className="text-4xl font-black text-cyan-100">{activeModule.metric}</strong>
                    <span className="rounded-full bg-white/[0.07] px-3 py-1 text-xs font-bold text-slate-300">
                      {activeModule.status}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  {activeModule.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 rounded-md bg-white/[0.045] px-3 py-2">
                      <CheckCircle2 size={15} className="text-emerald-200" />
                      <span className="text-sm font-semibold text-slate-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </motion.aside>
            </section>

            <section id="command" className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="rounded-lg border border-white/10 bg-[#0b1018] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Delivery board</span>
                    <h2 className="mt-2 text-2xl font-black text-white">Unified project, task, deliverable, and approval flow</h2>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-300">
                    <Search size={15} />
                    Search everything
                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">K</kbd>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-4">
                  {boardColumns.map((column) => (
                    <div key={column.title} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-black text-white">{column.title}</span>
                        <span className="rounded-full bg-white/[0.07] px-2 py-1 text-xs font-black text-slate-400">{column.count}</span>
                      </div>
                      <div className="space-y-2">
                        {column.cards.map((card, index) => (
                          <div key={card} className="rounded-md border border-white/10 bg-[#111823] p-3">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-bold text-slate-200">{card}</span>
                              <span className="mt-1 h-2 w-2 rounded-full bg-cyan-200" />
                            </div>
                            <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                              <span>#{index + 1}4{index}</span>
                              <span>{index + 2} comments</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div id="clients" className="rounded-lg border border-white/10 bg-[#0b1018] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">CRM health</span>
                    <h2 className="mt-2 text-xl font-black text-white">Client command center</h2>
                  </div>
                  <Building2 className="text-cyan-200" size={20} />
                </div>
                <div className="mt-4 space-y-3">
                  {clientRows.map((client) => (
                    <div key={client.name} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <strong className="block text-sm text-white">{client.name}</strong>
                          <span className="text-xs font-semibold text-slate-500">{client.status}</span>
                        </div>
                        <span className="text-sm font-black text-cyan-100">{client.revenue}</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                        <span className="block h-full rounded-full bg-gradient-to-r from-cyan-200 to-emerald-200" style={{ width: `${client.health}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="automations" className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="rounded-lg border border-white/10 bg-[#0b1018] p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-amber-200/10 text-amber-100">
                    <Zap size={18} />
                  </span>
                  <div>
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">Automation engine</span>
                    <h2 className="text-xl font-black text-white">Trigger, condition, action</h2>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {automationBlueprint.map((rule, index) => (
                    <div key={rule.trigger} className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 sm:grid-cols-[1fr_auto_1fr_auto_1.35fr] sm:items-center">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">When</span>
                        <p className="mt-1 text-sm font-bold text-white">{rule.trigger}</p>
                      </div>
                      <ChevronRight size={15} className="hidden text-slate-600 sm:block" />
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">If</span>
                        <p className="mt-1 text-sm font-bold text-slate-300">{rule.condition}</p>
                      </div>
                      <ChevronRight size={15} className="hidden text-slate-600 sm:block" />
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Then</span>
                        <p className="mt-1 text-sm font-bold text-slate-300">{rule.action}</p>
                      </div>
                      <span className="sr-only">Automation rule {index + 1}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div id="portal" className="rounded-lg border border-white/10 bg-[#0b1018] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Client portal</span>
                    <h2 className="mt-2 text-xl font-black text-white">World-class approval workspace</h2>
                  </div>
                  <div className="flex gap-2">
                    <button className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/5 text-white" aria-label="Preview portal">
                      <Play size={16} />
                    </button>
                    <button className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/5 text-white" aria-label="Portal settings">
                      <SlidersHorizontal size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Approvals', value: '18', icon: FileCheck2 },
                    { label: 'Uploads', value: '342', icon: FileText },
                    { label: 'Requests', value: '27', icon: MessageSquareText },
                  ].map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                        <Icon size={17} className="text-cyan-200" />
                        <strong className="mt-4 block text-2xl font-black text-white">{item.value}</strong>
                        <span className="text-xs font-bold text-slate-500">{item.label}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-cyan-100">
                    <WandSparkles size={16} />
                    AI review summary
                  </div>
                  <p className="mt-2 text-sm leading-6 text-cyan-50/70">
                    Three stakeholders requested copy changes. No design blockers. Final approval likely after legal review.
                  </p>
                </div>
              </div>
            </section>

            <section id="architecture" className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="rounded-lg border border-white/10 bg-[#0b1018] p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-cyan-300/10 text-cyan-100">
                    <Layers3 size={18} />
                  </span>
                  <div>
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Architecture</span>
                    <h2 className="text-xl font-black text-white">Scalable production-ready foundation</h2>
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  {architectureLayers.map((layer) => (
                    <div key={layer} className="flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.035] p-3">
                      <Activity size={16} className="mt-0.5 shrink-0 text-cyan-200" />
                      <span className="text-sm font-semibold leading-6 text-slate-300">{layer}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-[#0b1018] p-4">
                <div className="flex items-center gap-2">
                  <LockKeyhole size={18} className="text-cyan-200" />
                  <h2 className="text-xl font-black text-white">RBAC matrix</h2>
                </div>
                <div className="mt-4 space-y-2">
                  {roleMatrix.map((role) => (
                    <div key={role.role} className="rounded-md border border-white/10 bg-white/[0.035] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-sm text-white">{role.role}</strong>
                        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{role.scope}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">{role.permissions}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="billing" className="mt-5 rounded-lg border border-white/10 bg-[#0b1018] p-4">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Billing, analytics, integrations</span>
                  <h2 className="mt-2 text-2xl font-black text-white">Everything connected from request to revenue</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    Briefs create projects. Approved deliverables create invoice drafts. Paid invoices update revenue
                    analytics. Overdue payments trigger reminders and client health changes.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-5">
                  {integrations.map((integration) => (
                    <div key={integration} className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-center text-xs font-black text-slate-300">
                      {integration}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  )
}
