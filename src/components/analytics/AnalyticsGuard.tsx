import { useEffect } from 'react'

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

    // patch fetch
    const originalFetch = window.fetch
    // @ts-ignore
    window.fetch = function (input: RequestInfo, init?: RequestInit) {
      try {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
        if (blockedHosts.some((h) => url.includes(h))) {
          return Promise.resolve(new Response(null, { status: 204 }))
        }
      } catch (e) {
        // ignore
      }
      return originalFetch.apply(this, [input, init])
    }

    // patch navigator.sendBeacon
    const nav = navigator as any
    const originalBeacon = nav.sendBeacon?.bind(navigator)
    if (originalBeacon) {
      nav.sendBeacon = function (url: string, data?: BodyInit | null) {
        if (blockedHosts.some((h) => url.includes(h))) {
          return true
        }
        return originalBeacon(url, data)
      }
    }

    // patch XHR open/send to block GA endpoints
    const XHR = (window as any).XMLHttpRequest
    if (XHR) {
      const OriginalXHR = XHR.prototype.open
      const OriginalSend = XHR.prototype.send
      XHR.prototype.open = function (method: string, url: string | URL) {
        this.__analytics_block_url = typeof url === 'string' ? url : String(url)
        return OriginalXHR.apply(this, arguments)
      }
      XHR.prototype.send = function (body?: any) {
        try {
          if (this.__analytics_block_url && blockedHosts.some((h: string) => this.__analytics_block_url.includes(h))) {
            this.readyState = 4
            this.status = 204
            this.onreadystatechange && this.onreadystatechange()
            this.onload && this.onload()
            return
          }
        } catch (e) {
          // ignore
        }
        return OriginalSend.apply(this, arguments)
      }
    }

    return () => {
      try {
        // restore fetch
        // @ts-ignore
        window.fetch = originalFetch
        if (originalBeacon) nav.sendBeacon = originalBeacon
        if (XHR) {
          XHR.prototype.open = OriginalXHR
          XHR.prototype.send = OriginalSend
        }
      } catch (e) {
        // ignore
      }
    }
  }, [])

  return null
}
