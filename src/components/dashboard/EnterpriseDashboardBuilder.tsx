'use client'

import { useMemo, useRef, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, EyeOff, GripVertical, Maximize2, Minimize2, PanelTopClose, PanelTopOpen, Save } from 'lucide-react'
import { normalizeDashboardDesignConfig, type DashboardWidgetConfig } from '@/lib/dashboard-design'
import { applyUserDashboardDesign } from '@/lib/theme-client'
import type { UserDashboardDesignSettings } from '@/lib/settings'
import { useDashboardDesignStore } from '@/stores/dashboard-design-store'

type EnterpriseDashboardBuilderProps = {
  renderWidget: (widget: DashboardWidgetConfig) => React.ReactNode
}

function updateWidget(
  widgets: DashboardWidgetConfig[],
  widgetId: string,
  updater: (widget: DashboardWidgetConfig) => DashboardWidgetConfig
) {
  return widgets.map((widget) => (widget.id === widgetId ? updater(widget) : widget)).map((widget, order) => ({ ...widget, order }))
}

function SortableWidget({
  widget,
  children,
  onToggleCollapsed,
  onHide,
  onDuplicate,
  onResize,
}: {
  widget: DashboardWidgetConfig
  children: React.ReactNode
  onToggleCollapsed: () => void
  onHide: () => void
  onDuplicate: () => void
  onResize: (direction: 'wide' | 'narrow' | 'tall' | 'short') => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id })

  return (
    <section
      ref={setNodeRef}
      className={`enterprise-widget-card ${isDragging ? 'is-dragging' : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        gridColumn: `span ${widget.colSpan}`,
        minHeight: widget.collapsed ? 74 : `${Math.max(180, widget.rowSpan * 180)}px`,
      }}
    >
      <header className="enterprise-widget-header">
        <button type="button" className="enterprise-widget-grip" aria-label={`Move ${widget.title}`} {...attributes} {...listeners}>
          <GripVertical size={16} />
        </button>
        <div className="min-w-0">
          <h2>{widget.title}</h2>
          <p>
            {widget.colSpan}x{widget.rowSpan}
          </p>
        </div>
        <div className="enterprise-widget-actions">
          <button type="button" aria-label="Make widget narrower" onClick={() => onResize('narrow')}>
            <Minimize2 size={14} />
          </button>
          <button type="button" aria-label="Make widget wider" onClick={() => onResize('wide')}>
            <Maximize2 size={14} />
          </button>
          <button type="button" aria-label="Make widget shorter" onClick={() => onResize('short')}>
            <PanelTopClose size={14} />
          </button>
          <button type="button" aria-label="Make widget taller" onClick={() => onResize('tall')}>
            <PanelTopOpen size={14} />
          </button>
          <button type="button" aria-label={widget.collapsed ? 'Expand widget' : 'Collapse widget'} onClick={onToggleCollapsed}>
            {widget.collapsed ? <PanelTopOpen size={14} /> : <PanelTopClose size={14} />}
          </button>
          <button type="button" aria-label="Duplicate widget" onClick={onDuplicate}>
            <Copy size={14} />
          </button>
          <button type="button" aria-label="Hide widget" onClick={onHide}>
            <EyeOff size={14} />
          </button>
        </div>
      </header>
      {!widget.collapsed && <div className="enterprise-widget-body">{children}</div>}
    </section>
  )
}

export default function EnterpriseDashboardBuilder({ renderWidget }: EnterpriseDashboardBuilderProps) {
  const config = useDashboardDesignStore((state) => state.config)
  const setConfig = useDashboardDesignStore((state) => state.setConfig)
  const setDesign = useDashboardDesignStore((state) => state.setDesign)
  const setStudioOpen = useDashboardDesignStore((state) => state.setStudioOpen)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const duplicateCounterRef = useRef(0)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const widgets = useMemo(
    () => config.dashboard.widgets.filter((widget) => widget.visible).sort((a, b) => a.order - b.order),
    [config.dashboard.widgets]
  )

  function setWidgets(nextWidgets: DashboardWidgetConfig[]) {
    setConfig(
      normalizeDashboardDesignConfig({
        ...config,
        dashboard: {
          ...config.dashboard,
          widgets: nextWidgets,
        },
      })
    )
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = config.dashboard.widgets.findIndex((widget) => widget.id === active.id)
    const newIndex = config.dashboard.widgets.findIndex((widget) => widget.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    setWidgets(arrayMove(config.dashboard.widgets, oldIndex, newIndex).map((widget, order) => ({ ...widget, order })))
  }

  function resizeWidget(widgetId: string, direction: 'wide' | 'narrow' | 'tall' | 'short') {
    setWidgets(
      updateWidget(config.dashboard.widgets, widgetId, (widget) => ({
        ...widget,
        colSpan:
          direction === 'wide'
            ? (Math.min(4, widget.colSpan + 1) as DashboardWidgetConfig['colSpan'])
            : direction === 'narrow'
            ? (Math.max(1, widget.colSpan - 1) as DashboardWidgetConfig['colSpan'])
            : widget.colSpan,
        rowSpan:
          direction === 'tall'
            ? (Math.min(3, widget.rowSpan + 1) as DashboardWidgetConfig['rowSpan'])
            : direction === 'short'
            ? (Math.max(1, widget.rowSpan - 1) as DashboardWidgetConfig['rowSpan'])
            : widget.rowSpan,
      }))
    )
  }

  function duplicateWidget(widget: DashboardWidgetConfig) {
    duplicateCounterRef.current += 1
    setWidgets([
      ...config.dashboard.widgets,
      {
        ...widget,
        id: `${widget.id}-copy-${duplicateCounterRef.current}`,
        title: `${widget.title} copy`,
        order: config.dashboard.widgets.length,
      },
    ])
  }

  async function saveLayout() {
    setSaving(true)
    const response = await fetch('/api/settings/design', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ design: config }),
    })
    const data = (await response.json().catch(() => ({}))) as { design?: UserDashboardDesignSettings; error?: string }
    setSaving(false)

    if (!response.ok || !data.design) {
      setMessage(data.error ?? 'Layout could not be saved.')
      return
    }

    setDesign(data.design)
    applyUserDashboardDesign(data.design)
    setMessage('Layout saved.')
    window.setTimeout(() => setMessage(null), 2400)
  }

  return (
    <div className="enterprise-dashboard-builder">
      <div className="enterprise-builder-toolbar">
        <div>
          <span>Dashboard Builder</span>
          <strong>{widgets.length} active widgets</strong>
        </div>
        <div className="enterprise-builder-actions">
          {message && <span className="enterprise-builder-message">{message}</span>}
          <button type="button" className="btn-secondary btn-sm" onClick={() => setStudioOpen(true)}>
            Customize
          </button>
          <button type="button" className="btn-primary btn-sm" onClick={saveLayout} disabled={saving}>
            <Save size={14} />
            {saving ? 'Saving' : 'Save layout'}
          </button>
        </div>
      </div>

      {!widgets.length ? (
        <div className="enterprise-empty-builder">
          <button type="button" className="btn-secondary" onClick={() => setConfig(normalizeDashboardDesignConfig({ ...config, dashboard: { ...config.dashboard, widgets: config.dashboard.widgets.map((widget) => ({ ...widget, visible: true })) } }))}>
            Restore widgets
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={widgets.map((widget) => widget.id)} strategy={rectSortingStrategy}>
            <div className="enterprise-dashboard-grid">
              {widgets.map((widget) => (
                <SortableWidget
                  key={widget.id}
                  widget={widget}
                  onToggleCollapsed={() =>
                    setWidgets(updateWidget(config.dashboard.widgets, widget.id, (item) => ({ ...item, collapsed: !item.collapsed })))
                  }
                  onHide={() => setWidgets(updateWidget(config.dashboard.widgets, widget.id, (item) => ({ ...item, visible: false })))}
                  onDuplicate={() => duplicateWidget(widget)}
                  onResize={(direction) => resizeWidget(widget.id, direction)}
                >
                  {renderWidget(widget)}
                </SortableWidget>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
