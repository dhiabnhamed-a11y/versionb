'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, FolderKanban, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'

type CalendarView = 'MONTH' | 'WEEK'

type CalendarEvent = {
  id: string
  title: string
  description?: string | null
  type: string
  startsAt: string
  endsAt?: string | null
  color?: string | null
  projectId?: string | null
  taskId?: string | null
  readOnly?: boolean
  source?: 'calendar' | 'task'
  project?: { id: string; title: string } | null
  task?: { id: string; title: string; stage?: string } | null
}

type ProjectOption = {
  id: string
  title: string
}

type TaskOption = {
  id: string
  title: string
  project: { id: string; title: string }
}

const EVENT_TYPE_OPTIONS = [
  { value: 'PROJECT_EVENT', label: 'Project event', color: '#0369a1' },
  { value: 'MEETING', label: 'Meeting', color: '#7c3aed' },
  { value: 'MILESTONE', label: 'Milestone', color: '#059669' },
  { value: 'BLOCKER', label: 'Blocker', color: '#dc2626' },
]

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfWeek(date: Date) {
  const start = startOfDay(date)
  start.setDate(start.getDate() - start.getDay())
  return start
}

function getRange(cursor: Date, view: CalendarView) {
  if (view === 'WEEK') {
    const from = startOfWeek(cursor)
    return { from, to: addDays(from, 7) }
  }

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const from = startOfWeek(monthStart)
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
  const to = addDays(startOfWeek(addDays(monthEnd, 6)), 1)
  return { from, to }
}

function keyForDate(date: Date | string) {
  return startOfDay(new Date(date)).toISOString()
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function getEventColor(event: CalendarEvent) {
  if (event.color) return event.color
  if (event.type === 'TASK_DEADLINE') return '#d97706'
  return EVENT_TYPE_OPTIONS.find((option) => option.value === event.type)?.color ?? '#0369a1'
}

function getInitialForm(day?: Date) {
  const startsAt = day ? new Date(day) : new Date()
  startsAt.setHours(day ? 9 : startsAt.getHours(), 0, 0, 0)

  return {
    id: '',
    title: '',
    description: '',
    type: 'PROJECT_EVENT',
    startsAt: toDateTimeLocal(startsAt.toISOString()),
    endsAt: '',
    projectId: '',
    taskId: '',
    color: '',
  }
}

export default function AdminCalendarPage() {
  const [view, setView] = useState<CalendarView>('MONTH')
  const [cursor, setCursor] = useState(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [tasks, setTasks] = useState<TaskOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(getInitialForm())

  const range = useMemo(() => getRange(cursor, view), [cursor, view])
  const rangeFromIso = range.from.toISOString()
  const rangeToIso = range.to.toISOString()
  const days = useMemo(() => {
    const count = view === 'WEEK' ? 7 : 42
    return Array.from({ length: count }, (_, index) => addDays(range.from, index))
  }, [range.from, view])

  const loadCalendarData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      from: rangeFromIso,
      to: rangeToIso,
    })
    const [eventsBody, projectsBody, tasksBody] = await Promise.all([
      fetch(`/api/calendar-events?${params.toString()}`).then((response) => response.json()),
      fetch('/api/projects').then((response) => response.json()),
      fetch('/api/tasks').then((response) => response.json()),
    ])

    setEvents(Array.isArray(eventsBody) ? eventsBody : [])
    setProjects(Array.isArray(projectsBody) ? projectsBody : [])
    setTasks(Array.isArray(tasksBody) ? tasksBody : [])
    setLoading(false)
  }, [rangeFromIso, rangeToIso])

  useEffect(() => {
    let active = true

    const load = async () => {
      await loadCalendarData()
      if (!active) return
    }

    void load()

    return () => {
      active = false
    }
  }, [loadCalendarData])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const key = keyForDate(event.startsAt)
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }

    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    }

    return map
  }, [events])

  function moveCursor(direction: number) {
    const next = new Date(cursor)
    if (view === 'WEEK') next.setDate(next.getDate() + direction * 7)
    else next.setMonth(next.getMonth() + direction)
    setCursor(next)
  }

  function openCreate(day?: Date) {
    setError('')
    setForm(getInitialForm(day))
    setShowModal(true)
  }

  function openEdit(event: CalendarEvent) {
    if (event.readOnly) return
    setError('')
    setForm({
      id: event.id,
      title: event.title,
      description: event.description ?? '',
      type: event.type,
      startsAt: toDateTimeLocal(event.startsAt),
      endsAt: toDateTimeLocal(event.endsAt),
      projectId: event.projectId ?? '',
      taskId: event.taskId ?? '',
      color: event.color ?? '',
    })
    setShowModal(true)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')

    const response = await fetch(form.id ? `/api/calendar-events/${form.id}` : '/api/calendar-events', {
      method: form.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description || undefined,
        type: form.type,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        color: form.color || undefined,
        projectId: form.projectId || undefined,
        taskId: form.taskId || undefined,
      }),
    })

    const body = (await response.json()) as { error?: string }
    setSaving(false)

    if (!response.ok) {
      setError(body.error || 'Event could not be saved.')
      return
    }

    setShowModal(false)
    await loadCalendarData()
  }

  async function handleDelete() {
    if (!form.id || !confirm('Delete this calendar event?')) return
    setSaving(true)
    setError('')
    const response = await fetch(`/api/calendar-events/${form.id}`, { method: 'DELETE' })
    setSaving(false)
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      setError(body.error || 'Event could not be deleted.')
      return
    }
    setShowModal(false)
    await loadCalendarData()
  }

  const rangeLabel =
    view === 'WEEK'
      ? `${range.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${addDays(range.to, -1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="dashboard-page" style={{ maxWidth: '1180px' }}>
      <div className="dashboard-header-row">
        <div>
          <h1 className="page-heading flex items-center gap-2.5">
            <CalendarDays size={24} strokeWidth={1.85} style={{ color: 'var(--accent)' }} /> Calendar
          </h1>
          <p className="page-sub">Plan project events and track task deadlines in one shared schedule.</p>
        </div>
        <div className="dashboard-header-actions">
          <div className="flex rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-1 shadow-sm">
            {(['MONTH', 'WEEK'] as CalendarView[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setView(item)}
                className={`filter-chip ${view === item ? 'filter-chip-active' : ''}`}
                style={{ borderRadius: '8px', borderColor: 'transparent' }}
              >
                {item === 'MONTH' ? 'Month' : 'Week'}
              </button>
            ))}
          </div>
          <button type="button" className="btn-secondary" onClick={() => setCursor(new Date())}>
            Today
          </button>
          <button type="button" className="btn-primary" onClick={() => openCreate()}>
            <Plus size={15} /> New event
          </button>
        </div>
      </div>

      <section className="card">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary btn-sm !min-h-9 !px-3" onClick={() => moveCursor(-1)} aria-label="Previous range">
              <ChevronLeft size={16} />
            </button>
            <button type="button" className="btn-secondary btn-sm !min-h-9 !px-3" onClick={() => moveCursor(1)} aria-label="Next range">
              <ChevronRight size={16} />
            </button>
            <h2 className="font-display text-lg font-semibold tracking-tight">{rangeLabel}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPE_OPTIONS.map((item) => (
              <span key={item.value} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-elevated)] px-3 py-1 text-[11px] font-bold text-[var(--text-muted)]">
                <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid h-[440px] place-items-center">
            <Loader2 size={26} className="animate-spin text-[var(--accent)]" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
            <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const dayEvents = eventsByDay.get(keyForDate(day)) ?? []
                const isCurrentMonth = day.getMonth() === cursor.getMonth()
                const isToday = keyForDate(day) === keyForDate(new Date())

                return (
                  <button
                    type="button"
                    key={day.toISOString()}
                    onClick={() => openCreate(day)}
                    className="min-h-[128px] border-b border-r border-[var(--border)] p-2 text-left transition hover:bg-[var(--accent-subtle)]"
                    style={{
                      background: isToday ? 'rgba(3,105,161,0.06)' : undefined,
                      opacity: view === 'MONTH' && !isCurrentMonth ? 0.52 : 1,
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${isToday ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}>
                        {day.getDate()}
                      </span>
                      {dayEvents.length > 0 && <span className="text-[10px] font-bold text-[var(--text-muted)]">{dayEvents.length}</span>}
                    </div>
                    <div className="grid gap-1">
                      {dayEvents.slice(0, view === 'WEEK' ? 6 : 3).map((item) => (
                        <span
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation()
                            openEdit(item)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') openEdit(item)
                          }}
                          className="truncate rounded-md px-2 py-1 text-[11px] font-bold text-white shadow-sm"
                          style={{ background: getEventColor(item) }}
                        >
                          {new Date(item.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} {item.title}
                        </span>
                      ))}
                      {dayEvents.length > (view === 'WEEK' ? 6 : 3) && (
                        <span className="text-[10px] font-bold text-[var(--text-muted)]">+{dayEvents.length - (view === 'WEEK' ? 6 : 3)} more</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
        <div className="card">
          <h2 className="font-display mb-4 text-lg font-semibold tracking-tight">Upcoming schedule</h2>
          <div className="dashboard-card-stack">
            {events.length === 0 ? (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-8 text-center text-sm font-semibold text-[var(--text-muted)]">
                No events in this range
              </div>
            ) : (
              events.slice(0, 8).map((event) => (
                <button
                  type="button"
                  key={event.id}
                  onClick={() => openEdit(event)}
                  className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-3 text-left transition hover:border-[var(--accent)] hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-3 w-3 rounded-full" style={{ background: getEventColor(event) }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[var(--text-primary)]">{event.title}</span>
                        {event.readOnly && <span className="badge badge-employee">Synced task</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} /> {new Date(event.startsAt).toLocaleString()}
                        </span>
                        {event.project && (
                          <span className="inline-flex items-center gap-1">
                            <FolderKanban size={12} /> {event.project.title}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="font-display text-lg font-semibold tracking-tight">Calendar sync</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Task deadlines are synced automatically. Manual calendar events can be linked to a project or task for richer planning.
          </p>
          <div className="mt-5 grid gap-3">
            <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
              <div className="text-2xl font-black text-[var(--accent)]">{events.filter((event) => event.source === 'task').length}</div>
              <div className="text-xs font-bold text-[var(--text-muted)]">Task deadlines in range</div>
            </div>
            <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
              <div className="text-2xl font-black text-[var(--accent)]">{events.filter((event) => event.source !== 'task').length}</div>
              <div className="text-xs font-bold text-[var(--text-muted)]">Manual events in range</div>
            </div>
          </div>
        </div>
      </section>

      {showModal && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2 className="font-display mb-5 text-lg font-semibold tracking-tight">{form.id ? 'Edit calendar event' : 'Create calendar event'}</h2>
            <form onSubmit={handleSubmit} className="grid gap-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Title *</label>
                <input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Type</label>
                <select className="input" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                  {EVENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-split">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Starts *</label>
                  <input className="input" type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} required />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Ends</label>
                  <input className="input" type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Description</label>
                <textarea className="input" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </div>
              <div className="form-split">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Project</label>
                  <select className="input" value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })}>
                    <option value="">None</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Task</label>
                  <select className="input" value={form.taskId} onChange={(event) => setForm({ ...form, taskId: event.target.value })}>
                    <option value="">None</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <div className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              <div className="modal-actions">
                {form.id && (
                  <button type="button" className="btn-danger" onClick={handleDelete} disabled={saving}>
                    <Trash2 size={14} /> Delete
                  </button>
                )}
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : form.id ? <Pencil size={14} /> : <Plus size={14} />}
                  {form.id ? 'Save event' : 'Create event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
