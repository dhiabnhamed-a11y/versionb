import { useEffect } from 'react'

type XhrOpen = typeof XMLHttpRequest.prototype.open
type XhrSend = typeof XMLHttpRequest.prototype.send

export default function AnalyticsGuard() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const enabled = String(process.env.NEXT_PUBLIC_ENABLE_ANALYTICS || '').toLowerCase() === 'true'
    if (enabled) return

    const blockedHosts = [
      'www.google-analytics.com',
      'www.googletagmanager.com',
      'www.googleadservices.com',
      'www.google-analytics.com/mp',
      'app-measurement.com',
    ]

    const originalFetch = window.fetch
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      try {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof Request
              ? input.url
              : String(input)
        if (blockedHosts.some((h) => url.includes(h))) {
          return Promise.resolve(new Response(null, { status: 204 }))
        }
      } catch {
        // ignore
      }
      return originalFetch.call(this, input, init)
    }

    const originalBeacon = navigator.sendBeacon?.bind(navigator)
    if (originalBeacon) {
      navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null) {
        const urlStr = typeof url === 'string' ? url : url.toString()
        if (blockedHosts.some((h) => urlStr.includes(h))) {
          return true
        }
        return originalBeacon(url, data)
      }
    }

    const XHR = window.XMLHttpRequest
    let originalXhrOpen: XhrOpen | undefined
    let originalXhrSend: XhrSend | undefined

    if (XHR) {
      originalXhrOpen = XHR.prototype.open
      originalXhrSend = XHR.prototype.send

      XHR.prototype.open = function (
        method: string,
        url: string | URL,
        async?: boolean,
        username?: string | null,
        password?: string | null,
      ) {
        ;(this as XMLHttpRequest & { __analytics_block_url?: string }).__analytics_block_url =
          typeof url === 'string' ? url : url.toString()
        return originalXhrOpen!.call(this, method, url, async ?? true, username, password)
      }

      XHR.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
        try {
          const blockUrl = (this as XMLHttpRequest & { __analytics_block_url?: string })
            .__analytics_block_url
          if (blockUrl && blockedHosts.some((h) => blockUrl.includes(h))) {
            Object.defineProperty(this, 'readyState', { value: 4, configurable: true })
            Object.defineProperty(this, 'status', { value: 204, configurable: true })
            const evt = new ProgressEvent('load')
            this.onreadystatechange?.call(this, evt)
            this.onload?.call(this, evt)
            return
          }
        } catch {
          // ignore
        }
        return originalXhrSend!.call(this, body)
      }
    }

    return () => {
      try {
        window.fetch = originalFetch
        if (originalBeacon) {
          navigator.sendBeacon = originalBeacon
        }
        if (XHR && originalXhrOpen && originalXhrSend) {
          XHR.prototype.open = originalXhrOpen
          XHR.prototype.send = originalXhrSend
        }
      } catch {
        // ignore
      }
    }
  }, [])

  return null
}
