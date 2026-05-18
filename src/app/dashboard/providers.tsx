'use client'

import { SessionProvider } from 'next-auth/react'
import { SWRConfig } from 'swr'

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SWRConfig
        value={{
          fetcher,
          revalidateOnFocus: false,
          revalidateOnReconnect: true,
          dedupingInterval: 5_000,
          errorRetryCount: 2,
          keepPreviousData: true,
        }}
      >
        {children}
      </SWRConfig>
    </SessionProvider>
  )
}
