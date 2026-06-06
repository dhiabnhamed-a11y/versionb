'use client'

import { usePathname } from 'next/navigation'
import { ERPShell } from '@/components/erp/ERPShell'

export function ERPRouteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/erp') {
    return <>{children}</>
  }

  return <ERPShell>{children}</ERPShell>
}
