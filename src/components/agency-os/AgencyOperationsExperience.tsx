'use client'

import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  BrainCircuit,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CloudUpload,
  Command,
  Database,
  FileText,
  Filter,
  FolderKanban,
  Gauge,
  GitBranch,
  GripVertical,
  HardDrive,
  Inbox,
  KanbanSquare,
  Layers3,
  LineChart,
  LockKeyhole,
  MessageSquareText,
  PanelRightOpen,
  Play,
  Plus,
  Radio,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  UsersRound,
  WandSparkles,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import {
  aiSignals,
  automationRules,
  campaigns,
  clients,
  communications,
  executiveMetrics,
  integrationTiles,
  invoices,
  mediaAssets,
  onboardingSteps,
  osModules,
  reportSeries,
  teamMembers,
  workspaces,
  type CampaignStage,
  type CampaignWork,
  type ClientRecord,
  type ModuleId,
} from '@/lib/taskit-os-blueprint'

type AgencyOperationsExperienceProps = {
  dashboardHref: string
  isSignedIn: boolean
}

type SearchResult = {
  id: string
  label: string
  meta: string
  module: ModuleId
  icon: LucideIcon
  clientId?: string
  campaignId?: string
}

const moduleIcons: Record<ModuleId, LucideIcon> = {
  command: Gauge,
  crm: Building2,
  campaigns: KanbanSquare,
  ai: BrainCircuit,
  automations: GitBranch,
  team: UsersRound,
  media: HardDrive,
  finance: CircleDollarSign,
  comms: MessageSquareText,
  analytics: BarChart3,
}

const stageOrder: CampaignStage[] = ['Intake', 'Production', 'Review', 'Approved']

const stageAccents: Record<CampaignStage, string> = {
  Intake: 'border-white/10 bg-white/[0.035] text-white',
  Production: 'border-orange-400/25 bg-orange-400/[0.08] text-orange-100',
  Review: 'border-red-400/25 bg-red-400/[0.08] text-red-100',
  Approved: 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-100',
}

const filters = ['All', 'Risk', 'Approvals', 'Finance']

const shortcuts = [
  { keys: 'Cmd K', label: 'Command' },
  { keys: 'G C', label: 'Clients' },
  { keys: 'G A', label: 'AI Ops' },
  { keys: 'N', label: 'New workflow' },
]

const liveEvents = [
  'Northstar launch copy approved',
  'Helio delay workflow queued',
  'Invoice INV-2048 reminder sent',
  'Arc media review received 9 annotations',
  'Design capacity crossed 92%',
]

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function toneClass(tone: string) {
  if (tone === 'good' || tone === 'positive') return 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-100'
  if (tone === 'risk' || tone === 'critical') return 'border-red-400/25 bg-red-400/[0.09] text-red-100'
  return 'border-orange-400/25 bg-orange-400/[0.09] text-orange-100'
}

function statusClass(status: string) {
  if (status === 'Paid' || status === 'Approved' || status === 'Live' || status === 'Complete' || status === 'Connected' || status === 'Audited') {
    return 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-100'
  }
  if (status === 'Overdue' || status === 'Needs changes' || status === 'Pending') {
    return 'border-red-400/25 bg-red-400/[0.08] text-red-100'
  }
  if (status === 'Draft' || status === 'Due' || status === 'In review') {
    return 'border-orange-400/25 bg-orange-400/[0.08] text-orange-100'
  }
  return 'border-white/10 bg-white/[0.06] text-stone-200'
}

function healthColor(value: number) {
  if (value >= 88) return '#34d399'
  if (value >= 76) return '#fb923c'
  return '#f87171'
}

function groupCampaigns(boardItems: CampaignWork[]) {
  return stageOrder.reduce<Record<CampaignStage, CampaignWork[]>>(
    (acc, stage) => {
      acc[stage] = boardItems.filter((item) => item.stage === stage)
      return acc
    },
    { Intake: [], Production: [], Review: [], Approved: [] }
  )
}

export default function AgencyOperationsExperience({
  dashboardHref,
  isSignedIn,
}: AgencyOperationsExperienceProps) {
  const [activeModule, setActiveModule] = useState<ModuleId>('command')
  const [workspace, setWorkspace] = useState(workspaces[0])
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState(filters[0])
  const [selectedClientId, setSelectedClientId] = useState(clients[0].id)
  const [selectedCampaignId, setSelectedCampaignId] = useState(campaigns[0].id)
  const [boardItems, setBoardItems] = useState(campaigns)
  const [draggedCampaignId, setDraggedCampaignId] = useState<string | null>(null)
  const [liveIndex, setLiveIndex] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? clients[0]
  const selectedCampaign = boardItems.find((campaign) => campaign.id === selectedCampaignId) ?? boardItems[0]
  const board = useMemo(() => groupCampaigns(boardItems), [boardItems])

  const searchResults = useMemo<SearchResult[]>(() => {
    const records: SearchResult[] = [
      ...osModules.map((module) => ({
        id: `module-${module.id}`,
        label: module.label,
        meta: `${module.eyebrow} / ${module.signal}`,
        module: module.id,
        icon: moduleIcons[module.id],
      })),
      ...clients.map((client) => ({
        id: client.id,
        label: client.name,
        meta: `${client.segment} / ${client.lifecycle}`,
        module: 'crm' as ModuleId,
        icon: Building2,
        clientId: client.id,
      })),
      ...boardItems.map((campaign) => ({
        id: campaign.id,
        label: campaign.name,
        meta: `${campaign.client} / ${campaign.stage} / ${campaign.risk}`,
        module: 'campaigns' as ModuleId,
        icon: FolderKanban,
        campaignId: campaign.id,
      })),
      ...automationRules.map((rule) => ({
        id: rule.id,
        label: rule.name,
        meta: `${rule.trigger} / ${rule.status}`,
        module: 'automations' as ModuleId,
        icon: GitBranch,
      })),
      ...invoices.map((invoice) => ({
        id: invoice.id,
        label: `${invoice.id} ${invoice.client}`,
        meta: `${invoice.amount} / ${invoice.status}`,
        module: 'finance' as ModuleId,
        icon: ReceiptText,
      })),
      ...mediaAssets.map((asset) => ({
        id: asset.id,
        label: asset.name,
        meta: `${asset.client} / ${asset.status}`,
        module: 'media' as ModuleId,
        icon: HardDrive,
      })),
    ]

    const query = searchQuery.trim().toLowerCase()
    if (!query) return records.slice(0, 10)

    return records
      .filter((record) => `${record.label} ${record.meta}`.toLowerCase().includes(query))
      .slice(0, 12)
  }, [boardItems, searchQuery])

  const runSearchResult = useCallback((result: SearchResult) => {
    setActiveModule(result.module)
    if (result.clientId) setSelectedClientId(result.clientId)
    if (result.campaignId) setSelectedCampaignId(result.campaignId)
    setCommandOpen(false)
    setSearchQuery('')
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLiveIndex((current) => (current + 1) % liveEvents.length)
    }, 3200)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen((open) => !open)
        return
      }

      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key.toLowerCase() === 'n') setActiveModule('automations')
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const selectWorkspace = (workspaceId: string) => {
    const nextWorkspace = workspaces.find((item) => item.id === workspaceId)
    if (!nextWorkspace) return

    setWorkspace(nextWorkspace)
    setWorkspaceOpen(false)
    setSyncing(true)
    window.setTimeout(() => setSyncing(false), 720)
  }

  const moveCampaign = (stage: CampaignStage) => {
    if (!draggedCampaignId) return

    setBoardItems((items) =>
      items.map((item) =>
        item.id === draggedCampaignId
          ? {
              ...item,
              stage,
            }
          : item
      )
    )
    setSelectedCampaignId(draggedCampaignId)
    setDraggedCampaignId(null)
  }

  const activeModuleMeta = osModules.find((module) => module.id === activeModule) ?? osModules[0]
  const ActiveIcon = moduleIcons[activeModule]

  return (
    <div id="main-content" className="min-h-screen overflow-hidden bg-[#050505] text-stone-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#050505_0%,#101010_52%,#050505_100%)]" />
        <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:72px_72px]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(248,113,113,.18),transparent)]" />
      </div>

      <AnimatePresence>
        {commandOpen && (
          <CommandPalette
            query={searchQuery}
            results={searchResults}
            onClose={() => setCommandOpen(false)}
            onQueryChange={setSearchQuery}
            onSelect={runSearchResult}
          />
        )}
      </AnimatePresence>

      <div className="relative grid min-h-screen lg:grid-cols-[272px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 bg-black/45 backdrop-blur-2xl lg:flex lg:flex-col">
          <div className="border-b border-white/10 p-4">
            <Link href="/" className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-white/[0.06]">
              <span className="grid h-11 w-11 place-items-center rounded-lg border border-red-300/25 bg-red-300/[0.08] text-red-100 shadow-[0_0_36px_rgba(248,113,113,.14)]">
                <Command size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-black text-white">TASKIT OS</span>
                <span className="block truncate text-xs font-semibold text-stone-500">Agency operating system</span>
              </span>
            </Link>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <button
              type="button"
              className="mb-3 flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left text-sm font-semibold text-stone-300 transition hover:border-orange-300/30 hover:bg-orange-300/[0.07]"
              onClick={() => setCommandOpen(true)}
            >
              <Search size={16} className="text-stone-500" />
              Search operations
              <span className="ml-auto rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[11px] text-stone-500">
                Cmd K
              </span>
            </button>

            <nav className="space-y-1">
              {osModules.map((module) => {
                const Icon = moduleIcons[module.id]
                const active = module.id === activeModule

                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => setActiveModule(module.id)}
                    className={cx(
                      'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition',
                      active
                        ? 'border-red-300/25 bg-red-300/[0.1] text-white shadow-[inset_2px_0_0_rgba(248,113,113,.85)]'
                        : 'border-transparent text-stone-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-white'
                    )}
                  >
                    <span className={cx('grid h-8 w-8 place-items-center rounded-md', active ? 'bg-red-300/[0.14] text-red-100' : 'bg-white/[0.06] text-stone-400')}>
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{module.label}</span>
                      <span className="block truncate text-[11px] font-medium text-stone-500">{module.eyebrow}</span>
                    </span>
                    <span className="ml-auto text-xs font-black text-stone-500">{module.metric}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="border-t border-white/10 p-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-stone-500">Readiness</span>
                <span className="text-xs font-black text-orange-100">86%</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full w-[86%] rounded-full bg-[linear-gradient(90deg,#f87171,#fb923c,#fcd34d)]" />
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080808]/85 backdrop-blur-2xl">
            <div className="flex min-h-16 items-center gap-3 px-3 sm:px-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-red-300/20 bg-red-300/[0.08] text-red-100 lg:hidden">
                  <Command size={18} />
                </span>
                <div className="hidden min-w-0 sm:block">
                  <div className="flex items-center gap-2 text-xs font-bold text-stone-500">
                    <ActiveIcon size={14} className="text-orange-200" />
                    {activeModuleMeta.eyebrow}
                  </div>
                  <h1 className="truncate text-lg font-black text-white">{activeModuleMeta.label}</h1>
                </div>
              </div>

              <div className="relative ml-auto hidden min-w-[18rem] max-w-[34rem] flex-1 md:block">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                    setCommandOpen(true)
                  }}
                  onFocus={() => setCommandOpen(true)}
                  className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.045] pl-9 pr-24 text-sm font-semibold text-white outline-none transition placeholder:text-stone-600 hover:border-white/15 focus:border-orange-300/35 focus:bg-white/[0.07]"
                  placeholder="Search clients, campaigns, invoices, files..."
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] font-bold text-stone-500">
                  Cmd K
                </span>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setWorkspaceOpen((open) => !open)}
                  className="hidden min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-stone-200 transition hover:border-orange-300/30 hover:bg-orange-300/[0.07] sm:flex"
                >
                  <Database size={15} className="text-orange-200" />
                  <span className="max-w-[12rem] truncate">{workspace.name}</span>
                  <ChevronDown size={15} className="text-stone-500" />
                </button>
                {workspaceOpen && (
                  <div className="absolute right-0 top-12 w-72 rounded-lg border border-white/10 bg-[#111]/95 p-2 shadow-2xl shadow-black/60 backdrop-blur-xl">
                    {workspaces.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectWorkspace(item.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
                      >
                        <span>
                          <span className="block text-sm font-bold text-white">{item.name}</span>
                          <span className="block text-xs font-semibold text-stone-500">{item.tier}</span>
                        </span>
                        <span className="text-xs font-bold text-orange-100">{item.pulse}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.045] text-stone-300 transition hover:border-white/20 hover:text-white"
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell size={17} />
              </button>

              <Link
                href={isSignedIn ? dashboardHref : '/signup'}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-white px-3 text-sm font-black text-black transition hover:bg-orange-100 sm:px-4"
              >
                {isSignedIn ? 'Open workspace' : 'Launch'}
                <ArrowRight size={15} />
              </Link>
            </div>

            <div className="flex gap-2 overflow-x-auto border-t border-white/10 px-3 py-2 lg:hidden">
              {osModules.map((module) => {
                const Icon = moduleIcons[module.id]
                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => setActiveModule(module.id)}
                    className={cx(
                      'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold',
                      activeModule === module.id
                        ? 'border-red-300/25 bg-red-300/[0.1] text-white'
                        : 'border-white/10 bg-white/[0.035] text-stone-400'
                    )}
                  >
                    <Icon size={14} />
                    {module.label}
                  </button>
                )
              })}
            </div>
          </header>

          <main className="grid gap-4 p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-4">
              <StatusRibbon syncing={syncing} liveEvent={liveEvents[liveIndex]} />
              <ModuleSurface
                activeModule={activeModule}
                activeFilter={activeFilter}
                board={board}
                draggedCampaignId={draggedCampaignId}
                selectedCampaign={selectedCampaign}
                selectedClient={selectedClient}
                setActiveFilter={setActiveFilter}
                setActiveModule={setActiveModule}
                setDraggedCampaignId={setDraggedCampaignId}
                setSelectedCampaignId={setSelectedCampaignId}
                setSelectedClientId={setSelectedClientId}
                moveCampaign={moveCampaign}
              />
            </div>

            <ContextPanel
              activeModule={activeModule}
              selectedCampaign={selectedCampaign}
              selectedClient={selectedClient}
              setActiveModule={setActiveModule}
            />
          </main>
        </div>
      </div>
    </div>
  )
}

function CommandPalette({
  query,
  results,
  onClose,
  onQueryChange,
  onSelect,
}: {
  query: string
  results: SearchResult[]
  onClose: () => void
  onQueryChange: (query: string) => void
  onSelect: (result: SearchResult) => void
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-3 pt-20 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={onClose}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-3xl overflow-hidden rounded-lg border border-white/10 bg-[#101010] shadow-[0_40px_120px_rgba(0,0,0,.65)]"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex min-h-14 items-center gap-3 border-b border-white/10 px-4">
          <Search size={18} className="text-orange-200" />
          <input
            autoFocus
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-stone-600"
            placeholder="Jump to any client, campaign, invoice, rule, report, or file"
          />
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md border border-white/10 text-stone-400 hover:text-white" aria-label="Close command palette">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length ? (
            results.map((result) => {
              const Icon = result.icon
              return (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => onSelect(result)}
                  className="grid w-full grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-transparent p-2.5 text-left transition hover:border-orange-300/25 hover:bg-orange-300/[0.07]"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-white/[0.06] text-orange-100">
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-white">{result.label}</span>
                    <span className="block truncate text-xs font-semibold text-stone-500">{result.meta}</span>
                  </span>
                  <ArrowRight size={15} className="text-stone-600" />
                </button>
              )
            })
          ) : (
            <div className="grid place-items-center px-4 py-12 text-sm font-semibold text-stone-500">
              <Inbox className="mb-3 text-stone-600" size={24} />
              No matching operation
            </div>
          )}
        </div>
        <footer className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-3 text-xs font-semibold text-stone-500">
          {shortcuts.map((shortcut) => (
            <span key={shortcut.label} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1">
              {shortcut.keys} / {shortcut.label}
            </span>
          ))}
        </footer>
      </motion.section>
    </motion.div>
  )
}

function StatusRibbon({ syncing, liveEvent }: { syncing: boolean; liveEvent: string }) {
  return (
    <section className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 shadow-2xl shadow-black/20 backdrop-blur-xl md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-100">
          <Radio size={17} />
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,.8)]" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-white">Live operating pulse</div>
          <div className="truncate text-sm font-semibold text-stone-400">{liveEvent}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-stone-400">
        {syncing ? (
          <>
            <SkeletonCell />
            <SkeletonCell />
            <SkeletonCell />
          </>
        ) : (
          <>
            <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">Realtime on</span>
            <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">AI scoped</span>
            <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">Audit ready</span>
          </>
        )}
      </div>
    </section>
  )
}

function SkeletonCell() {
  return <span className="h-9 rounded-lg border border-white/10 bg-white/[0.06] [animation:pulse_1.2s_ease-in-out_infinite]" />
}

function ModuleSurface({
  activeModule,
  activeFilter,
  board,
  draggedCampaignId,
  selectedCampaign,
  selectedClient,
  setActiveFilter,
  setActiveModule,
  setDraggedCampaignId,
  setSelectedCampaignId,
  setSelectedClientId,
  moveCampaign,
}: {
  activeModule: ModuleId
  activeFilter: string
  board: Record<CampaignStage, CampaignWork[]>
  draggedCampaignId: string | null
  selectedCampaign: CampaignWork
  selectedClient: ClientRecord
  setActiveFilter: (filter: string) => void
  setActiveModule: (module: ModuleId) => void
  setDraggedCampaignId: (id: string | null) => void
  setSelectedCampaignId: (id: string) => void
  setSelectedClientId: (id: string) => void
  moveCampaign: (stage: CampaignStage) => void
}) {
  if (activeModule === 'crm') {
    return <ClientCrm selectedClient={selectedClient} setSelectedClientId={setSelectedClientId} setActiveModule={setActiveModule} />
  }

  if (activeModule === 'campaigns') {
    return (
      <CampaignOperatingSystem
        board={board}
        draggedCampaignId={draggedCampaignId}
        selectedCampaign={selectedCampaign}
        setDraggedCampaignId={setDraggedCampaignId}
        setSelectedCampaignId={setSelectedCampaignId}
        moveCampaign={moveCampaign}
      />
    )
  }

  if (activeModule === 'ai') return <AiOperationsLayer />
  if (activeModule === 'automations') return <AutomationEngine />
  if (activeModule === 'team') return <TeamManagement />
  if (activeModule === 'media') return <MediaSystem />
  if (activeModule === 'finance') return <FinanceSystem />
  if (activeModule === 'comms') return <CommunicationSystem />
  if (activeModule === 'analytics') return <AnalyticsReporting />

  return (
    <ExecutiveCommandCenter
      activeFilter={activeFilter}
      board={board}
      setActiveFilter={setActiveFilter}
      setActiveModule={setActiveModule}
      setSelectedCampaignId={setSelectedCampaignId}
      setSelectedClientId={setSelectedClientId}
    />
  )
}

function ExecutiveCommandCenter({
  activeFilter,
  board,
  setActiveFilter,
  setActiveModule,
  setSelectedCampaignId,
  setSelectedClientId,
}: {
  activeFilter: string
  board: Record<CampaignStage, CampaignWork[]>
  setActiveFilter: (filter: string) => void
  setActiveModule: (module: ModuleId) => void
  setSelectedCampaignId: (id: string) => void
  setSelectedClientId: (id: string) => void
}) {
  const riskyCampaigns = Object.values(board)
    .flat()
    .filter((campaign) => campaign.health < 85 || campaign.approvals > 4)

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0d0d0d] shadow-2xl shadow-black/30">
        <div className="grid gap-px bg-white/10 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
          <div className="bg-[#0d0d0d] p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-md border border-red-300/20 bg-red-300/[0.08] px-2.5 py-1 text-xs font-black text-red-100">
                <Sparkles size={14} />
                TASKIT OS
              </span>
              <span className="rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-stone-400">
                Mission control for modern agencies
              </span>
            </div>
            <h2 className="mt-5 max-w-4xl text-4xl font-black leading-tight text-white sm:text-5xl">
              An AI-powered operating system for clients, campaigns, teams, files, approvals, finance, and growth.
            </h2>
            <div className="mt-5 grid gap-2 sm:grid-cols-4">
              {['CRM', 'Campaign OS', 'AI Ops', 'Revenue Ops'].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setActiveModule(item === 'CRM' ? 'crm' : item === 'Campaign OS' ? 'campaigns' : item === 'AI Ops' ? 'ai' : 'finance')}
                  className="rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-left text-sm font-bold text-stone-200 transition hover:border-orange-300/30 hover:bg-orange-300/[0.07]"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-[#0d0d0d] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-stone-500">AI daily brief</div>
                <div className="mt-1 text-xl font-black text-white">3 executive actions</div>
              </div>
              <BrainCircuit className="text-orange-200" size={24} />
            </div>
            <div className="mt-4 space-y-2">
              {aiSignals.slice(0, 3).map((signal) => (
                <button
                  key={signal.id}
                  type="button"
                  onClick={() => setActiveModule('ai')}
                  className={cx('w-full rounded-lg border p-3 text-left transition hover:bg-white/[0.08]', toneClass(signal.severity))}
                >
                  <div className="text-sm font-black">{signal.title}</div>
                  <div className="mt-1 text-xs font-semibold opacity-80">{signal.action}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {executiveMetrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-stone-500">{metric.label}</span>
              <span className={cx('rounded-md border px-1.5 py-0.5 text-[11px] font-black', toneClass(metric.tone))}>{metric.delta}</span>
            </div>
            <div className="mt-3 text-2xl font-black text-white">{metric.value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <Toolbar title="Operational risk map" icon={AlertTriangle} activeFilter={activeFilter} setActiveFilter={setActiveFilter} />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {riskyCampaigns.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                onClick={() => {
                  setActiveModule('campaigns')
                  setSelectedCampaignId(campaign.id)
                }}
                className="rounded-lg border border-white/10 bg-black/25 p-3 text-left transition hover:border-red-300/30 hover:bg-red-300/[0.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-white">{campaign.name}</div>
                    <div className="mt-1 truncate text-xs font-semibold text-stone-500">{campaign.client}</div>
                  </div>
                  <span className="text-lg font-black" style={{ color: healthColor(campaign.health) }}>
                    {campaign.health}
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full" style={{ width: `${campaign.health}%`, background: healthColor(campaign.health) }} />
                </div>
                <div className="mt-3 text-xs font-semibold text-stone-400">{campaign.risk}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-stone-500">Client health</div>
              <h3 className="mt-1 text-lg font-black text-white">Relationship radar</h3>
            </div>
            <Building2 size={19} className="text-orange-200" />
          </div>
          <div className="mt-4 space-y-2">
            {clients.slice(0, 4).map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => {
                  setActiveModule('crm')
                  setSelectedClientId(client.id)
                }}
                className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-3 text-left transition hover:border-orange-300/30"
              >
                <span className="grid h-9 w-9 place-items-center rounded-md bg-white/[0.06] text-sm font-black text-white">
                  {client.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-white">{client.name}</span>
                  <span className="block truncate text-xs font-semibold text-stone-500">{client.lifecycle}</span>
                </span>
                <span className="text-sm font-black" style={{ color: healthColor(client.health) }}>{client.health}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <OperationalWidget title="Automation status" icon={GitBranch} value="41 live rules" detail="No failed production runs in the last 24 hours" />
        <OperationalWidget title="Upcoming deadlines" icon={CalendarClock} value="12 due this week" detail="5 blocked by client approval, 2 by media dependencies" />
        <OperationalWidget title="Workload balance" icon={UsersRound} value="2 overloaded teams" detail="Design and production need redistribution before Friday" />
      </section>
    </div>
  )
}

function Toolbar({
  title,
  icon: Icon,
  activeFilter,
  setActiveFilter,
}: {
  title: string
  icon: LucideIcon
  activeFilter: string
  setActiveFilter: (filter: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg border border-orange-300/20 bg-orange-300/[0.08] text-orange-100">
          <Icon size={18} />
        </span>
        <div>
          <h3 className="text-lg font-black text-white">{title}</h3>
          <p className="text-sm font-semibold text-stone-500">Filtered by operational urgency and business value</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={cx(
              'rounded-md border px-3 py-1.5 text-xs font-black transition',
              activeFilter === filter
                ? 'border-orange-300/30 bg-orange-300/[0.1] text-orange-100'
                : 'border-white/10 bg-white/[0.035] text-stone-500 hover:text-white'
            )}
          >
            {filter}
          </button>
        ))}
      </div>
    </div>
  )
}

function OperationalWidget({ title, icon: Icon, value, detail }: { title: string; icon: LucideIcon; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-black text-white">{title}</span>
        <Icon size={18} className="text-orange-200" />
      </div>
      <div className="mt-5 text-2xl font-black text-white">{value}</div>
      <p className="mt-2 text-sm font-semibold leading-6 text-stone-500">{detail}</p>
    </div>
  )
}

function ClientCrm({
  selectedClient,
  setSelectedClientId,
  setActiveModule,
}: {
  selectedClient: ClientRecord
  setSelectedClientId: (id: string) => void
  setActiveModule: (module: ModuleId) => void
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-stone-500">
              <Building2 size={14} className="text-orange-200" />
              Client CRM system
            </div>
            <h2 className="mt-1 text-3xl font-black text-white">Accounts, contracts, invoices, onboarding, and relationship intelligence.</h2>
          </div>
          <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-black text-black">
            <Plus size={15} />
            Add client
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
          <div className="space-y-2">
            {clients.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => setSelectedClientId(client.id)}
                className={cx(
                  'grid w-full gap-3 rounded-lg border p-3 text-left transition md:grid-cols-[minmax(0,1fr)_110px_110px_92px]',
                  selectedClient.id === client.id ? 'border-orange-300/35 bg-orange-300/[0.08]' : 'border-white/10 bg-black/20 hover:border-white/20'
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-white">{client.name}</span>
                  <span className="mt-1 block truncate text-xs font-semibold text-stone-500">{client.segment} / {client.owner}</span>
                </span>
                <span className="text-sm font-bold text-stone-300">{client.lifecycle}</span>
                <span className="text-sm font-bold text-stone-300">{client.revenue}</span>
                <span className="text-right text-sm font-black" style={{ color: healthColor(client.health) }}>{client.health}</span>
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-stone-500">Client profile</div>
                <h3 className="mt-1 text-2xl font-black text-white">{selectedClient.name}</h3>
                <p className="mt-1 text-sm font-semibold text-stone-500">{selectedClient.segment}</p>
              </div>
              <span className="text-4xl font-black" style={{ color: healthColor(selectedClient.health) }}>{selectedClient.health}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ['Owner', selectedClient.owner],
                ['Last touch', selectedClient.lastTouch],
                ['Engagement', selectedClient.engagementDelta],
                ['Open invoices', selectedClient.openInvoices],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                  <div className="text-xs font-bold text-stone-500">{label}</div>
                  <div className="mt-1 text-sm font-black text-white">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {['Contract renewed automatically', 'Kickoff workflow completed', 'Monthly report delivered', 'Portal access active'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm font-semibold text-stone-300">
                  <CheckCircle2 size={15} className="text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setActiveModule('campaigns')} className="rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-stone-200 hover:border-orange-300/30">
                Campaign history
              </button>
              <button type="button" onClick={() => setActiveModule('finance')} className="rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-stone-200 hover:border-orange-300/30">
                Billing profile
              </button>
              <button type="button" onClick={() => setActiveModule('comms')} className="rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-stone-200 hover:border-orange-300/30">
                Timeline
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function CampaignOperatingSystem({
  board,
  draggedCampaignId,
  selectedCampaign,
  setDraggedCampaignId,
  setSelectedCampaignId,
  moveCampaign,
}: {
  board: Record<CampaignStage, CampaignWork[]>
  draggedCampaignId: string | null
  selectedCampaign: CampaignWork
  setDraggedCampaignId: (id: string | null) => void
  setSelectedCampaignId: (id: string) => void
  moveCampaign: (stage: CampaignStage) => void
}) {
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-stone-500">
              <KanbanSquare size={14} className="text-orange-200" />
              Campaign operating system
            </div>
            <h2 className="mt-1 text-3xl font-black text-white">Lifecycle, dependencies, deliverables, approvals, scheduling, and campaign scoring.</h2>
          </div>
          <div className="flex gap-2">
            <button type="button" className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-stone-300 hover:text-white" aria-label="Timeline view" title="Timeline view">
              <CalendarClock size={17} />
            </button>
            <button type="button" className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-stone-300 hover:text-white" aria-label="Filters" title="Filters">
              <Filter size={17} />
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        {stageOrder.map((stage) => (
          <div
            key={stage}
            onDragOver={onDragOver}
            onDrop={() => moveCampaign(stage)}
            className={cx(
              'min-h-[28rem] rounded-lg border p-3 transition',
              draggedCampaignId ? 'border-orange-300/35 bg-orange-300/[0.05]' : 'border-white/10 bg-white/[0.035]'
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className={cx('rounded-md border px-2 py-1 text-xs font-black', stageAccents[stage])}>{stage}</span>
              <span className="text-xs font-black text-stone-500">{board[stage].length}</span>
            </div>
            <div className="space-y-2">
              {board[stage].map((campaign) => (
                <button
                  key={campaign.id}
                  type="button"
                  draggable
                  onDragStart={() => setDraggedCampaignId(campaign.id)}
                  onDragEnd={() => setDraggedCampaignId(null)}
                  onClick={() => setSelectedCampaignId(campaign.id)}
                  className={cx(
                    'w-full rounded-lg border p-3 text-left transition hover:border-orange-300/30 hover:bg-white/[0.06]',
                    selectedCampaign.id === campaign.id ? 'border-orange-300/35 bg-orange-300/[0.08]' : 'border-white/10 bg-black/25'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical size={15} className="mt-0.5 shrink-0 text-stone-600" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black text-white">{campaign.name}</div>
                      <div className="mt-1 truncate text-xs font-semibold text-stone-500">{campaign.client}</div>
                    </div>
                    <span className="text-sm font-black" style={{ color: healthColor(campaign.health) }}>{campaign.health}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-bold text-stone-500">
                    <span>{campaign.due}</span>
                    <span>{campaign.deliverables} files</span>
                    <span>{campaign.approvals} approvals</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-white">Dependencies and milestones</h3>
            <span className="rounded-md border border-white/10 px-2 py-1 text-xs font-bold text-stone-500">Critical path</span>
          </div>
          <div className="mt-4 grid gap-2">
            {['Brief approved', 'Production assets received', 'Internal QA', 'Client approval', 'Invoice generated'].map((step, index) => (
              <div key={step} className="grid grid-cols-[32px_minmax(0,1fr)_90px] items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
                <span className={cx('grid h-8 w-8 place-items-center rounded-md', index < 2 ? 'bg-emerald-400/[0.12] text-emerald-200' : index === 2 ? 'bg-orange-400/[0.12] text-orange-200' : 'bg-white/[0.06] text-stone-500')}>
                  {index < 2 ? <Check size={15} /> : <Clock3 size={15} />}
                </span>
                <span className="text-sm font-bold text-white">{step}</span>
                <span className="text-right text-xs font-bold text-stone-500">May {12 + index}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <h3 className="text-lg font-black text-white">AI campaign score</h3>
          <div className="mt-4 grid place-items-center rounded-lg border border-white/10 bg-black/20 p-6">
            <div className="text-6xl font-black" style={{ color: healthColor(selectedCampaign.health) }}>{selectedCampaign.health}</div>
            <div className="mt-2 text-sm font-semibold text-stone-500">{selectedCampaign.risk}</div>
          </div>
        </div>
      </section>
    </div>
  )
}

function AiOperationsLayer() {
  return (
    <div className="space-y-4">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg border border-red-300/20 bg-red-300/[0.08] text-red-100">
              <BrainCircuit size={20} />
            </span>
            <div>
              <div className="text-xs font-bold text-stone-500">AI operations layer</div>
              <h2 className="text-3xl font-black text-white">Business intelligence copilot with scoped recommendations.</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {aiSignals.map((signal) => (
              <div key={signal.id} className={cx('rounded-lg border p-4', toneClass(signal.severity))}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black">{signal.title}</h3>
                    <p className="mt-2 text-sm font-semibold leading-6 opacity-80">{signal.detail}</p>
                  </div>
                  <Sparkles size={18} className="shrink-0" />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs font-black opacity-70">{signal.entity}</span>
                  <button type="button" className="rounded-md border border-white/20 px-2 py-1 text-xs font-black">
                    {signal.action}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-white">Assistant console</h3>
            <Bot size={20} className="text-orange-200" />
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-white/10 bg-black/25 p-3">
              <div className="text-sm font-black text-white">TASKIT Brain</div>
              <p className="mt-2 text-sm font-semibold leading-6 text-stone-400">
                I found 4 risks, 2 workload imbalances, and 1 finance trend that needs management attention today.
              </p>
            </div>
            {['Analyze delayed projects', 'Generate client health report', 'Forecast next week capacity', 'Draft recovery workflow'].map((prompt) => (
              <button key={prompt} type="button" className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-left text-sm font-bold text-stone-300 hover:border-orange-300/30">
                <WandSparkles size={15} className="text-orange-200" />
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function AutomationEngine() {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-stone-500">
              <GitBranch size={14} className="text-orange-200" />
              Automation engine
            </div>
            <h2 className="mt-1 text-3xl font-black text-white">Trigger, condition, action workflows for agency operations.</h2>
          </div>
          <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-black text-black">
            <Plus size={15} />
            New rule
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {automationRules.map((rule) => (
            <div key={rule.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-white">{rule.name}</h3>
                  <div className="mt-1 text-xs font-bold text-stone-500">{rule.runs} runs / {rule.successRate} success</div>
                </div>
                <span className={cx('rounded-md border px-2 py-1 text-xs font-black', statusClass(rule.status))}>{rule.status}</span>
              </div>
              <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_1fr_1.2fr]">
                <RuleStep label="When" value={rule.trigger} icon={Zap} />
                <RuleStep label="If" value={rule.condition} icon={Filter} />
                <RuleStep label="Then" value={rule.action} icon={Play} />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <h3 className="text-lg font-black text-white">Run health</h3>
          <div className="mt-4 rounded-lg border border-dashed border-emerald-400/25 bg-emerald-400/[0.06] p-6 text-center">
            <CheckCircle2 className="mx-auto text-emerald-200" size={26} />
            <div className="mt-3 text-sm font-black text-emerald-100">No failed runs</div>
            <p className="mt-2 text-sm font-semibold leading-6 text-emerald-100/70">All live automations completed successfully in the last 24 hours.</p>
          </div>
          <div className="mt-4 space-y-2">
            {['Scheduled reports at 08:00', 'Invoice reminders at 09:30', 'Approval chase every 4 hours'].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-stone-300">
                <TimerReset size={15} className="text-orange-200" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function RuleStep({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2 text-xs font-black text-stone-500">
        <Icon size={13} className="text-orange-200" />
        {label}
      </div>
      <div className="mt-2 text-sm font-bold leading-6 text-stone-200">{value}</div>
    </div>
  )
}

function TeamManagement() {
  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-3">
            <UsersRound size={21} className="text-orange-200" />
            <h2 className="text-3xl font-black text-white">Departments, workload, permissions, attendance, and capacity balancing.</h2>
          </div>
          <div className="mt-5 space-y-2">
            {teamMembers.map((member) => (
              <div key={member.id} className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-3 md:grid-cols-[minmax(0,1fr)_160px_100px] md:items-center">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">{member.name}</div>
                  <div className="mt-1 truncate text-xs font-semibold text-stone-500">{member.role} / {member.department}</div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-stone-500">
                    <span>{member.focus}</span>
                    <span>{member.utilization}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full rounded-full" style={{ width: `${member.utilization}%`, background: healthColor(100 - Math.max(0, member.utilization - 70)) }} />
                  </div>
                </div>
                <span className={cx('rounded-md border px-2 py-1 text-center text-xs font-black', member.mood === 'loaded' ? toneClass('risk') : member.mood === 'open' ? toneClass('good') : toneClass('watch'))}>
                  {member.tasks} tasks
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <h3 className="text-lg font-black text-white">Permission model</h3>
          <div className="mt-4 space-y-2">
            {['Owner: billing and security', 'Admin: workspace operations', 'Manager: assigned portfolios', 'Team: assigned delivery', 'Client: portal only'].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-stone-300">
                <LockKeyhole size={15} className="text-orange-200" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function MediaSystem() {
  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <h2 className="text-xl font-black text-white">File and media system</h2>
          <div className="mt-4 space-y-2">
            {['Client approvals', 'Campaign masters', 'Raw footage', 'Brand systems', 'Contracts'].map((folder) => (
              <button key={folder} type="button" className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left text-sm font-bold text-stone-300 hover:border-orange-300/30">
                <FolderKanban size={15} className="text-orange-200" />
                {folder}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-dashed border-orange-300/25 bg-orange-300/[0.06] p-4 text-center">
            <CloudUpload className="mx-auto text-orange-200" size={24} />
            <div className="mt-2 text-sm font-black text-white">Drop media for review</div>
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div className="grid gap-3 lg:grid-cols-3">
            {mediaAssets.map((asset) => (
              <div key={asset.id} className="overflow-hidden rounded-lg border border-white/10 bg-black/25">
                <div className="flex aspect-video items-end bg-[linear-gradient(135deg,rgba(248,113,113,.22),rgba(251,146,60,.12)_45%,rgba(255,255,255,.04))] p-3">
                  <span className="rounded-md border border-white/15 bg-black/40 px-2 py-1 text-xs font-black text-white">{asset.type}</span>
                </div>
                <div className="p-3">
                  <div className="truncate text-sm font-black text-white">{asset.name}</div>
                  <div className="mt-1 text-xs font-semibold text-stone-500">{asset.client} / {asset.version} / {asset.size}</div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className={cx('rounded-md border px-2 py-1 text-xs font-black', statusClass(asset.status))}>{asset.status}</span>
                    <span className="text-xs font-bold text-stone-500">{asset.comments} comments</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function FinanceSystem() {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-stone-500">
              <CircleDollarSign size={14} className="text-orange-200" />
              Finance system
            </div>
            <h2 className="mt-1 text-3xl font-black text-white">Invoices, subscriptions, recurring billing, Stripe, expenses, and revenue tracking.</h2>
          </div>
          <span className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-2 text-sm font-black text-emerald-100">Stripe connected</span>
        </div>
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div className="space-y-2">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-3 md:grid-cols-[110px_minmax(0,1fr)_110px_100px] md:items-center">
                <span className="text-sm font-black text-white">{invoice.id}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-white">{invoice.client}</span>
                  <span className="block truncate text-xs font-semibold text-stone-500">{invoice.linkedCampaign}</span>
                </span>
                <span className="text-sm font-black text-white">{invoice.amount}</span>
                <span className={cx('rounded-md border px-2 py-1 text-center text-xs font-black', statusClass(invoice.status))}>{invoice.status}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <h3 className="text-lg font-black text-white">Financial snapshot</h3>
          <div className="mt-4 grid gap-2">
            {[
              ['MRR', '$284k'],
              ['Revenue in flight', '$1.42M'],
              ['Expenses', '$386k'],
              ['Collection risk', '$42k'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <span className="text-sm font-semibold text-stone-500">{label}</span>
                <span className="text-sm font-black text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function CommunicationSystem() {
  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-3">
            <MessageSquareText size={21} className="text-orange-200" />
            <h2 className="text-3xl font-black text-white">Realtime chat, mentions, activity feed, notifications, announcements, and comments.</h2>
          </div>
          <div className="mt-5 space-y-2">
            {communications.map((item) => (
              <div key={item.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-black text-white">{item.author}</div>
                  <div className="text-xs font-bold text-stone-500">{item.channel} / {item.time}</div>
                </div>
                <p className="mt-2 text-sm font-semibold leading-6 text-stone-300">{item.message}</p>
                <div className="mt-2 text-xs font-bold text-orange-100">{item.entity}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <h3 className="text-lg font-black text-white">Notification center</h3>
          <div className="mt-4 space-y-2">
            {['9 mentions', '23 approval comments', '4 finance reminders', '2 team announcements'].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-stone-300">
                <Bell size={15} className="text-orange-200" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function AnalyticsReporting() {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-stone-500">
              <LineChart size={14} className="text-orange-200" />
              Analytics and reporting
            </div>
            <h2 className="mt-1 text-3xl font-black text-white">Forecasting, executive reporting, productivity analytics, finance trends, and AI summaries.</h2>
          </div>
          <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-black text-black">
            <FileText size={15} />
            Generate report
          </button>
        </div>
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <h3 className="text-lg font-black text-white">Executive forecast</h3>
          <div className="mt-5 flex h-72 items-end gap-3 border-b border-l border-white/10 px-3 pb-3">
            {reportSeries.map((item) => (
              <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-56 w-full items-end justify-center gap-1">
                  <span className="w-1/3 rounded-t bg-red-300/70" style={{ height: `${item.revenue}%` }} />
                  <span className="w-1/3 rounded-t bg-orange-300/70" style={{ height: `${item.productivity}%` }} />
                  <span className="w-1/3 rounded-t bg-emerald-300/70" style={{ height: `${item.satisfaction}%` }} />
                </div>
                <span className="text-xs font-bold text-stone-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <h3 className="text-lg font-black text-white">AI-generated summary</h3>
          <p className="mt-4 text-sm font-semibold leading-6 text-stone-400">
            Revenue momentum is strongest in retained accounts. Approval latency and design utilization are the two constraints most likely to reduce next week velocity.
          </p>
          <div className="mt-4 space-y-2">
            {['Revenue forecast: +18%', 'Productivity forecast: +9%', 'Client satisfaction: 91%', 'Delay exposure: $118k'].map((item) => (
              <div key={item} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm font-bold text-stone-300">{item}</div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function ContextPanel({
  activeModule,
  selectedCampaign,
  selectedClient,
  setActiveModule,
}: {
  activeModule: ModuleId
  selectedCampaign: CampaignWork
  selectedClient: ClientRecord
  setActiveModule: (module: ModuleId) => void
}) {
  return (
    <aside className="space-y-4">
      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-stone-500">Context panel</div>
            <h2 className="mt-1 text-xl font-black text-white">{activeModule === 'crm' ? selectedClient.name : selectedCampaign.name}</h2>
          </div>
          <PanelRightOpen size={20} className="text-orange-200" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {activeModule === 'crm'
            ? [
                ['Health', selectedClient.health],
                ['Campaigns', selectedClient.activeCampaigns],
                ['Invoices', selectedClient.openInvoices],
                ['Engagement', selectedClient.engagementDelta],
              ].map(([label, value]) => <ContextStat key={label} label={String(label)} value={String(value)} />)
            : [
                ['Health', selectedCampaign.health],
                ['Budget', selectedCampaign.budget],
                ['Approvals', selectedCampaign.approvals],
                ['Deliverables', selectedCampaign.deliverables],
              ].map(([label, value]) => <ContextStat key={label} label={String(label)} value={String(value)} />)}
        </div>
        <div className="mt-4 rounded-lg border border-red-300/20 bg-red-300/[0.07] p-3">
          <div className="flex items-center gap-2 text-sm font-black text-red-100">
            <AlertTriangle size={16} />
            Risk readout
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-red-100/75">
            {activeModule === 'crm'
              ? `${selectedClient.lifecycle} with ${selectedClient.engagementDelta} engagement movement.`
              : `${selectedCampaign.risk}. Due ${selectedCampaign.due} with ${selectedCampaign.approvals} open approvals.`}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setActiveModule('ai')} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-stone-200 hover:border-orange-300/30">
            Ask AI
          </button>
          <button type="button" onClick={() => setActiveModule('automations')} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-stone-200 hover:border-orange-300/30">
            Automate
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-white">Onboarding</h3>
          <RefreshCcw size={17} className="text-stone-500" />
        </div>
        <div className="mt-4 space-y-2">
          {onboardingSteps.map((step) => (
            <div key={step.label} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <span className="text-sm font-semibold text-stone-300">{step.label}</span>
              <span className={cx('rounded-md border px-2 py-1 text-[11px] font-black', statusClass(step.status))}>{step.status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <h3 className="text-lg font-black text-white">Integrations</h3>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {integrationTiles.map((tile) => (
            <div key={tile} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center text-xs font-black text-stone-300">
              {tile}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-white">Security</h3>
          <ShieldCheck size={18} className="text-emerald-200" />
        </div>
        <div className="mt-4 space-y-2 text-sm font-semibold text-stone-400">
          <div className="flex items-center gap-2"><Activity size={15} className="text-orange-200" /> Audit log active</div>
          <div className="flex items-center gap-2"><Layers3 size={15} className="text-orange-200" /> Workspace-scoped data</div>
          <div className="flex items-center gap-2"><ShieldCheck size={15} className="text-orange-200" /> Role-aware AI context</div>
        </div>
      </section>
    </aside>
  )
}

function ContextStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-xs font-bold text-stone-500">{label}</div>
      <div className="mt-1 text-lg font-black text-white">{value}</div>
    </div>
  )
}
