import type { Metadata } from 'next'
import Link from 'next/link'
import { Home } from 'lucide-react'
import ErrorLayout from '@/components/error/ErrorLayout'

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'The page you are looking for could not be found. Return to TASKIT OS dashboard.',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <ErrorLayout
      title="We could not find that page"
      subtitle="The page may have moved, or the link may no longer be available. You can return to a trusted starting point."
      code="404"
      showDiagnostics={false}
    >
      <Link href="/dashboard" className="btn-primary">
        <Home className="h-4 w-4" aria-hidden="true" />
        Go to dashboard
      </Link>
    </ErrorLayout>
  )
}
