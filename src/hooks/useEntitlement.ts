'use client'

import useSWR from 'swr'

type EntitlementResult = {
  allowed: boolean
  loading: boolean
  error: boolean
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function useEntitlement(feature: string): EntitlementResult {
  const { data, error, isLoading } = useSWR<{ allowed: boolean }>(
    `/api/billing/entitlement?feature=${feature}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  )

  return {
    allowed: data?.allowed ?? false,
    loading: isLoading,
    error: Boolean(error),
  }
}
