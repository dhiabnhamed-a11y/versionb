'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BrainCircuit,
  Building2,
  CheckSquare,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Plus,
  ReceiptText,
  Search,
  Settings,
  Sparkles,
  UploadCloud,
  X,
  type LucideProps,
} from 'lucide-react'

type Command = {
  id: string
  label: string
  description: string
  href?: string
  assistantPrompt?: string
  group: 'Navigate' | 'Create' | 'Review' | 'Operate'
  keywords: string[]
  icon: ComponentType<LucideProps>
}

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  canManageWorkspace: boolean
  isEmployee: boolean
  isSuperAdmin: boolean
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
    icon: Sparkles,
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

function normalize(value: string) {
  return value.trim().toLowerCase()
}

export default function CommandPalette({
  open,
  onOpenChange,
  canManageWorkspace,
  isEmployee,
  isSuperAdmin,
}: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const commands = useMemo(() => {
    if (isSuperAdmin) {
      return [
        {
          id: 'company-approvals',
          label: 'Company approvals',
          description: 'Review workspace access requests',
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
          label: 'My briefs',
          description: 'Open assigned briefs and production work',
          href: '/dashboard/employee',
          group: 'Navigate',
          keywords: ['my', 'tasks', 'briefs', 'assigned'],
          icon: CheckSquare,
        },
        settingsCommand,
      ] satisfies Command[]
    }

    return canManageWorkspace ? [...baseCommands, settingsCommand] : baseCommands
  }, [canManageWorkspace, isEmployee, isSuperAdmin])

  const filteredCommands = useMemo(() => {
    const needle = normalize(query)
    if (!needle) return commands

    return commands.filter((command) => {
      const haystack = [command.label, command.description, command.group, ...command.keywords].join(' ').toLowerCase()
      return haystack.includes(needle)
    })
  }, [commands, query])

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
    { Navigate: [], Create: [], Review: [], Operate: [] }
  )

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
            placeholder="Search clients, briefs, invoices, deliverables..."
            aria-label="Search commands"
          />
          <button type="button" onClick={closePalette} aria-label="Close command palette">
            <X size={17} />
          </button>
        </div>

        <div className="command-palette-list">
          {filteredCommands.length === 0 ? (
            <div className="command-empty">
              <Sparkles size={18} />
              No command found
            </div>
          ) : (
            (Object.keys(grouped) as Command['group'][]).map((group) =>
              grouped[group].length ? (
                <div key={group} className="command-group">
                  <div className="command-group-label">{group}</div>
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
          <span>Navigate with arrows</span>
          <span>Enter to open</span>
          <span>Esc to close</span>
        </footer>
      </section>
    </div>
  )
}
