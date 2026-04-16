import { useId } from 'react'
import { cn } from '@/lib/utils'

type BrandMarkProps = {
  className?: string
  title?: string
}

const quadrantPath =
  'M34 86C34 56.1766 58.1766 32 88 32H116V58H88C72.536 58 60 70.536 60 86V114H34V86Z'

export function BrandMark({ className, title = 'TASKIT' }: BrandMarkProps) {
  const id = useId().replace(/:/g, '')
  const shellGradient = `${id}-shell`
  const coreGradient = `${id}-core`

  return (
    <svg
      viewBox="0 0 208 208"
      className={cn('shrink-0', className)}
      role="img"
      aria-label={title}
      fill="none"
    >
      <defs>
        <linearGradient id={shellGradient} x1="32" y1="34" x2="176" y2="176" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2142FF" />
          <stop offset="0.52" stopColor="#24C8F8" />
          <stop offset="1" stopColor="#C8FB6D" />
        </linearGradient>
        <linearGradient id={coreGradient} x1="76" y1="76" x2="132" y2="132" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3151FF" />
          <stop offset="1" stopColor="#74F4FF" />
        </linearGradient>
      </defs>

      <g fill={`url(#${shellGradient})`} stroke="#08172B" strokeOpacity="0.72" strokeWidth="4">
        <path d={quadrantPath} />
        <path d={quadrantPath} transform="rotate(90 104 104)" />
        <path d={quadrantPath} transform="rotate(180 104 104)" />
        <path d={quadrantPath} transform="rotate(270 104 104)" />
      </g>

      <rect
        x="76"
        y="76"
        width="56"
        height="56"
        fill={`url(#${coreGradient})`}
        stroke="#08172B"
        strokeOpacity="0.72"
        strokeWidth="4"
      />
    </svg>
  )
}
