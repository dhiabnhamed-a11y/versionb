'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Home, RefreshCw } from 'lucide-react'
import ErrorLayout from '@/components/error/ErrorLayout'

export default function Error({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  reset?: () => void
  unstable_retry?: () => void
}) {
  useEffect(() => {
    console.error('[error-boundary] Page error:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    })
  }, [error])

  const retry = unstable_retry ?? reset

  return (
    <ErrorLayout
      title="We could not load this page"
      subtitle="A temporary issue interrupted this view. Your workspace is protected, and it is safe to try again."
      code="ERR_500"
      showRecovery
    >
      <button
        type="button"
        onClick={() => (retry ? retry() : window.location.reload())}
        className="btn-primary"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Try again
      </button>
      <Link href="/dashboard" className="btn-secondary">
        <Home className="h-4 w-4" aria-hidden="true" />
        Go to dashboard
      </Link>
    </ErrorLayout>
  )
}
