'use client'

import { useEffect, useRef, useState } from 'react'

type ResponsiveChartFrameProps = {
  className: string
  children: React.ReactNode
}

export default function ResponsiveChartFrame({ className, children }: ResponsiveChartFrameProps) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [hasMeasuredSize, setHasMeasuredSize] = useState(false)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    if (typeof ResizeObserver === 'undefined') {
      const raf = window.requestAnimationFrame(() => setHasMeasuredSize(true))
      return () => window.cancelAnimationFrame(raf)
    }

    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0
      const height = entry?.contentRect.height ?? 0
      setHasMeasuredSize(width > 0 && height > 0)
    })

    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={frameRef} className={className}>
      {hasMeasuredSize ? children : null}
    </div>
  )
}
