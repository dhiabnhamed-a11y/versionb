export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`ui-skeleton ${className}`.trim()} aria-hidden="true" />
}

export function SkeletonCard() {
  return (
    <div className="card p-6">
      <Skeleton className="mb-4 h-4 w-1/3" />
      <Skeleton className="mb-3 h-8 w-1/2" />
      <Skeleton className="mb-2 h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  )
}
