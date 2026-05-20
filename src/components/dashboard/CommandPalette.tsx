'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Building2,
  CheckSquare,
  FileText,
  FolderKanban,
  Landmark,
  LayoutDashboard,
  Plus,
  ReceiptText,
  Search,
  Settings,
  Zap,
  UploadCloud,
  X,
  type LucideProps,
} from 'lucide-react'
import { useLocale } from '@/components/i18n/LocaleProvider'

type Command = {
  id: string
  label: string
  description: string
  href?: string
  assistantPrompt?: string
  group: 'Search' | 'Navigate' | 'Create' | 'Review' | 'Operate'
  keywords: string[]
  icon: ComponentType<LucideProps>
}

type SearchResult = {
  id: string
  entityType: string
  entityId: string
  title: string
  subtitle?: string | null
  href?: string | null
}

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  canManageWorkspace: boolean
  isEmployee: boolean
  isSuperAdmin: boolean
  hasSocialStats?: boolean
}

const baseCommands: Command[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Open the agency operations cockpit',
    href: '/dashboard/admin',
    group: 'Navigate',
    keywords: ['dashboard', 'insights', 'analytics', 'home'],
    icon: LayoutDashboard,
  },
  {
    id: 'clients',
    label: 'Clients',
    description: 'Search accounts, contacts, invoices, and relationship health',
    href: '/dashboard/admin/clients',
    group: 'Navigate',
    keywords: ['client', 'company', 'account', 'portal'],
    icon: Building2,
  },
  {
    id: 'projects',
    label: 'Campaigns and projects',
    description: 'Jump to active campaigns, rooms, and production work',
    href: '/dashboard/admin/projects',
    group: 'Navigate',
    keywords: ['campaign', 'project', 'deliverable', 'production'],
    icon: FolderKanban,
  },
  {
    id: 'briefs',
    label: 'Briefs and tasks',
    description: 'Manage production work, assignments, and approvals',
    href: '/dashboard/admin/tasks',
    group: 'Navigate',
    keywords: ['brief', 'task', 'todo', 'approval'],
    icon: CheckSquare,
  },
  {
    id: 'invoices',
    label: 'Invoices',
    description: 'Create, send, and track client billing',
    href: '/dashboard/admin/invoices',
    group: 'Navigate',
    keywords: ['billing', 'payment', 'invoice', 'money'],
    icon: ReceiptText,
  },
  {
    id: 'finance',
    label: 'Finance',
    description: 'Open profitability, approvals, treasury, payroll, and ledger controls',
    href: '/dashboard/admin/finance',
    group: 'Navigate',
    keywords: ['finance', 'accounting', 'payroll', 'treasury', 'expense', 'profitability', 'ledger'],
    icon: Landmark,
  },
  {
    id: 'new-client',
    label: 'Create client',
    description: 'Open the client workspace and add a relationship',
    href: '/dashboard/admin/clients?intent=create',
    group: 'Create',
    keywords: ['new', 'add', 'account', 'company'],
    icon: Plus,
  },
  {
    id: 'new-brief',
    label: 'Create brief',
    description: 'Start a new production brief or task',
    href: '/dashboard/admin/tasks?intent=create',
    group: 'Create',
    keywords: ['new', 'task', 'brief', 'request'],
    icon: FileText,
  },
  {
    id: 'new-invoice',
    label: 'Create invoice',
    description: 'Draft client billing from the invoice system',
    href: '/dashboard/admin/invoices?intent=create',
    group: 'Create',
    keywords: ['new', 'billing', 'draft', 'payment'],
    icon: ReceiptText,
  },
  {
    id: 'media-review',
    label: 'Media review rooms',
    description: 'Find uploaded audio, video, and image deliverables',
    href: '/dashboard/admin/projects',
    group: 'Review',
    keywords: ['frame', 'video', 'audio', 'image', 'comments', 'deliverables'],
    icon: UploadCloud,
  },
  {
    id: 'operations',
    label: 'Waiting for approval',
    description: 'Review work blocked by client or internal feedback',
    href: '/dashboard/admin/tasks?stage=REVIEW',
    group: 'Operate',
    keywords: ['blocked', 'review', 'changes', 'approval'],
    icon: Zap,
  },
  {
    id: 'ai-risks',
    label: 'Detect operational risks',
    description: 'Ask the AI assistant for projects, workload, approval, and finance risk',
    assistantPrompt: 'What are the biggest operational risks?',
    group: 'Operate',
    keywords: ['ai', 'assistant', 'risk', 'bottleneck', 'executive'],
    icon: BrainCircuit,
  },
  {
    id: 'ai-weekly-report',
    label: 'Generate weekly report',
    description: 'Summarize this week using real workspace data',
    assistantPrompt: "Summarize this week's business performance.",
    group: 'Operate',
    keywords: ['ai', 'assistant', 'weekly', 'report', 'summary'],
    icon: BrainCircuit,
  },
]

const settingsCommand: Command = {
  id: 'settings',
  label: 'Settings',
  description: 'Account design and workspace controls',
  href: '/dashboard/settings',
  group: 'Operate',
  keywords: ['settings', 'design', 'brand', 'workspace', 'admin'],
  icon: Settings,
}

const socialStatsCommand: Command = {
  id: 'social-stats',
  label: 'Social stats',
  description: 'Open YouTube, Spotify, and social performance',
  href: '/dashboard/admin/social-analytics',
  group: 'Navigate',
  keywords: ['social', 'youtube', 'spotify', 'music', 'streams', 'views'],
  icon: BarChart3,
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

export default function CommandPalette({
  open,
  onOpenChange,
  canManageWorkspace,
  isEmployee,
  isSuperAdmin,
  hasSocialStats = false,
}: CommandPaletteProps) {
  const { t } = useLocale()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)
  const searchEnabled = open && normalize(query).length >= 2

  const commands = useMemo(() => {
    const localizedBaseCommands = baseCommands.map((command) => {
      const copy: Partial<Pick<Command, 'label' | 'description'>> =
        command.id === 'overview'
          ? { label: t('nav.overview'), description: t('command.overview.description') }
          : command.id === 'clients'
            ? { label: t('nav.clients'), description: t('command.clients.description') }
            : command.id === 'projects'
              ? { label: t('nav.campaignsAndProjects'), description: t('command.projects.description') }
              : command.id === 'briefs'
                ? { label: t('nav.briefs'), description: t('command.briefs.description') }
                : command.id === 'invoices'
                  ? { label: t('nav.invoices'), description: t('command.invoices.description') }
                  : command.id === 'finance'
                    ? { label: t('nav.finance'), description: t('command.finance.description') }
                  : command.id === 'new-client'
                    ? { label: t('command.createClient'), description: t('command.createClient.description') }
                    : command.id === 'new-brief'
                      ? { label: t('command.createBrief'), description: t('command.createBrief.description') }
                      : command.id === 'new-invoice'
                        ? { label: t('command.createInvoice'), description: t('command.createInvoice.description') }
                        : command.id === 'media-review'
                          ? { label: t('command.mediaReview'), description: t('command.mediaReview.description') }
                          : command.id === 'operations'
                            ? { label: t('command.waitingApproval'), description: t('command.waitingApproval.description') }
                            : command.id === 'ai-risks'
                              ? { label: t('command.detectRisks'), description: t('command.detectRisks.description') }
                              : command.id === 'ai-weekly-report'
                                ? { label: t('command.weeklyReport'), description: t('command.weeklyReport.description') }
                                : {}

      return { ...command, ...copy }
    })

    const localizedSettingsCommand = {
      ...settingsCommand,
      label: t('nav.settings'),
      description: t('command.settings.description'),
    }
    const localizedSocialStatsCommand = {
      ...socialStatsCommand,
      label: t('nav.socialStats'),
      description: t('command.socialStats.description'),
    }

    if (isSuperAdmin) {
      return [
        {
          id: 'company-approvals',
          label: t('nav.companyApprovals'),
          description: t('command.settings.description'),
          href: '/dashboard/super-admin',
          group: 'Operate',
          keywords: ['super', 'admin', 'approval', 'company'],
          icon: Building2,
        },
      ] satisfies Command[]
    }

    if (isEmployee) {
      return [
        {
          id: 'my-briefs',
          label: t('nav.myBriefs'),
          description: t('command.briefs.description'),
          href: '/dashboard/employee',
          group: 'Navigate',
          keywords: ['my', 'tasks', 'briefs', 'assigned'],
          icon: CheckSquare,
        },
        localizedSettingsCommand,
      ] satisfies Command[]
    }

    const workspaceCommands = hasSocialStats ? [localizedSocialStatsCommand, ...localizedBaseCommands] : localizedBaseCommands

    return canManageWorkspace ? [...workspaceCommands, localizedSettingsCommand] : workspaceCommands
  }, [canManageWorkspace, hasSocialStats, isEmployee, isSuperAdmin, t])

  useEffect(() => {
    if (!searchEnabled) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(query)}`, { cache: 'no-store', signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { items: [] }))
        .then((body) => setSearchResults(Array.isArray(body.items) ? body.items : []))
        .catch((error) => {
          if ((error as Error).name !== 'AbortError') setSearchResults([])
        })
    }, 120)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query, searchEnabled])

  const entityCommands = useMemo(() => {
    if (!searchEnabled) return []

    return searchResults.map((result) => ({
      id: `entity:${result.entityType}:${result.entityId}`,
      label: result.title,
      description: result.subtitle || result.entityType,
        href: result.href || undefined,
      group: 'Search' as const,
      keywords: [result.entityType, result.title, result.subtitle ?? ''],
      icon: Search,
    }))
  }, [searchEnabled, searchResults])

  const filteredCommands = useMemo(() => {
    const needle = normalize(query)
    if (!needle) return commands

    const staticMatches = commands.filter((command) => {
      const haystack = [command.label, command.description, command.group, ...command.keywords].join(' ').toLowerCase()
      return haystack.includes(needle)
    })

    return [...entityCommands, ...staticMatches]
  }, [commands, entityCommands, query])

  useEffect(() => {
    if (!open) return

    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  const closePalette = useCallback(() => {
    onOpenChange(false)
    setQuery('')
    setSelectedIndex(0)
  }, [onOpenChange])

  const runCommand = useCallback(
    (command: Command) => {
      if (command.assistantPrompt) {
        window.dispatchEvent(new CustomEvent('taskit:open-ai-assistant', { detail: { prompt: command.assistantPrompt } }))
        closePalette()
        return
      }

      if (!command.href) return
      router.push(command.href)
      closePalette()
    },
    [closePalette, router]
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (open) {
          closePalette()
        } else {
          onOpenChange(true)
        }
        return
      }

      if (!open) return
      if (event.key === 'Escape') closePalette()
      if (isTyping && event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((current) => Math.min(current + 1, filteredCommands.length - 1))
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((current) => Math.max(current - 1, 0))
      }
      if (event.key === 'Enter' && filteredCommands[selectedIndex]) {
        event.preventDefault()
        runCommand(filteredCommands[selectedIndex])
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closePalette, filteredCommands, onOpenChange, open, runCommand, selectedIndex])

  if (!open) return null

  const grouped = filteredCommands.reduce<Record<Command['group'], Command[]>>(
    (acc, command) => {
      acc[command.group].push(command)
      return acc
    },
    { Search: [], Navigate: [], Create: [], Review: [], Operate: [] }
  )
  const groupLabels: Record<Command['group'], string> = {
    Search: t('command.group.search'),
    Navigate: t('command.group.navigate'),
    Create: t('command.group.create'),
    Review: t('command.group.review'),
    Operate: t('command.group.operate'),
  }

  return (
    <div className="command-palette-backdrop" role="presentation" onMouseDown={closePalette}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="command-palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-palette-search">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedIndex(0)
            }}
            placeholder={t('command.searchPlaceholder')}
            aria-label="Search commands"
          />
          <button type="button" onClick={closePalette} aria-label="Close command palette">
            <X size={17} />
          </button>
        </div>

        <div className="command-palette-list">
          {filteredCommands.length === 0 ? (
            <div className="command-empty">
              <Zap size={18} />
              {t('command.noCommand')}
            </div>
          ) : (
            (Object.keys(grouped) as Command['group'][]).map((group) =>
              grouped[group].length ? (
                <div key={group} className="command-group">
                  <div className="command-group-label">{groupLabels[group]}</div>
                  {grouped[group].map((command) => {
                    const absoluteIndex = filteredCommands.findIndex((item) => item.id === command.id)
                    const Icon = command.icon
                    const selected = absoluteIndex === selectedIndex

                    return (
                      <button
                        key={command.id}
                        type="button"
                        className={`command-item ${selected ? 'selected' : ''}`}
                        onMouseEnter={() => setSelectedIndex(absoluteIndex)}
                        onClick={() => runCommand(command)}
                      >
                        <span className="command-item-icon">
                          <Icon size={17} />
                        </span>
                        <span className="command-item-copy">
                          <strong>{command.label}</strong>
                          <span>{command.description}</span>
                        </span>
                        <ArrowRight size={15} className="command-item-arrow" />
                      </button>
                    )
                  })}
                </div>
              ) : null
            )
          )}
        </div>

        <footer className="command-palette-footer">
          <span>{t('command.navigateArrows')}</span>
          <span>{t('command.enterOpen')}</span>
          <span>{t('command.escClose')}</span>
        </footer>
      </section>
    </div>
  )
}
