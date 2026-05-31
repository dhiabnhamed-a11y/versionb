import Link from 'next/link'
import { Home } from 'lucide-react'
import ErrorLayout from '@/components/error/ErrorLayout'

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
