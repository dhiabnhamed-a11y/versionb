import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}

export default function EmptyState({ icon: Icon, title, description, actionLabel, actionHref, onAction }: EmptyStateProps) {
  const action =
    actionLabel && actionHref ? (
      <Link href={actionHref} className="btn-primary mt-5 inline-flex">
        {actionLabel}
      </Link>
    ) : actionLabel && onAction ? (
      <button type="button" onClick={onAction} className="btn-primary mt-5">
        {actionLabel}
      </button>
    ) : null

  return (
    <div className="ui-empty-state">
      <div className="ui-empty-icon">
        <Icon size={28} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}
